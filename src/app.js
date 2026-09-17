import { scenarios, getScenario } from './data/scenarios.js';
import { createSpeaker, createRecognizer, createRecorder } from './speech/browserSpeech.js';
import { createPracticeState, startListening, receiveTranscript, retryTurn, advanceTurn, previousTurn, toggleSentence, toggleTranslation, failSpeech } from './domain/practiceMachine.js';
import { loadLearningState, saveLearningState, recordSession, recordHelpUse } from './storage/learningStore.js';

const app = document.querySelector('#app');
const speaker = createSpeaker(window);
const recognizer = createRecognizer(window);
const recorder = createRecorder(window);
let audioUrl = null, attemptToken = 0, promptTimer = null, audioNotice = '';
let voiceSettings = {voiceURI:'',rate:.9};
try { voiceSettings = {...voiceSettings,...JSON.parse(localStorage.getItem('english-travel-voice')||'{}')}; } catch {}
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

function cleanup() {
  attemptToken++; clearTimeout(promptTimer); recognizer.cancel(); recorder.cancel(); speaker.cancel();
  app.querySelector('audio')?.pause();
  if(audioUrl) URL.revokeObjectURL(audioUrl); audioUrl=null; audioNotice='';
}
function go(next) { cleanup(); screen = next; render(); }
function speechOptions(slow=false) { return {voiceURI:voiceSettings.voiceURI,rate:slow?.65:Number(voiceSettings.rate)||.9}; }
function voiceControls() {
  return `<details class="voice-settings"><summary>🔊 목소리 · 속도 설정</summary><label>영어 목소리<select id="voice-select"><option value="">자동 선택</option>${speaker.voices().map(v=>`<option value="${escapeHtml(v.voiceURI)}" ${v.voiceURI===voiceSettings.voiceURI?'selected':''}>${escapeHtml(v.name)} (${escapeHtml(v.lang)})</option>`).join('')}</select></label><label>듣기 속도<select id="voice-rate">${[.7,.8,.9,1,1.1].map(v=>`<option value="${v}" ${v===Number(voiceSettings.rate)?'selected':''}>${v}배</option>`).join('')}</select></label><button class="secondary-button" data-action="voice-preview">선택한 목소리 들어보기</button><p class="small-note">휴대폰에서 제공하는 영어 음성을 사용해요. 목소리 품질과 목록은 기기에 따라 달라요.</p></details>`;
}

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
    ${voiceControls()}<p class="small-note">업데이트 v2 · 무료 브라우저 음성 기능</p>
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
  return activeScenario.turns.map((turn,i) => `<span class="dot ${practice.attempts[turn.id] ? 'done':''} ${i===practice.turnIndex?'current':''}"></span>`).join('');
}

function renderFeedback() {
  if (!practice.evaluation) return '';
  const f = feedbackCopy[practice.evaluation.level];
  return `<div class="feedback ${practice.evaluation.level}" role="status"><div class="feedback-head"><span>${f.icon}</span>${practice.evaluation.category==='unconfirmed'?'표현 확인이 필요해요':f.title}</div><div class="muted">${escapeHtml(practice.evaluation.explanation)}</div><div class="natural">${practice.evaluation.level==='pass'?'통한 표현':'참고 표현'} · ${escapeHtml(practice.evaluation.naturalAnswer)} <button class="text-button" data-action="speak-natural">🔊 듣기</button></div><p class="small-note">인식된 문장의 뜻을 규칙으로 확인해요. 발음 점수나 AI 평가가 아니에요.</p></div>`;
}

