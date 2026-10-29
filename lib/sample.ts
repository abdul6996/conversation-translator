import type { Session, Segment } from './types';
export function sampleSession(): Session {
  const now=Date.now();
  const rows: [string,'person1'|'person2',number,string,string,string,string][] = [
    ['sample-1','person1',0,'English','en','Could you walk me through what happened with the delivery?','Could you walk me through what happened with the delivery?'],
    ['sample-2','person2',8000,'Spanish','es','El paquete llegó el martes, pero faltaban dos cuadernos. Los necesito para el taller del viernes.','The package arrived on Tuesday, but two notebooks were missing. I need them for Friday’s workshop.'],
    ['sample-3','person1',20000,'English','en','I’ll arrange a replacement today. Can you confirm the delivery address?','I’ll arrange a replacement today. Can you confirm the delivery address?'],
    ['sample-4','person2',29000,'Spanish','es','Sí, es la misma dirección. ¿Pueden llegar antes del viernes?','Yes, it’s the same address. Can they arrive before Friday?'],
    ['sample-5','person1',40000,'English','en','I need to check with the delivery team before I can promise Friday. I’ll send you an update tomorrow.','I need to check with the delivery team before I can promise Friday. I’ll send you an update tomorrow.'],
  ];
  const segments: Segment[]=rows.map(([id,speaker,startMs,name,code,original,english])=>({id,speaker,startMs,endMs:startMs+7000,state:'done',result:{segmentId:id,languages:[{name,code}],original,english,status:'transcribed',uncertainty:''}}));
  return {id:crypto.randomUUID(),title:'A delivery, clarified',createdAt:now,updatedAt:now,state:'completed',elapsedMs:51000,segments,sample:true,notesState:'final',notes:{
    summary:'Two notebooks were missing from a delivery. A replacement will be arranged, but arrival before Friday is still unconfirmed.',
    keyPoints:[{text:'Two notebooks are needed for Friday’s workshop.',segmentIds:['sample-2']},{text:'The delivery address has not changed.',segmentIds:['sample-4']}],
    decisions:[{text:'Arrange a replacement for the missing notebooks.',segmentIds:['sample-3']}],
    actions:[{action:'Arrange the replacement.',owner:'Person 1',deadline:'Today',segmentIds:['sample-3']},{action:'Check delivery timing and send an update.',owner:'Person 1',deadline:'Tomorrow',segmentIds:['sample-5']}],
    openQuestions:[{text:'Can the replacement arrive before Friday?',segmentIds:['sample-4','sample-5']}],
  }};
}
