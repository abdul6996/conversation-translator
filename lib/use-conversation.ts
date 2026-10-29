'use client';
import { useEffect, useRef, useState } from 'react';
import { MicrophoneCapture, encodeWav, type AudioChunk } from './audio';
import { newSession, recoverSession, notesSchema, resultSchema, transcriptEntries, type Session, type Speaker } from './types';
import { listSessions, saveSession, deleteSession } from './storage';
import { sampleSession } from './sample';

async function jsonRequest(response: Response) {
  const data = await response.json().catch(()=>({error:'The server returned an unreadable response. Please retry.'}));
  if (!response.ok) throw new Error(data.error || 'The request failed. Please retry.');
  return data;
}
export function useConversation() {
  const [session,setSession]=useState<Session|null>(null);
  const current=useRef<Session|null>(null);
  const [saved,setSaved]=useState<Session[]>([]);
  const [speaker,setSpeaker]=useState<Speaker>('person1');
  const speakerRef=useRef<Speaker>('person1');
  const [devices,setDevices]=useState<MediaDeviceInfo[]>([]);
  const [device,setDevice]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [storageError,setStorageError]=useState('');
  const [busy,setBusy]=useState(false);
  const [starting,setStarting]=useState(false);
  const [notesBusy,setNotesBusy]=useState(false);
  const [announcement,setAnnouncement]=useState('');
  const [configured,setConfigured]=useState<boolean|null>(null);
  const capture=useRef<MicrophoneCapture|null>(null);
  const pending=useRef<string[]>([]);
  const audio=useRef(new Map<string,Blob>());
  const runner=useRef<Promise<void>|null>(null);
  const ending=useRef(false);
  const noteToken=useRef(0);
  const started=useRef(0);
  const baseTime=useRef(0);
  const mounted=useRef(true);

  function commit(update: Session | ((s:Session)=>Session)) {
    const prev=current.current;
    if(typeof update==='function' && !prev)return;
    const next=typeof update==='function'?update(prev!):update;
    current.current={...next,updatedAt:Date.now()};
    if(mounted.current)setSession(current.current);
  }
  const elapsed = () => Math.min(900000,baseTime.current+(started.current?performance.now()-started.current:0));
  async function refreshSaved() {
    try {setSaved(await listSessions());} catch {setStorageError('Browser storage is unavailable. Export this conversation before closing the page.');}
  }
  useEffect(()=>{
    mounted.current=true; commit(newSession()); void refreshSaved();
    fetch('/api/health').then(r=>r.json()).then(d=>setConfigured(d.configured)).catch(()=>setConfigured(null));
    const enumerate=()=>navigator.mediaDevices?.enumerateDevices().then(ds=>setDevices(ds.filter(d=>d.kind==='audioinput'))).catch(()=>{});
    void enumerate(); navigator.mediaDevices?.addEventListener('devicechange',enumerate);
    return ()=>{mounted.current=false;noteToken.current++;navigator.mediaDevices?.removeEventListener('devicechange',enumerate);if(capture.current){capture.current.onSegment=()=>{};void capture.current.stop();}};
  },[]); // The controller intentionally reads mutable refs inside asynchronous callbacks.
  useEffect(()=>{
    if(!session)return;
    const timer=setTimeout(()=>{saveSession(session).then(()=>setSaved(prev=>[session,...prev.filter(s=>s.id!==session.id)].sort((a,b)=>b.updatedAt-a.updatedAt))).catch(()=>setStorageError('Could not save in this browser. Export your conversation before leaving.'));},300);
    return ()=>clearTimeout(timer);
  },[session]);
  useEffect(()=>{
    const timer=setInterval(()=>{
      if(current.current?.state==='recording'){
        const time=elapsed(); commit(s=>({...s,elapsedMs:time}));
        if(time>=900000){setNotice('The 15-minute session limit was reached. Finishing your notes.');void end();}
      }
    },500);
    return()=>clearInterval(timer);
  },[]);
  useEffect(()=>{
    const handler=(e:BeforeUnloadEvent)=>{if(current.current && ['recording','ending'].includes(current.current.state)){e.preventDefault();}};
    window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler);
  },[]);

  async function generateNotes(final=false) {
    const snapshot=current.current;if(!snapshot)return;
    const entries=transcriptEntries(snapshot);
    if(!entries.length){commit(s=>({...s,notes:null,notesState:'empty'}));return;}
    if(snapshot.notesState==='edited')return;
    const token=++noteToken.current;setNotesBusy(true);
    try {
      const response=await fetch('/api/notes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({entries}),signal:AbortSignal.timeout(60000)});
      const notes=notesSchema.parse(await jsonRequest(response));
      if(token===noteToken.current && current.current?.id===snapshot.id)commit(s=>({...s,notes,notesState:final?'final':'draft',notesError:undefined}));
    } catch(e) {if(token===noteToken.current && current.current?.id===snapshot.id)commit(s=>({...s,notesError:e instanceof Error?e.message:'Could not update notes. Please retry.'}));}
    finally {if(token===noteToken.current)setNotesBusy(false);}
  }
  function pump():Promise<void> {
    if(runner.current)return runner.current;
    const run=async()=>{
      setBusy(true);
      try {
        while(pending.current.length){
          const id=pending.current.shift()!;
          const snapshot=current.current;
          const segment=snapshot?.segments.find(s=>s.id===id);
          const blob=audio.current.get(id);
          if(!snapshot||!segment||!blob)continue;
          commit(s=>({...s,segments:s.segments.map(item=>item.id===id?{...item,state:'processing',error:undefined}:item)}));
          const form=new FormData();form.set('audio',blob,'segment.wav');form.set('segmentId',id);form.set('speaker',segment.speaker);form.set('startMs',String(segment.startMs));form.set('endMs',String(segment.endMs));
          form.set('context',JSON.stringify(transcriptEntries(snapshot).filter(e=>snapshot.segments.findIndex(s=>s.id===e.id)<snapshot.segments.findIndex(s=>s.id===id)).slice(-2)));
          const requestStart=performance.now();
          try {
            const result=resultSchema.parse(await jsonRequest(await fetch('/api/segments',{method:'POST',body:form,signal:AbortSignal.timeout(60000)})));
            if(current.current?.id!==snapshot.id)continue;
            audio.current.delete(id);
            commit(s=>({...s,segments:s.segments.map(item=>item.id===id?{...item,state:'done',result,latencyMs:performance.now()-requestStart}:item)}));
            setAnnouncement(result.status==='transcribed'?`${segment.speaker==='person1'?'Person 1':'Person 2'}: ${result.english}`:'A segment could not be transcribed.');
            const completed=transcriptEntries(current.current!).length;
            if(completed>0 && completed%3===0 && !ending.current && current.current!.notesState!=='edited')void generateNotes();
          } catch(e) {
            if(current.current?.id===snapshot.id)commit(s=>({...s,segments:s.segments.map(item=>item.id===id?{...item,state:'failed',error:e instanceof Error?e.message:'Processing failed. Please retry.'}:item)}));
          }
        }
      } finally {setBusy(false);}
    };
    runner.current=run().finally(()=>{runner.current=null;});return runner.current;
  }
  function enqueue(chunk:AudioChunk) {
    if(!mounted.current||!current.current)return;
    const id=crypto.randomUUID();audio.current.set(id,new Blob([encodeWav(chunk.samples,chunk.sampleRate)],{type:'audio/wav'}));
    commit(s=>({...s,segments:[...s.segments,{id,speaker:chunk.speaker,startMs:chunk.startMs,endMs:chunk.endMs,state:'queued'}]}));
    pending.current.push(id);void pump();
    if(pending.current.length>=3 && current.current.state==='recording'){
      setNotice('Processing needs a moment to catch up. Recording is paused; select Resume when ready.');void pause();
    }
  }
  async function start() {
    if(starting||capture.current||!current.current||['completed','ending'].includes(current.current.state))return;
    if(current.current.elapsedMs>=900000){setNotice('This session reached 15 minutes. Start a new conversation.');return;}
    setStarting(true);setError('');setNotice('');
    const mic=new MicrophoneCapture();capture.current=mic;
    const sessionId=current.current.id;
    baseTime.current=current.current.elapsedMs;
    mic.onSegment=enqueue;mic.onLevel=level=>document.documentElement.style.setProperty('--mic-level',String(level));mic.onDisconnected=()=>{setError('The microphone disconnected. Reconnect it, then resume.');void pause();};
    try {
      await mic.start(device,speakerRef.current,baseTime.current);
      if(current.current?.id!==sessionId||capture.current!==mic)return;
      started.current=performance.now();commit(s=>({...s,state:'recording'}));
      const ds=await navigator.mediaDevices.enumerateDevices();setDevices(ds.filter(d=>d.kind==='audioinput'));
    } catch(e) {
      capture.current=null;
      const name=(e as DOMException).name;
      setError(name==='NotAllowedError'?'Microphone access was denied. Allow microphone access in your browser, then try again.':name==='NotFoundError'?'No microphone was found. Connect a microphone and try again.':name==='OverconstrainedError'?'That microphone is unavailable. Choose another microphone.':'Could not start the microphone. Check browser permissions and try again.');
    } finally {setStarting(false);}
  }
  async function pause() {
    const mic=capture.current;if(!mic)return;
    capture.current=null;
    const time=elapsed();started.current=0;baseTime.current=time;
    commit(s=>({...s,state:ending.current?'ending':'paused',elapsedMs:time}));
    await mic.stop();
  }
  async function end() {
    if(!current.current||ending.current)return;
    ending.current=true;commit(s=>({...s,state:'ending'}));
    await pause();await pump();
    await generateNotes(true);
    commit(s=>({...s,state:'completed'}));ending.current=false;
  }
  function changeSpeaker(next:Speaker) {capture.current?.switchSpeaker(next);speakerRef.current=next;setSpeaker(next);}
  function canNavigate() {return !capture.current&&!runner.current&&!ending.current&&!starting;}
  async function changeSession(next?:Session) {
    if(!canNavigate())return;
    noteToken.current++;setNotesBusy(false);audio.current.clear();pending.current=[];
    if(current.current)await saveSession(current.current).catch(()=>setStorageError('Could not save the previous session.'));
    commit(next?recoverSession(next):newSession());setSpeaker('person1');speakerRef.current='person1';setError('');setNotice('');baseTime.current=next?.elapsedMs??0;
  }
  async function remove(id:string) {
    if(!canNavigate())return;
    try {
      await deleteSession(id);
      if(current.current?.id===id){noteToken.current++;audio.current.clear();commit(newSession());}
      setSaved(prev=>prev.filter(s=>s.id!==id));
    } catch {setStorageError('Could not delete this conversation. Please try again.');}
  }
  function retry(id:string) {
    if(!audio.current.has(id)||pending.current.includes(id))return;
    commit(s=>({...s,segments:s.segments.map(item=>item.id===id?{...item,state:'queued',error:undefined}:item)}));
    pending.current.push(id);pending.current.sort((a,b)=>current.current!.segments.findIndex(s=>s.id===a)-current.current!.segments.findIndex(s=>s.id===b));void pump();
  }
  function editNotes(notes:Session['notes']) {if(current.current?.state==='completed')commit(s=>({...s,notes,notesState:'edited'}));}
  return {session,saved,speaker,devices,device,setDevice,error,notice,storageError,busy,starting,notesBusy,announcement,configured,start,pause,end,changeSpeaker,changeSession,remove,retry,editNotes,
    rename:(title:string)=>commit(s=>({...s,title})),
    loadSample:()=>changeSession(sampleSession()),
    retryNotes:()=>generateNotes(current.current?.state==='completed'),
    canRetry:(id:string)=>audio.current.has(id),
  };
}