function renderPractice() {
  if (practice.phase === 'complete') {
    if (!sessionRecorded && Object.keys(practice.attempts).length) {
      learning = recordSession(learning, { scenarioId:activeScenario.id, mistakes:practice.completedMistakes });
      saveLearningState(localStorage, learning);
      sessionRecorded = true;
    }
    const count=Object.keys(practice.attempts).length;
    return shell(`<section class="screen practice-screen"><div class="topbar"><button class="icon-button" data-action="home" aria-label="홈으로">×</button>${logo()}<span></span></div><div class="complete-card"><div class="complete-icon">🎉</div><h2>${activeScenario.title} 연습 마침</h2><p class="muted">${activeScenario.turns.length}개 중 ${count}개 질문에 대답했어요.<br>통한 답변 ${Object.values(practice.attempts).filter(v=>v==='pass').length}개 · 건너뛴 질문 ${activeScenario.turns.length-count}개<br>복습할 표현 ${practice.completedMistakes.length}개</p><button class="primary-button" data-action="home">홈으로</button><button class="secondary-button" data-action="restart">이 상황 다시 연습</button><button class="secondary-button" data-action="review">복습 보기</button></div></section>`);
  }
  const turn = activeScenario.turns[practice.turnIndex];
  const listening = practice.phase === 'listening';
  const busy = ['starting','listening','stopping'].includes(practice.phase);
  const hasAttempt = Boolean(practice.transcript);
  const error = practice.errorMessage ? `<div class="error-box">${escapeHtml(practice.errorMessage)}</div>` : '';
  return shell(`<section class="screen practice-screen">
    <div class="practice-header"><button class="icon-button" data-action="scenarios" aria-label="연습 종료">←</button><div class="practice-title"><strong>${activeScenario.emoji} ${activeScenario.title}</strong><span>${practice.turnIndex+1} / ${activeScenario.turns.length}</span></div><span></span></div>
    <div class="progress-dots">${progressDots()}</div>
    <div class="speaker-zone"><div class="speaker-avatar">🧑‍💼</div><h2>${busy ? '내 차례예요' : '직원이 영어로 말했어요'}</h2><p class="muted">${busy ? '말을 마치면 마이크를 다시 눌러 주세요.' : '먼저 귀로 듣고 대답해보세요.'}</p><div class="wave" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div></div>
    ${practice.showSentence ? `<div class="reveal-card"><strong>영어</strong><br>${escapeHtml(turn.prompt)}</div>` : ''}
    ${practice.showTranslation ? `<div class="reveal-card korean"><strong>뜻</strong><br>${escapeHtml(turn.translation)}</div>` : ''}
    <div class="transcript" ${hasAttempt?'':'hidden'}>인식된 말 · <strong id="live-transcript">${escapeHtml(practice.transcript)}</strong></div>
    ${audioUrl?`<div class="recording-playback"><strong>🎧 내가 말한 거 듣기</strong><audio controls preload="metadata" src="${escapeHtml(audioUrl)}"></audio><small>방금 녹음한 실제 목소리예요. 다시 말하거나 이동하면 지워져요.</small></div>`:''}
    ${audioNotice?`<p class="small-note">${escapeHtml(audioNotice)}</p>`:''}
    ${error}${renderFeedback()}
    <div class="listen-area">
      ${practice.phase === 'feedback' ? `<button class="primary-button" data-action="retry">🎙️ 한 번 더 말하기</button>` : `<div class="mic-wrap"><button class="mic-button ${listening ? 'listening':''}" data-action="listen" aria-label="${listening?'말하기 종료':'말하기 시작'}" ${busy&&!listening?'disabled':''}>${listening?'⏹':'🎙️'}</button><div class="mic-label">${listening?'다시 누르면 종료 · 평가':practice.phase==='starting'?'마이크 준비 중…':practice.phase==='stopping'?'마지막 말을 확인 중…':'눌러서 말하기'}</div></div>`}
      <p id="recognition-status" class="small-note" role="status"></p>
      <div class="question-nav"><button class="secondary-button" data-action="previous" ${busy||practice.turnIndex===0?'disabled':''}>← 이전 질문</button><button class="secondary-button" data-action="next" ${busy?'disabled':''}>${practice.turnIndex===activeScenario.turns.length-1?'연습 마침':'다음 질문 →'}</button></div>
      <div class="help-grid"><button class="help-button" data-help="replay" ${busy?'disabled':''}>🔊 다시 듣기</button><button class="help-button" data-help="slow" ${busy?'disabled':''}>🐢 천천히</button><button class="help-button" data-help="sentence">👀 문장 보기</button><button class="help-button" data-help="translation">🇰🇷 뜻 보기</button></div>
      ${busy?'':voiceControls()}<p class="small-note">녹음은 앱 서버에 저장하지 않아요. 음성인식은 브라우저 제공업체의 온라인 처리를 사용할 수 있어요.</p>
    </div>
  </section>`);
}

function renderReview() {
  const body = learning.mistakes.length ? `<div class="review-list">${learning.mistakes.map((m,i) => `<article class="review-card"><button class="review-speak" data-review-speak="${i}" aria-label="추천 표현 듣기">🔊</button><div class="review-meta">${scenarioName(m.scenarioId)} · ${m.level === 'retry' ? '다시 연습' : '조금 아쉬움'}</div><div><small class="muted">내가 말한 말</small><br>${escapeHtml(m.transcript || '(인식 안 됨)')}</div><div class="review-answer"><small>이렇게 말해봐요</small><br>${escapeHtml(m.naturalAnswer)}</div></article>`).join('')}</div>` : `<div class="empty"><div style="font-size:48px">🌱</div><h3>아직 복습할 문장이 없어요.</h3><p>연습 중 어려웠던 표현이 자동으로 모여요.</p></div>`;
  return shell(`<section class="screen"><div class="topbar"><button class="icon-button" data-action="home" aria-label="홈으로">←</button>${logo()}<span style="width:48px"></span></div><p class="eyebrow">REVIEW</p><h1>최근 실수<br>다시 말하기.</h1><p class="muted">정답 암기보다 입으로 한 번 더 말하는 데 집중해요.</p>${body}</section>`);
}

