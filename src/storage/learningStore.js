const STORAGE_KEY = 'english-travel-prep-state';

export function createDefaultLearningState() {
  return {
    completedSessions: 0,
    completedScenarioIds: [],
    mistakes: [],
    streakDays: 0,
    lastStudyDate: null,
    helpUse: { replay: 0, slow: 0, sentence: 0, translation: 0 },
  };
}

function validState(value) {
  return value && typeof value === 'object' && Number.isFinite(value.completedSessions) && Array.isArray(value.mistakes);
}

export function loadLearningState(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return createDefaultLearningState();
    const parsed = JSON.parse(raw);
    if (!validState(parsed)) return createDefaultLearningState();
    const defaults = createDefaultLearningState();
    return {
      ...defaults,
      ...parsed,
      helpUse: { ...defaults.helpUse, ...(parsed.helpUse ?? {}) },
      completedScenarioIds: Array.isArray(parsed.completedScenarioIds) ? parsed.completedScenarioIds : [],
      mistakes: Array.isArray(parsed.mistakes) ? parsed.mistakes.slice(0, 50) : [],
    };
  } catch {
    return createDefaultLearningState();
  }
}

export function saveLearningState(storage = globalThis.localStorage, state) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable in private mode. Learning still works in memory.
  }
}

function dayNumber(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

export function recordSession(state, session, studyDate = new Date().toLocaleDateString('en-CA')) {
  let streakDays = state.streakDays;
  if (!state.lastStudyDate) {
    streakDays = 1;
  } else if (state.lastStudyDate !== studyDate) {
    streakDays = dayNumber(studyDate) - dayNumber(state.lastStudyDate) === 1 ? Math.max(1, state.streakDays + 1) : 1;
  }

  const completedScenarioIds = state.completedScenarioIds.includes(session.scenarioId)
    ? state.completedScenarioIds
    : [...state.completedScenarioIds, session.scenarioId];
  const incomingMistakes = [...(session.mistakes ?? [])].reverse();

  return {
    ...state,
    completedSessions: state.completedSessions + 1,
    completedScenarioIds,
    mistakes: [...incomingMistakes, ...state.mistakes].slice(0, 50),
    streakDays,
    lastStudyDate: studyDate,
  };
}

export function recordHelpUse(state, kind) {
  if (!(kind in state.helpUse)) return state;
  return {
    ...state,
    helpUse: { ...state.helpUse, [kind]: state.helpUse[kind] + 1 },
  };
}
