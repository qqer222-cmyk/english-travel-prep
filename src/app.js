import { scenarios, getScenario } from './data/scenarios.js';
import { createSpeaker, createRecognizer } from './speech/browserSpeech.js';
import { createPracticeState, startListening, receiveTranscript, retryTurn, advanceTurn, toggleSentence, toggleTranslation, failSpeech } from './domain/practiceMachine.js';
import { loadLearningState, saveLearningState, recordSession, recordHelpUse } from './storage/learningStore.js';

const app = document.querySelector('#app');
const speaker = createSpeaker(window);
const recognizer = createRecognizer(window);
let learning = loadLearningState(localStorage);
let screen = { name:'home' };
let practice = null;
let activeScenario = null;
let lastAutoPromptKey = null;
let deferredInstallPrompt = null;
let sessionRecorded = false;

const feedbackCopy = {
  pass: { icon:'✓', title:'통했어요', body:'여행에서는 충분히 알아들을 수 있어요.' },
  almost: { icon:'△', title:'조금 아쉬워요', body:'의미는 잡혔어요. 아래 표현으로 한 번 더 익혀봐요.' },
  retry: { icon:'↻', title:'다시 말해봐요', body:'질문에 필요한 핵심 표현이 아직 잘 안 들렸어요.' }
};

function scenarioName(id) { return scenarios.find(s => s.id === id)?.title ?? id; }
function escapeHtml(value='') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

function shell(content) { return `<div class="app-shell">${content}</div>`; }
function logo() { return `<div class="logo"><span class="logo-mark">E</span><span>영어 여행 준비</span></div>`; }

function go(next) { screen = next; render(); }

function renderHome() {
  const today = scenarios[learning.completedSessions % scenarios.length];
  return shell(`<section class="screen">
    <div class="topbar">${logo()}<span class="stat-chip" style="background:#f2f4f7">🔥 ${learning.streakDays}일</span></div>
    <div class="hero">
      <p class="eyebrow" style="color:#bfb8ff">SPEAK BEFORE YOU TRAVEL</p>
      <h1>여행 전에<br>입부터 풀자.</h1>
      <p>문장 외우기보다 실제 질문을 듣고, 직접 말하면서 준비해요.</p>
      <div class="stat-row"><span class="stat-chip">완료 ${learning.completedSessions}회</span><span class="stat-chip">상황 6개</span><span class="stat-chip">대화 30턴</span></div>
      <button class="primary-button" data-action="today">오늘의 연습 시작 · ${today.emoji} ${today.title}</button>
    </div>
    <div id="install-slot"></div>
    <div class="section-head"><h2>바로 시작하기</h2></div>
    <div class="quick-grid">
      <button class="quick-card" data-action="scenarios"><span class="quick-icon">🗺️</span><strong>상황별 연습</strong><small>공항부터 쇼핑까지 골라서 연습</small></button>
      <button class="quick-card" data-action="review"><span class="quick-icon">🔁</span><strong>최근 실수 복습</strong><small>${learning.mistakes.length ? `${learning.mistakes.length}개 표현 다시 말하기` : '틀린 표현이 여기에 모여요'}</small></button>
    </div>
    <div class="section-head"><h2>추천 연습</h2><button class="text-button" data-action="scenarios">전체 보기</button></div>
    <button class="scenario-card" data-scenario="hotel"><span class="scenario-emoji">🏨</span><span class="scenario-copy"><strong>호텔 체크인</strong><small>예약 · 여권 · 숙박일 · 키 · 조식</small></span><span class="chevron">›</span></button>
  </section>`);
}

function renderScenarios() {
  const cards = scenarios.map(s => `<button class="scenario-card" data-scenario="${s.id}"><span class="scenario-emoji">${s.emoji}</span><span class="scenario-copy"><strong>${s.title}</strong><small>${s.description}</small></span><span class="chevron">›</span></button>`).join('');
  return shell(`<section class="screen"><div class="topbar"><button class="icon-button" data-action="home" aria-label="홈으로">←</button>${logo()}<span style="width:48px"></span></div><p class="eyebrow">SCENARIOS</p><h1>어디서 말할지<br>골라봐.</h1><p class="muted">각 상황은 5개의 짧은 대화로 끝나요.</p><div class="scenario-list">${cards}</div></section>`);
}

function progressDots() {
  return activeScenario.turns.map((_,i) => `<span class="dot ${i <= practice.turnIndex ? 'done':''}"></span>`).join('');
}

function renderFeedback() {
  if (!practice.evaluation) return '';
  const f = feedbackCopy[practice.evaluation.level];
  return `<div class="feedback ${practice.evaluation.level}"><div class="feedback-head"><span>${f.icon}</span>${f.title}</div><div class="muted">${f.body}</div><div class="natural">추천 표현 · ${escapeHtml(practice.evaluation.naturalAnswer)} <button class="text-button" data-action="speak-natural">🔊 듣기</button></div></div>`;
}

