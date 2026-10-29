import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { encodeWav } from '../lib/audio';
import { recoverSession, latencyStats, notesSchema } from '../lib/types';
import { sampleSession } from '../lib/sample';
import { markdown } from '../lib/export';

test('each segment is an independent mono PCM WAV with clamped samples',()=>{
  const buffer=encodeWav(new Float32Array([-2,-1,0,1,2]),16000);const view=new DataView(buffer);
  assert.equal(Buffer.from(buffer).toString('ascii',0,4),'RIFF');
  assert.equal(view.getUint32(24,true),16000);assert.equal(view.getUint32(40,true),10);
  assert.equal(view.getInt16(44,true),-32768);assert.equal(view.getInt16(52,true),32767);
});
function processor() {
  let Capture:any;let messages:any[]=[];
  class Base {port={onmessage:null as any,postMessage:(message:any)=>messages.push(message)};}
  vm.runInNewContext(fs.readFileSync('public/audio-worklet.js','utf8'),{AudioWorkletProcessor:Base,sampleRate:16000,Float32Array,Math,registerProcessor:(_:string,type:any)=>Capture=type});
  const worklet=new Capture();
  const feed=(seconds:number,amplitude:number)=>{for(let i=0;i<Math.ceil(seconds*16000/128);i++)worklet.process([[new Float32Array(128).fill(amplitude)]]);};
  return {worklet,messages,feed};
}
test('silence does not generate audio segments',()=>{const p=processor();p.feed(10,0);assert.equal(p.messages.filter(m=>m.type==='segment').length,0);});
test('700ms of silence flushes speech and switching preserves old speaker',()=>{
  const p=processor();p.feed(.4,.1);p.feed(.71,0);
  const first=p.messages.find(m=>m.type==='segment');assert.ok(first);assert.equal(first.chunk.speaker,'person1');
  p.feed(.4,.1);p.worklet.port.onmessage({data:{type:'speaker',speaker:'person2'}});
  p.feed(.4,.1);p.worklet.port.onmessage({data:{type:'stop'}});
  const chunks=p.messages.filter(m=>m.type==='segment');assert.equal(chunks.length,3);assert.equal(chunks[1].chunk.speaker,'person1');assert.equal(chunks[2].chunk.speaker,'person2');assert.equal(p.messages.at(-1).type,'flushed');
});
test('continuous speech splits at eight seconds without losing sample counts',()=>{
  const p=processor();p.feed(16,.1);p.worklet.port.onmessage({data:{type:'stop'}});
  const chunks=p.messages.filter(m=>m.type==='segment');assert.equal(chunks.length,2);assert.equal(chunks.reduce((sum,m)=>sum+m.chunk.samples.length,0),256000);
});
test('ten-minute capture stays bounded and preserves every speech frame',()=>{
  const p=processor();p.feed(600,.1);p.worklet.port.onmessage({data:{type:'stop'}});
  const chunks=p.messages.filter(m=>m.type==='segment');assert.equal(chunks.length,75);assert.equal(chunks.reduce((sum,m)=>sum+m.chunk.samples.length,0),9_600_000);assert.ok(chunks.every(m=>m.chunk.samples.length<=128000));
});
test('reload recovers interrupted processing without claiming audio is retained',()=>{
  const s=sampleSession();s.state='recording';s.segments[0].state='processing';s.segments[1].state='failed';
  const recovered=recoverSession(s);assert.equal(recovered.state,'paused');assert.equal(recovered.segments[0].state,'interrupted');assert.equal(recovered.segments[1].state,'interrupted');assert.match(recovered.segments[0].error!,/rerecord/);
});
test('exports contain original text, evidence, missing-segment disclosure and edited notes',()=>{
  const s=sampleSession();s.notesState='edited';s.notes!.summary='A reviewed summary';s.segments[0].state='interrupted';
  const output=markdown(s);assert.match(output,/A reviewed summary/);assert.match(output,/Incomplete record/);assert.match(output,/El paquete/);assert.match(output,/sample-2/);assert.match(output,/Record status: edited/);
});
test('latency is based only on measured request durations',()=>{
  const s=sampleSession();assert.equal(latencyStats(s.segments),null);
  s.segments[0].latencyMs=500;s.segments[1].latencyMs=1500;assert.deepEqual(latencyStats(s.segments),{median:1000,slowest:1500,count:2});
});
test('sample notes have valid evidence and do not promise unconfirmed Friday delivery',()=>{
  const s=sampleSession();assert.ok(notesSchema.safeParse(s.notes).success);const ids=new Set(s.segments.map(s=>s.id));
  for(const p of [...s.notes!.keyPoints,...s.notes!.decisions,...s.notes!.actions,...s.notes!.openQuestions])assert.ok(p.segmentIds.every(id=>ids.has(id)));
  assert.match(s.notes!.summary,/unconfirmed/);
});
