// Independent PCM WAV files avoid MediaRecorder chunks that lack container headers.
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => [...value].forEach((char,i) => view.setUint8(offset+i,char.charCodeAt(0)));
  text(0,'RIFF'); view.setUint32(4,buffer.byteLength-8,true); text(8,'WAVE'); text(12,'fmt ');
  view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true);
  view.setUint32(24,sampleRate,true); view.setUint32(28,sampleRate*2,true); view.setUint16(32,2,true); view.setUint16(34,16,true);
  text(36,'data'); view.setUint32(40,samples.length*2,true);
  samples.forEach((sample,i) => { const v=Math.max(-1,Math.min(1,sample)); view.setInt16(44+i*2,v<0?v*32768:v*32767,true); });
  return buffer;
}
export type AudioChunk = { samples: Float32Array; sampleRate: number; startMs: number; endMs: number; speaker: 'person1'|'person2' };
export class MicrophoneCapture {
  private stream?: MediaStream;
  private context?: AudioContext;
  private node?: AudioWorkletNode;
  private source?: MediaStreamAudioSourceNode;
  private muted?: GainNode;
  private stopped = false;
  onSegment: (chunk: AudioChunk) => void = () => {};
  onLevel: (level: number) => void = () => {};
  onDisconnected: () => void = () => {};
  async start(deviceId: string, speaker: 'person1'|'person2', offsetMs: number) {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: deviceId ? {exact:deviceId} : undefined, channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      if (this.stopped) { this.stream.getTracks().forEach(t=>t.stop()); return; }
      this.context = new AudioContext();
      await this.context.audioWorklet.addModule('/audio-worklet.js');
      if (this.stopped) { await this.stop(); return; }
      this.node = new AudioWorkletNode(this.context,'conversation-capture');
      this.node.port.onmessage = e => {
        if (e.data.type === 'segment') this.onSegment(e.data.chunk);
        if (e.data.type === 'level') this.onLevel(e.data.level);
      };
      this.node.port.postMessage({type:'configure',speaker,offsetMs});
      this.source = this.context.createMediaStreamSource(this.stream);
      this.muted = this.context.createGain(); this.muted.gain.value=0;
      this.source.connect(this.node); this.node.connect(this.muted); this.muted.connect(this.context.destination);
      this.stream.getTracks().forEach(t=>t.onended=()=>{ if (!this.stopped) this.onDisconnected(); });
      await this.context.resume();
    } catch (error) { await this.stop(); throw error; }
  }
  switchSpeaker(speaker: 'person1'|'person2') { this.node?.port.postMessage({type:'speaker',speaker}); }
  async stop() {
    this.stopped = true;
    if (this.node && this.context?.state === 'running') {
      const node = this.node;
      await new Promise<void>(resolve => {
        const timeout=setTimeout(resolve,600);
        const handler = (e: MessageEvent) => { if (e.data.type==='flushed') { clearTimeout(timeout); node.port.removeEventListener('message',handler); resolve(); } };
        node.port.addEventListener('message',handler); node.port.postMessage({type:'stop'});
      });
    }
    this.stream?.getTracks().forEach(t=>t.stop());
    this.source?.disconnect(); this.node?.disconnect(); this.muted?.disconnect();
    if (this.context && this.context.state!=='closed') await this.context.close();
    this.node=undefined; this.onLevel(0);
  }
}