function startScenario(id) {
  cleanup();
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
  if (['starting','listening','stopping'].includes(practice.phase)) return;
  app.querySelector('audio')?.pause();
  try { await speaker.speak(turn.prompt, speechOptions(slow)); } catch { practice.showSentence=true;practice.errorMessage='음성 재생이 어려워 문장을 표시했어요. 목소리 설정을 바꾸거나 다시 듣기를 눌러 주세요.';render(); }
}

function recognitionMessage(type) {
  if (type === 'permission-denied') return '마이크 권한이 필요해요. 브라우저 설정에서 마이크를 허용한 뒤 다시 시도해 주세요.';
  if (type === 'no-speech') return '잘 안 들렸어요. 다시 말해봐요.';
  if (type === 'network') return '음성인식 네트워크 연결이 불안정해요. 잠시 후 다시 시도해 주세요.';
  if (type === 'unsupported') return '이 브라우저에서는 음성인식을 사용할 수 없어요. Android Chrome을 권장해요.';
  return '음성인식을 시작하지 못했어요. 다시 시도해 주세요.';
}

async function listen() {
  if(practice.phase==='listening'){practice.phase='stopping';recognizer.stop();render();return;}
  if(['starting','stopping'].includes(practice.phase))return;
  if (!recognizer.supported) {
    practice = failSpeech(practice, recognitionMessage('unsupported')); render(); return;
  }
  cleanup();const token=attemptToken;
  practice = {...startListening(practice),phase:'starting',transcript:'',evaluation:null}; render();
  try {
    if(recorder.supported) await recorder.start();
    else audioNotice='이 브라우저는 녹음 재생을 지원하지 않아요. 음성인식만 사용해요.';
    if(token!==attemptToken)return;
    practice.phase='listening';render();
    const result = await recognizer.listen({onTranscript(text){
      if(token!==attemptToken)return;practice.transcript=text;
      const el=app.querySelector('#live-transcript');if(el){el.textContent=text;el.parentElement.hidden=!text;}
    },onStatus(text){const el=app.querySelector('#recognition-status');if(el)el.textContent=text;}});
    const blob=await recorder.stop();
    if(token!==attemptToken)return;
    if(blob?.size)audioUrl=URL.createObjectURL(blob);
    const turn = activeScenario.turns[practice.turnIndex];
    if (!result.transcript.trim()) throw { type:'no-speech' };
    practice = receiveTranscript(practice, turn, result.transcript);
    render();
  } catch (error) {
    if(token!==attemptToken||error?.type==='cancelled')return;
    recorder.cancel();
    practice = failSpeech(practice, recognitionMessage(error?.name==='NotAllowedError'?'permission-denied':error?.type));
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
    if (action === 'retry') { cleanup();practice = retryTurn(practice); await listen(); }
    if (action === 'next') { cleanup();practice = advanceTurn(practice, activeScenario); render(); }
    if (action === 'previous') { cleanup();practice = previousTurn(practice); render(); }
    if (action === 'restart') startScenario(activeScenario.id);
    if (action === 'speak-natural') {app.querySelector('audio')?.pause();await speaker.speak(practice.evaluation.naturalAnswer, speechOptions()).catch(()=>{});}
    if (action === 'voice-preview') await speaker.speak('Hello. Where would you like to go?',speechOptions()).catch(()=>{});
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
    if (item) speaker.speak(item.naturalAnswer, speechOptions()).catch(()=>{});
  }));
  app.querySelector('#voice-select')?.addEventListener('change',e=>{voiceSettings.voiceURI=e.target.value;saveVoice();});
  app.querySelector('#voice-rate')?.addEventListener('change',e=>{voiceSettings.rate=Number(e.target.value);saveVoice();});
  app.querySelector('audio')?.addEventListener('play',()=>speaker.cancel());
}
function saveVoice(){try{localStorage.setItem('english-travel-voice',JSON.stringify(voiceSettings));}catch{}}

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
      clearTimeout(promptTimer);const token=attemptToken;
      promptTimer=setTimeout(() => {if(token===attemptToken&&screen.name==='practice'&&practice.phase==='ready')playPrompt(false);},250);
    }
  }
}

window.speechSynthesis?.addEventListener('voiceschanged',()=>{if(screen.name==='home'||(screen.name==='practice'&&practice.phase==='ready'))render();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){const busy=practice&&['starting','listening','stopping'].includes(practice.phase);cleanup();if(busy)practice=failSpeech(practice,'화면을 벗어나 녹음을 중단했어요. 답변은 평가하지 않았어요.');if(screen.name==='practice')render();}});
window.addEventListener('pagehide',cleanup);
window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferredInstallPrompt = event; if(screen.name==='home')render(); });
window.addEventListener('appinstalled', () => { deferredInstallPrompt = null; });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(()=>{}));

render();
