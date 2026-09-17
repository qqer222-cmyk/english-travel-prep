import { evaluateAnswer } from './evaluateAnswer.js';

export function createPracticeState(scenario) {
  return { scenarioId: scenario.id, turnIndex: 0, phase: 'ready', transcript: '', evaluation: null, showSentence: false, showTranslation: false, completedMistakes: [], errorMessage: null };
}
export function startListening(state) { return { ...state, phase:'listening', errorMessage:null }; }
export function receiveTranscript(state, turn, transcript, occurredAt = new Date().toISOString()) {
  const evaluation = evaluateAnswer(turn, transcript);
  const mistake = evaluation.level === 'pass' ? [] : [{ scenarioId:state.scenarioId, turnId:turn.id, transcript, naturalAnswer:turn.naturalAnswer, level:evaluation.level, occurredAt }];
  return { ...state, phase:'feedback', transcript, evaluation, completedMistakes:[...state.completedMistakes, ...mistake], errorMessage:null };
}
export function retryTurn(state) { return { ...state, phase:'ready', transcript:'', evaluation:null, errorMessage:null }; }
export function advanceTurn(state, scenario) {
  if (state.turnIndex >= scenario.turns.length - 1) return { ...state, phase:'complete' };
  return { ...state, turnIndex:state.turnIndex + 1, phase:'ready', transcript:'', evaluation:null, showSentence:false, showTranslation:false, errorMessage:null };
}
export function toggleSentence(state) { return { ...state, showSentence:!state.showSentence }; }
export function toggleTranslation(state) { return { ...state, showTranslation:!state.showTranslation }; }
export function failSpeech(state, message) { return { ...state, phase:'error', errorMessage:message }; }
