export function createSpeaker(env = globalThis) {
  const synthesis = env.speechSynthesis;
  const Utterance = env.SpeechSynthesisUtterance;
  return {
    supported: Boolean(synthesis && Utterance),
    speak(text, options = {}) {
      if (!synthesis || !Utterance) return Promise.reject(new Error('unsupported'));
      synthesis.cancel?.();
      return new Promise((resolve, reject) => {
        const utterance = new Utterance(text);
        utterance.lang = options.lang ?? 'en-US';
        utterance.rate = options.rate ?? 0.9;
        utterance.onend = () => resolve();
        utterance.onerror = () => reject(new Error('speech-error'));
        synthesis.speak(utterance);
      });
    },
    cancel() { synthesis?.cancel?.(); }
  };
}

export function mapRecognitionError(error) {
  if (error === 'not-allowed' || error === 'service-not-allowed') return 'permission-denied';
  if (error === 'no-speech') return 'no-speech';
  if (error === 'network') return 'network';
  return 'unknown';
}

export function createRecognizer(env = globalThis) {
  const Recognition = env.SpeechRecognition || env.webkitSpeechRecognition;
  let active = null;
  return {
    supported: Boolean(Recognition),
    listen() {
      if (!Recognition) return Promise.reject({ type:'unsupported' });
      return new Promise((resolve, reject) => {
        const recognition = new Recognition();
        active = recognition;
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.continuous = false;
        recognition.maxAlternatives = 1;
        recognition.onresult = (event) => {
          const result = event.results?.[0]?.[0];
          active = null;
          resolve({ transcript: result?.transcript ?? '', confidence: Number.isFinite(result?.confidence) ? result.confidence : null });
        };
        recognition.onerror = (event) => {
          active = null;
          reject({ type: mapRecognitionError(event.error) });
        };
        recognition.onnomatch = () => {
          active = null;
          reject({ type:'no-speech' });
        };
        recognition.start();
      });
    },
    stop() { active?.stop?.(); active = null; }
  };
}
