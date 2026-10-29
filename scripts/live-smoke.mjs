import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const base='http://127.0.0.1:3000';
const audioPath=process.argv[2];
if(!audioPath)throw new Error('Usage: node scripts/live-smoke.mjs path/to/english-test.wav [path/to/french-test.wav]');
const resume=process.argv.includes('--resume');
const report=resume?JSON.parse(await readFile('live-test-results.json','utf8')):{testedAt:new Date().toISOString(),checks:[]};
delete report.error;
report.lastRunAt=new Date().toISOString();
async function checkpoint(){await writeFile('live-test-results.json',JSON.stringify(report,null,2)+'\n');}
async function post(path,body,isForm=false){
  const start=performance.now();
  const response=await fetch(base+path,{method:'POST',headers:isForm?{Origin:base}:{Origin:base,'Content-Type':'application/json'},body:isForm?body:JSON.stringify(body),signal:AbortSignal.timeout(55000)});
  const data=await response.json();
  if(!response.ok)throw new Error(`${path}: HTTP ${response.status}: ${data.error}`);
  return {data,latencyMs:Math.round(performance.now()-start)};
}
async function segment(path,id){
  const form=new FormData();form.set('audio',new Blob([await readFile(path)],{type:'audio/wav'}),'test.wav');
  form.set('segmentId',id);form.set('speaker','person2');form.set('startMs','0');form.set('endMs','8000');form.set('context','[]');
  return post('/api/segments',form,true);
}
try{
  const health=await(await fetch(base+'/api/health')).json();assert.equal(health.model,'gemini-3.5-flash-lite');assert.equal(health.configured,true);report.health=health;
  const previousEnglish=report.checks.find(c=>c.name.startsWith('English audio:'));
  const english=previousEnglish??await segment(audioPath,'live-english');
  assert.equal(english.data.status,'transcribed');assert.ok(english.data.languages.some(l=>l.code.startsWith('en')));
  assert.match(english.data.english,/two|2/i);assert.match(english.data.english,/not (three|3)/i);assert.match(english.data.english,/Friday/i);
  if(!previousEnglish)report.checks.push({name:'English audio: language, transcription, quantity, negation, deadline',passed:true,...english});
  await checkpoint();console.log('English audio check passed.');
  if(process.argv[3]&&process.argv[3]!=='--resume'&&!report.checks.some(c=>c.name.startsWith('French audio:'))){
    const french=await segment(process.argv[3],'live-french');
    assert.equal(french.data.status,'transcribed');assert.ok(french.data.languages.some(l=>l.code.startsWith('fr')));
    assert.match(french.data.original,/corbeau/i);assert.match(french.data.original,/fromage/i);assert.match(french.data.english,/crow|raven/i);assert.match(french.data.english,/cheese/i);
    report.checks.push({name:'French audio: automatic detection, original transcript and English translation',passed:true,...french});
    await checkpoint();console.log('French audio translation check passed.');
  }
  const entries=[{id:'live-question',speaker:'person1',original:'What is the order and deadline?',english:'What is the order and deadline?'},{id:'live-english',speaker:'person2',original:english.data.original,english:english.data.english},{id:'live-commitment',speaker:'person1',original:'I will confirm dispatch tomorrow.',english:'I will confirm dispatch tomorrow.'}];
  const notes=await post('/api/notes',{entries});
  assert.ok(notes.data.summary.length>0);
  const ids=new Set(entries.map(e=>e.id));
  for(const p of [...notes.data.keyPoints,...notes.data.decisions,...notes.data.actions,...notes.data.openQuestions])assert.ok(p.segmentIds.length&&p.segmentIds.every(id=>ids.has(id)));
  assert.ok(notes.data.actions.some(a=>/confirm|dispatch/i.test(a.action)));
  report.checks.push({name:'Notes: structured extraction, action capture and valid evidence',passed:true,...notes});
  console.log(JSON.stringify({success:true,checks:report.checks.map(c=>({name:c.name,latencyMs:c.latencyMs})),english:english.data.english}));
}catch(error){report.error=error.message;console.log(JSON.stringify({success:false,error:error.message,completedChecks:report.checks.map(c=>c.name)}));process.exitCode=1;}
await writeFile('live-test-results.json',JSON.stringify(report,null,2)+'\n');
