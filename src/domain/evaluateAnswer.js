export function normalizeSpeech(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[.,!?;:"'()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesAlternative(text, alternative) {
  const candidate = normalizeSpeech(alternative);
  if (!candidate) return false;
  if (candidate.includes(' ')) return text.includes(candidate);
  return text.split(' ').includes(candidate);
}

export function evaluateAnswer(turn, transcript) {
  const normalizedTranscript = normalizeSpeech(transcript);
  const groups = Array.isArray(turn.requiredGroups) ? turn.requiredGroups : [];
  const satisfied = groups.filter((group) =>
    group.some((alternative) => matchesAlternative(normalizedTranscript, alternative)),
  ).length;

  let level = 'retry';
  if (groups.length > 0 && satisfied === groups.length) level = 'pass';
  else if (satisfied > 0) level = 'almost';

  return {
    level,
    normalizedTranscript,
    naturalAnswer: turn.naturalAnswer,
  };
}
