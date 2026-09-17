import test from 'node:test';
import assert from 'node:assert/strict';
import {scenarios} from './src/data/scenarios.js';
import {evaluateAnswer} from './src/domain/evaluateAnswer.js';
import * as machine from './src/domain/practiceMachine.js';
import {createRecognizer, createSpeaker} from './src/speech/browserSpeech.js';
const turns = scenarios.flatMap(s=>s.turns);
const fixtures = [
 ['airport-destination',"I'm flying to New York",'pass'],
 ['shop-color','yellow please','pass'],['taxi-stop','please stop at the next corner','pass'],
 ['imm-first','this is my first visit','pass'],['imm-first','This is my second visit','pass'],
 ['rest-order','water please','pass'],['rest-bill','no thanks','pass'],
 ['imm-purpose','I am here for trip','almost'],['imm-purpose','trip','almost'],
 ['imm-purpose','I am sure for a trip','almost'],
 ['airport-seat','Aisle please','pass'],['airport-bag','No bags','pass'],
 ['imm-duration','Two weeks','pass'],['hotel-nights','Five nights','pass'],
 ['hotel-keys','Two please','pass'],['rest-party','Four people','pass'],
 ['taxi-pay','Cash please','pass'],['shop-size','Extra large','pass'],
 ['imm-return','No I do not','pass'],['hotel-reservation','I have a reservation','pass'],
 ['rest-spicy','Yes please','pass'],['shop-try','No thanks','pass'],
 ['airport-destination','I am flying to','almost'],
 ['imm-duration','Seven years old','retry'],['shop-color','chicken please','retry'],
 ['taxi-stop','I like to stop eating','retry'],['rest-order','blue please','retry'],
 ['imm-first','yes this is my second visit','almost'],
 ['imm-return','yes I do not have a ticket','almost'],
];
for(const [id,transcript,want] of fixtures) test(`${id}: ${transcript}`,()=>{
 const result=evaluateAnswer(turns.find(t=>t.id===id),transcript);
 assert.equal(result.level,want);
 assert.ok(result.explanation?.length>15);
});
for(const turn of turns) {
 test(`example ${turn.id}`,()=>assert.equal(evaluateAnswer(turn,turn.naturalAnswer).level,'pass'));
 test(`empty ${turn.id}`,()=>assert.notEqual(evaluateAnswer(turn,'').level,'pass'));
 test(`irrelevant ${turn.id}`,()=>assert.notEqual(evaluateAnswer(turn,'purple elephants dance on the moon').level,'pass'));
}
test('navigation does not count skipped questions as attempts and permits returning',()=>{
 let state=machine.createPracticeState(scenarios[0]);
 state=machine.advanceTurn(state,scenarios[0]);
 assert.equal(Object.keys(state.attempts).length,0);
 state=machine.previousTurn(state); assert.equal(state.turnIndex,0);
 state=machine.previousTurn(state); assert.equal(state.turnIndex,0);
});
test('retry after pass preserves previous evaluated attempt without duplicate mistakes',()=>{
 let state=machine.createPracticeState(scenarios[0]);
 state=machine.receiveTranscript(state,turns[0],'New York');
 state=machine.retryTurn(state);
 assert.equal(state.phase,'ready'); assert.equal(Object.keys(state.attempts).length,1);
 state=machine.receiveTranscript(state,turns[0],'New York');
 assert.equal(Object.keys(state.attempts).length,1); assert.equal(state.completedMistakes.length,0);
});
// Only native speech engine is simulated; the production adapter controls settlement/lifecycle.
function speechEnv(){
 const instances=[];
 class Recognition {constructor(){instances.push(this);} start(){} stop(){this.onend?.();} abort(){this.onend?.();}}
 return {env:{SpeechRecognition:Recognition},instances};
}
const speechResult=(text)=>({resultIndex:0,results:[Object.assign([{transcript:text,confidence:.9}],{isFinal:true})]});
test('speech result waits for explicit stop and accumulates restarted segments',async()=>{
 const {env,instances}=speechEnv(); const r=createRecognizer(env); let settled=false;
 const promise=r.listen().then(x=>{settled=true;return x;});
 instances[0].onresult(speechResult('I am flying'));
 await Promise.resolve(); assert.equal(settled,false);
 instances[0].onend(); await new Promise(resolve=>setTimeout(resolve,400));
 assert.equal(instances.length,2); instances[1].onresult(speechResult('to New York'));
 r.stop(); const result=await promise;
 assert.equal(result.transcript,'I am flying to New York');
});
test('cancel settles pending recognition without grading and never restarts',async()=>{
 const {env,instances}=speechEnv();const r=createRecognizer(env);
 const promise=r.listen().catch(e=>e); r.cancel();
 assert.equal((await promise).type,'cancelled');
 await new Promise(resolve=>setTimeout(resolve,400));assert.equal(instances.length,1);
});
test('selected English voice and requested rate reach the native utterance',async()=>{
 let spoken;const voice={voiceURI:'english',lang:'en-US',name:'English'};
 const s=createSpeaker({SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},speechSynthesis:{cancel(){},getVoices:()=>[voice],speak(u){spoken=u;u.onend();}}});
 await s.speak('Hello',{voiceURI:'english',rate:1});assert.equal(spoken.voice,voice);assert.equal(spoken.rate,1);
});
test('interim updates replace text and stop includes the final words',async()=>{
 const {env,instances}=speechEnv();const r=createRecognizer(env);const p=r.listen();
 instances[0].onresult(speechResult('water'));instances[0].onresult(speechResult('water please'));
 r.stop();assert.equal((await p).transcript,'water please');
});
test('permission errors settle without grading and leave no restart',async()=>{
 const {env,instances}=speechEnv();const r=createRecognizer(env);const p=r.listen().catch(e=>e);
 instances[0].onerror({error:'not-allowed'});assert.equal((await p).type,'permission-denied');
 assert.equal(instances.length,1);
});
test('stop during engine restart evaluates accumulated words once',async()=>{
 const {env,instances}=speechEnv();const r=createRecognizer(env);const p=r.listen();
 instances[0].onresult(speechResult('No thanks'));instances[0].onend();r.stop();
 assert.equal((await p).transcript,'No thanks');await new Promise(resolve=>setTimeout(resolve,400));assert.equal(instances.length,1);
});

import {createRecorder} from './src/speech/browserSpeech.js';
test('recording returns actual audio and releases microphone tracks',async()=>{
 let stopped=0;
 class Recorder {static isTypeSupported(){return true;} constructor(){this.state='inactive';this.mimeType='audio/webm';} start(){this.state='recording';} stop(){this.state='inactive';this.ondataavailable({data:new Blob(['audio'])});this.onstop();}}
 const recorder=createRecorder({navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){stopped++;}}]})}},MediaRecorder:Recorder,Blob});
 await recorder.start();const blob=await recorder.stop();assert.equal(blob.size,5);assert.equal(stopped,1);
});
test('cancel while awaiting permission releases the late stream',async()=>{
 let resolve,stopped=0;
 const recorder=createRecorder({navigator:{mediaDevices:{getUserMedia:()=>new Promise(r=>resolve=r)}},MediaRecorder:class{},Blob});
 const pending=recorder.start().catch(e=>e);recorder.cancel();resolve({getTracks:()=>[{stop(){stopped++;}}]});
 assert.equal((await pending).type,'cancelled');assert.equal(stopped,1);
});