function renderPractice() {
  if (practice.phase === 'complete') {
    if (!sessionRecorded) {
      learning = recordSession(learning, { scenarioId:activeScenario.id, mistakes:practice.completedMistakes });
      saveLearningState(localStorage, learning);
      sessionRecorded = true;
    }
    return shell(`<section class="screen practice-screen"><div class="topbar"><button class="icon-button" data-action="home" aria-label="홈으로">×</button>${logo()}<span style="width:48px"></span></div><div class="complete-card"><div class="complete-icon">🎉</div><p class="eyebrow">SESSION COMPLETE</p><h2>${activeScenario.title} 연습 완료</h2><p class="muted">5번의 질문을 전부 듣고 직접 대답했어요.<br>${practice.completedMistakes.length ? `복습할 표현 ${practice.completedMistakes.length}개가 저장됐어요.` : '이번 세션은 복습할 실수가 없어요.'}</p><button class="primary-button" data-action="home">홈으로</button><button class="secondary-button" style="margin-top:10px" data-action="review">실수 복습 보기</button></div></section>`);
  }
  const turn = activeScenario.turns[practice.turnIndex];
  const listening = practice.phase === 'listening';
  const hasAttempt = Boolean(practice.transcript);
  const error = practice.errorMessage ? `<div class="error-box">${escapeHtml(practice.errorMessage)}</div>` : '';
  return shell(`<section class="screen practice-screen">
    <div class="practice-header"><button class="icon-button" data-action="scenarios" aria-label="연습 종료">←</button><div class="practice-title"><strong>${activeScenario.emoji} ${activeScenario.title}</strong><span>${practice.turnIndex+1} / ${activeScenario.turns.length}</span></div><span></span></div>
    <div class="progress-dots">${progressDots()}</div>
    <div class="speaker-zone"><div class="speaker-avatar">🧑‍💼</div><h2>${listening ? '듣고 있어요…' : '직원이 영어로 말했어요'}</h2><p class="muted">${listening ? '영어로 편하게 말해보세요.' : '먼저 귀로 듣고 대답해보세요.'}</p><div class="wave" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div></div>
    ${practice.showSentence ? `<div class="reveal-card"><strong>영어</strong><br>${escapeHtml(turn.prompt)}</div>` : ''}
    ${practice.showTranslation ? `<div class="reveal-card korean"><strong>뜻</strong><br>${escapeHtml(turn.translation)}</div>` : ''}
    ${hasAttempt ? `<div class="transcript">내가 말한 말 · <strong>${escapeHtml(practice.transcript)}</strong></div>` : ''}
    ${error}${renderFeedback()}
    <div class="listen-area">
      ${practice.phase === 'feedback' ? `<button class="primary-button" data-action="${practice.evaluation.level === 'retry' ? 'retry' : 'next'}">${practice.evaluation.level === 'retry' ? '다시 말하기' : '다음 질문'}</button>` : `<div class="mic-wrap"><button class="mic-button ${listening ? 'listening':''}" data-action="listen" aria-label="말하기 시작" ${listening?'disabled':''}>🎙️</button><div class="mic-label">${listening ? '듣는 중…' : '눌러서 말하기'}</div></div>`}
      <div class="help-grid"><button class="help-button" data-help="replay">🔊 다시 듣기</button><button class="help-button" data-help="slow">🐢 천천히</button><button class="help-button" data-help="sentence">👀 문장 보기</button><button class="help-button" data-help="translation">🇰🇷 뜻 보기</button></div>
    </div>
  </section>`);
}

function renderReview() {
  const body = learning.mistakes.length ? `<div class="review-list">${learning.mistakes.map((m,i) => `<article class="review-card"><button class="review-speak" data-review-speak="${i}" aria-label="추천 표현 듣기">🔊</button><div class="review-meta">${scenarioName(m.scenarioId)} · ${m.level === 'retry' ? '다시 연습' : '조금 아쉬움'}</div><div><small class="muted">내가 말한 말</small><br>${escapeHtml(m.transcript || '(인식 안 됨)')}</div><div class="review-answer"><small>이렇게 말해봐요</small><br>${escapeHtml(m.naturalAnswer)}</div></article>`).join('')}</div>` : `<div class="empty"><div style="font-size:48px">🌱</div><h3>아직 복습할 문장이 없어요.</h3><p>연습 중 어려웠던 표현이 자동으로 모여요.</p></div>`;
  return shell(`<section class="screen"><div class="topbar"><button class="icon-button" data-action="home" aria-label="홈으로">←</button>${logo()}<span style="width:48px"></span></div><p class="eyebrow">REVIEW</p><h1>최근 실수<br>다시 말하기.</h1><p class="muted">정답 암기보다 입으로 한 번 더 말하는 데 집중해요.</p>${body}</section>`);
}

