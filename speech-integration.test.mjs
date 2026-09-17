import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as data from './src/data/scenarios.js';
import * as speech from './src/speech/browserSpeech.js';
import * as machine from './src/domain/practiceMachine.js';
import * as storage from './src/storage/learningStore.js';

// Exercise the real app + speech adapters. The native API fake models exclusive
// microphone ownership: a second capture source receives no speech results.
function appHarness(transcript='I am flying to New York') {
  let micOwners=0, mediaRequests=0, recognitionStarts=0;
  class Recognition {
    start(){recognitionStarts++;queueMicrotask(()=>{
      this.onstart?.();this.onaudiostart?.();
      if(!micOwners&&transcript)this.onresult?.({results:[Object.assign([{transcript}],{isFinal:true})]});
    });}
    stop(){this.onend?.();} abort(){this.onend?.();}
  }
  class Recorder {
    static isTypeSupported(){return true;}
    constructor(){this.state='inactive';this.mimeType='audio/webm';}
    start(){this.state='recording';}
    stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['voice'])});this.onstop?.();}
  }
  const env={SpeechRecognition:Recognition,MediaRecorder:Recorder,Blob,
    navigator:{mediaDevices:{getUserMedia:async()=>{
      mediaRequests++;micOwners++;let released=false;
      return {getTracks:()=>[{stop(){if(!released){released=true;micOwners--;}}}]};
    }}},addEventListener(){}};
  const app={innerHTML:'',querySelector(){return null;},querySelectorAll(){return [];}};
  const context=vm.createContext({...data,...speech,...machine,...storage,
    window:env,navigator:env.navigator,document:{hidden:false,querySelector:()=>app,addEventListener(){}},
    localStorage:{getItem(){return null;},setItem(){}},URL,Blob,setTimeout,clearTimeout,console});
  const source=readFileSync(new URL('./src/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
  vm.runInContext(source,context);
  vm.runInContext("startScenario('airport')",context);
  return {run:code=>vm.runInContext(code,context),get owners(){return micOwners;},get requests(){return mediaRequests;},get starts(){return recognitionStarts;}};
}
test('speaking evaluation works when the phone only permits one capture source',async()=>{
  const app=appHarness();
  try {
    const pending=app.run('listen()'); await new Promise(r=>setTimeout(r,10));
    await app.run('listen()');await pending;
    assert.equal(app.run('practice.phase'),'feedback');
    assert.equal(app.run('practice.evaluation.level'),'pass');
    assert.equal(app.requests,0,'evaluation must never open a competing MediaRecorder microphone');
    assert.equal(app.owners,0);
  } finally {app.run('cleanup()');}
});
test('replay recording captures audio without starting recognition or grading',async()=>{
  const app=appHarness();
  try {
    await app.run("recordVoice()");
    assert.equal(app.run('practice.phase'),'recording');
    await app.run('recordVoice()');
    assert.equal(app.starts,0);assert.equal(app.owners,0);
    assert.equal(app.run('practice.evaluation'),null);
    assert.match(app.run('audioUrl'),/^blob:/);
  } finally {app.run('cleanup()');}
});
test('recognition stop keeps a result delivered after the old two-second cutoff',async()=>{
  let engine;
  class Recognition {constructor(){engine=this;} start(){} stop(){} abort(){this.onend?.();}}
  const recognizer=speech.createRecognizer({SpeechRecognition:Recognition});
  let settled=false;
  const result=recognizer.listen().then(r=>{settled=true;return r;},e=>{settled=true;throw e;});
  recognizer.stop();await new Promise(r=>setTimeout(r,2150));
  const prematurelySettled=settled;
  engine.onresult({results:[Object.assign([{transcript:'New York'}],{isFinal:true})]});engine.onend();
  const answer=await result;assert.equal(prematurelySettled,false);assert.equal(answer.transcript,'New York');
});
test('an empty recognition response never grades or records a mistake',async()=>{
 const app=appHarness('');try{
   const pending=app.run('listen()');await new Promise(r=>setTimeout(r,10));await app.run('listen()');await pending;
   assert.equal(app.run('practice.phase'),'error');assert.equal(app.run('practice.evaluation'),null);
   assert.equal(app.run('Object.keys(practice.attempts).length'),0);
   assert.equal(app.run('practice.completedMistakes.length'),0);
   assert.match(app.run('practice.errorMessage'),/음성인식이 문장을 반환하지/);
 }finally{app.run('cleanup()');}
});
test('recording releases its microphone before a subsequent evaluated answer',async()=>{
 const app=appHarness();try{
   await app.run('recordVoice()');await app.run('recordVoice()');assert.equal(app.owners,0);
   const pending=app.run('listen()');await new Promise(r=>setTimeout(r,10));await app.run('listen()');await pending;
   assert.equal(app.run('practice.evaluation.level'),'pass');assert.equal(app.requests,1);
 }finally{app.run('cleanup()');}
});
