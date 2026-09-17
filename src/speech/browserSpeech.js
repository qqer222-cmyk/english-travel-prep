export function createSpeaker(env = globalThis) {
  const synthesis = env.speechSynthesis, Utterance = env.SpeechSynthesisUtterance;
  let settle = null;
  const voices = () => (synthesis?.getVoices?.() ?? []).filter(v=>/^en[-_]/i.test(v.lang)).sort((a,b)=>Number(/Google|Natural|Online/i.test(b.name))-Number(/Google|Natural|Online/i.test(a.name)));
  function cancel() { if(settle) settle(); settle=null; synthesis?.cancel?.(); }
  return {
    supported:Boolean(synthesis && Utterance), voices, cancel,
    speak(text, options={}) {
      if (!synthesis || !Utterance) return Promise.reject(new Error('unsupported'));
      cancel();
      return new Promise((resolve,reject)=>{
        const utterance = new Utterance(text);
        utterance.voice = voices().find(v=>v.voiceURI===options.voiceURI) ?? voices()[0] ?? null;
        utterance.lang = utterance.voice?.lang ?? 'en-US';
        utterance.rate = Math.min(1.2,Math.max(.55,options.rate ?? .9));
        utterance.pitch=1; utterance.volume=1;
        settle=resolve;
        utterance.onend=()=>{if(settle===resolve)settle=null;resolve();};
        utterance.onerror=()=>{if(settle===resolve)settle=null;reject(new Error('speech-error'));};
        synthesis.speak(utterance);
      });
    }
  };
}
export function mapRecognitionError(error) {
  if (error==='not-allowed'||error==='service-not-allowed') return 'permission-denied';
  if (error==='no-speech'||error==='network'||error==='audio-capture') return error;
  return 'unknown';
}
export function createRecognizer(env=globalThis) {
  const Recognition=env.SpeechRecognition||env.webkitSpeechRecognition;
  let session=null;
  function finish(s,error) {
    if(session!==s)return;
    session=null; clearTimeout(s.timer);clearTimeout(s.stopTimer);
    s.active?.abort?.();
    if(error)s.reject(error);else s.resolve({transcript:[...s.segments,s.current].filter(Boolean).join(' ').trim()});
  }
  function begin(s) {
    if(session!==s||s.stopping)return;
    const recognition=new Recognition();s.active=recognition;s.current='';
    recognition.lang='en-US';recognition.continuous=true;recognition.interimResults=true;recognition.maxAlternatives=1;
    recognition.onresult=e=>{
      if(session!==s)return;
      // Rebuild this engine session; interim text replaces itself, never appends twice.
      s.current=Array.from(e.results,r=>r[0]?.transcript??'').join(' ').trim();
      s.onTranscript?.([...s.segments,s.current].filter(Boolean).join(' '));
    };
    recognition.onerror=e=>{
      if(session!==s)return;
      if(e.error==='no-speech')return; // onend restarts; silence is not a wrong answer.
      if(s.stopping && e.error==='aborted')return;
      finish(s,{type:mapRecognitionError(e.error)});
    };
    recognition.onend=()=>{
      if(session!==s)return;
      s.active=null;
      if(s.stopping){finish(s);return;}
      if(s.current){s.segments.push(s.current);s.current='';s.emptyEnds=0;}else s.emptyEnds++;
      if(s.emptyEnds>8){finish(s,{type:'no-speech'});return;}
      s.onStatus?.('음성 연결을 이어가는 중이에요. 버튼을 누르기 전에는 평가하지 않아요.');
      s.timer=setTimeout(()=>begin(s),250);
    };
    try {recognition.start();} catch {finish(s,{type:'unknown'});}
  }
  return {
    supported:Boolean(Recognition),
    listen(options={}) {
      if(!Recognition)return Promise.reject({type:'unsupported'});
      if(session)finish(session,{type:'cancelled'});
      return new Promise((resolve,reject)=>{
        session={resolve,reject,segments:[],current:'',emptyEnds:0,...options};begin(session);
      });
    },
    stop() {
      const s=session;if(!s||s.stopping)return;
      s.stopping=true;clearTimeout(s.timer);
      if(!s.active){finish(s);return;}
      s.stopTimer=setTimeout(()=>finish(s),2000);
      try{s.active.stop();}catch{finish(s);}
    },
    cancel(){if(session)finish(session,{type:'cancelled'});}
  };
}
export function createRecorder(env=globalThis) {
  let generation=0,recording=null;
  const release=stream=>stream?.getTracks().forEach(track=>track.stop());
  return {
    supported:Boolean(env.MediaRecorder&&env.navigator?.mediaDevices?.getUserMedia),
    async start() {
      const token=++generation;
      const stream=await env.navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      if(token!==generation){release(stream);throw {type:'cancelled'};}
      try {
        const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(type=>env.MediaRecorder.isTypeSupported?.(type));
        const recorder=new env.MediaRecorder(stream,mime?{mimeType:mime}:undefined);
        const chunks=[];
        let resolveDone;
        const done=new Promise(resolve=>resolveDone=resolve);
        const finish=()=>{release(stream);if(recording?.recorder===recorder)recording=null;resolveDone(chunks.length?new env.Blob(chunks,{type:recorder.mimeType||mime||'audio/webm'}):null);};
        recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
        recorder.onstop=finish;recorder.onerror=finish;
        recording={recorder,stream,done};recorder.start();
      }catch(error){release(stream);recording=null;throw error;}
    },
    stop() {
      const r=recording;if(!r)return Promise.resolve(null);
      if(r.recorder.state!=='inactive')r.recorder.stop();else release(r.stream);
      return r.done;
    },
    cancel() {
      generation++;const r=recording;recording=null;
      if(r){if(r.recorder.state!=='inactive')r.recorder.stop();release(r.stream);}
    }
  };
}