function startScenario(id) {
  activeScenario = getScenario(id);
  practice = createPracticeState(activeScenario);
  sessionRecorded = false;
  lastAutoPromptKey = null;
  screen = { name:'practice' };
  render();
}

async function playPrompt(slow=false) {
  const turn = activeScenario?.turns[practice?.turnIndex ?? 0];
  if (!turn) return;
  if (!speaker.supported) {
    practice = toggleSentence(practice);
    render();
    return;
  }
  try { await speaker.speak(turn.prompt, { rate: slow ? 0.65 : 0.9, lang:'en-US' }); } catch { /* visual fallback remains available */ }
}

function recognitionMessage(type) {
  if (type === 'permission-denied') return '마이크 권한이 필요해요. 브라우저 설정에서 마이크를 허용한 뒤 다시 시도해 주세요.';
  if (type === 'no-speech') return '잘 안 들렸어요. 다시 말해봐요.';
  if (type === 'network') return '음성인식 네트워크 연결이 불안정해요. 잠시 후 다시 시도해 주세요.';
  if (type === 'unsupported') return '이 브라우저에서는 음성인식을 사용할 수 없어요. Android Chrome을 권장해요.';
  return '음성인식을 시작하지 못했어요. 다시 시도해 주세요.';
}

async function listen() {
  if (!recognizer.supported) {
    practice = failSpeech(practice, recognitionMessage('unsupported')); render(); return;
  }
  speaker.cancel();
  practice = startListening(practice); render();
  try {
    const result = await recognizer.listen();
    const turn = activeScenario.turns[practice.turnIndex];
    if (!result.transcript.trim()) throw { type:'no-speech' };
    practice = receiveTranscript(practice, turn, result.transcript);
    render();
  } catch (error) {
    practice = failSpeech(practice, recognitionMessage(error?.type));
    render();
  }
}

function recordHelp(kind) {
  learning = recordHelpUse(learning, kind);
  saveLearningState(localStorage, learning);
}

function bindEvents() {
  app.querySelectorAll('[data-action]').forEach(el => el.addEventListener('click', async () => {
    const action = el.dataset.action;
    if (action === 'home') go({name:'home'});
    if (action === 'scenarios') go({name:'scenarios'});
    if (action === 'review') go({name:'review'});
    if (action === 'today') startScenario(scenarios[learning.completedSessions % scenarios.length].id);
    if (action === 'listen') await listen();
    if (action === 'retry') { practice = retryTurn(practice); render(); }
    if (action === 'next') { practice = advanceTurn(practice, activeScenario); render(); }
    if (action === 'speak-natural') await speaker.speak(practice.evaluation.naturalAnswer, {rate:.8, lang:'en-US'}).catch(()=>{});
    if (action === 'install' && deferredInstallPrompt) { deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; render(); }
  }));
  app.querySelectorAll('[data-scenario]').forEach(el => el.addEventListener('click', () => startScenario(el.dataset.scenario)));
  app.querySelectorAll('[data-help]').forEach(el => el.addEventListener('click', async () => {
    const kind = el.dataset.help; recordHelp(kind);
    if (kind === 'replay') await playPrompt(false);
    if (kind === 'slow') await playPrompt(true);
    if (kind === 'sentence') { practice = toggleSentence(practice); render(); }
    if (kind === 'translation') { practice = toggleTranslation(practice); render(); }
  }));
  app.querySelectorAll('[data-review-speak]').forEach(el => el.addEventListener('click', () => {
    const item = learning.mistakes[Number(el.dataset.reviewSpeak)];
    if (item) speaker.speak(item.naturalAnswer, {rate:.8, lang:'en-US'}).catch(()=>{});
  }));
}

function maybeShowInstall() {
  if (screen.name !== 'home' || !deferredInstallPrompt) return;
  const slot = app.querySelector('#install-slot');
  if (!slot) return;
  slot.innerHTML = `<div class="install-banner"><span>📱 홈 화면에 설치할 수 있어요.</span><button data-action="install">설치</button></div>`;
  slot.querySelector('button')?.addEventListener('click', async () => {
    deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; render();
  });
}

function render() {
  if (screen.name === 'home') app.innerHTML = renderHome();
  if (screen.name === 'scenarios') app.innerHTML = renderScenarios();
  if (screen.name === 'practice') app.innerHTML = renderPractice();
  if (screen.name === 'review') app.innerHTML = renderReview();
  bindEvents();
  maybeShowInstall();
  if (screen.name === 'practice' && practice?.phase === 'ready') {
    const key = `${activeScenario.id}:${practice.turnIndex}`;
    if (lastAutoPromptKey !== key) {
      lastAutoPromptKey = key;
      setTimeout(() => playPrompt(false), 250);
    }
  }
}

window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferredInstallPrompt = event; render(); });
window.addEventListener('appinstalled', () => { deferredInstallPrompt = null; });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(()=>{}));

render();
