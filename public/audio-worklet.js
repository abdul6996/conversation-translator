/* Runs off the UI thread. Times are captured-audio offsets, excluding pauses. */
class ConversationCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.speaker='person1'; this.offsetMs=0; this.cursor=0; this.start=0;
    this.frames=[]; this.length=0; this.silence=0; this.speech=0;
    this.preroll=[]; this.prerollLength=0; this.enabled=true; this.levelFrames=0;
    this.port.onmessage=({data})=>{
      if(data.type==='configure'){this.speaker=data.speaker;this.offsetMs=data.offsetMs;}
      if(data.type==='speaker'){this.flush();this.speaker=data.speaker;this.preroll=[];this.prerollLength=0;}
      if(data.type==='stop'){this.flush();this.enabled=false;this.port.postMessage({type:'flushed'});}
    };
  }
  flush(){
    if(this.length && this.speech>=sampleRate*0.15){
      const samples=new Float32Array(this.length);let position=0;
      for(const frame of this.frames){samples.set(frame,position);position+=frame.length;}
      this.port.postMessage({type:'segment',chunk:{samples,sampleRate,startMs:this.offsetMs+this.start/sampleRate*1000,endMs:this.offsetMs+this.cursor/sampleRate*1000,speaker:this.speaker}},[samples.buffer]);
    }
    this.frames=[];this.length=0;this.silence=0;this.speech=0;
  }
  process(inputs){
    if(!this.enabled)return true;
    const input=inputs[0]?.[0];if(!input)return true;
    let energy=0;for(const v of input)energy+=v*v;
    const rms=Math.sqrt(energy/input.length);const speaking=rms>0.012;
    if(++this.levelFrames%16===0)this.port.postMessage({type:'level',level:Math.min(1,rms*9)});
    const frame=new Float32Array(input);
    if(!this.length && !speaking){
      this.preroll.push(frame);this.prerollLength+=frame.length;
      while(this.prerollLength>sampleRate*0.15 && this.preroll.length>1)this.prerollLength-=this.preroll.shift().length;
      this.cursor+=frame.length;return true;
    }
    if(!this.length){this.start=this.cursor-this.prerollLength;this.frames=this.preroll;this.length=this.prerollLength;this.preroll=[];this.prerollLength=0;}
    this.frames.push(frame);this.length+=frame.length;this.cursor+=frame.length;
    if(speaking){this.silence=0;this.speech+=frame.length;}else this.silence+=frame.length;
    if(this.silence>=sampleRate*0.7 || this.length>=sampleRate*8)this.flush();
    return true;
  }
}
registerProcessor('conversation-capture',ConversationCapture);
