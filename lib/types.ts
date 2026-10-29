import { z } from 'zod';

export const speakerSchema = z.enum(['person1', 'person2']);
export type Speaker = z.infer<typeof speakerSchema>;
export const resultSchema = z.object({
  segmentId: z.string(),
  languages: z.array(z.object({ code: z.string(), name: z.string() })).max(12),
  original: z.string().max(16000),
  english: z.string().max(16000),
  status: z.enum(['transcribed', 'no_speech', 'unclear']),
  uncertainty: z.string().max(1000),
});
export type SegmentResult = z.infer<typeof resultSchema>;
export type Segment = {
  id: string; speaker: Speaker; startMs: number; endMs: number;
  state: 'queued' | 'processing' | 'done' | 'failed' | 'interrupted';
  result?: SegmentResult; error?: string; latencyMs?: number;
};
const evidence = z.array(z.string()).min(1).max(100);
const point = z.object({ text: z.string().max(4000), segmentIds: evidence });
export const notesSchema = z.object({
  summary: z.string().max(12000),
  keyPoints: z.array(point).max(100),
  decisions: z.array(point).max(100),
  actions: z.array(z.object({ action: z.string().max(4000), owner: z.string().nullable(), deadline: z.string().nullable(), segmentIds: evidence })).max(100),
  openQuestions: z.array(point).max(100),
});
export type Notes = z.infer<typeof notesSchema>;
export type Session = {
  id: string; title: string; createdAt: number; updatedAt: number;
  state: 'idle' | 'recording' | 'paused' | 'ending' | 'completed';
  elapsedMs: number; segments: Segment[]; notes: Notes | null;
  notesState: 'empty' | 'draft' | 'final' | 'edited';
  notesError?: string; sample?: boolean;
};
export const contextSchema = z.array(z.object({
  id: z.string().max(100), speaker: speakerSchema,
  original: z.string().max(16000), english: z.string().max(16000),
})).max(2);
export const noteInputSchema = z.object({
  entries: z.array(z.object({
    id: z.string().min(1).max(100), speaker: speakerSchema,
    original: z.string().max(16000), english: z.string().max(16000),
  })).min(1).max(2000),
});
export function transcriptEntries(session: Session) {
  return session.segments.filter(s => s.state === 'done' && s.result?.status === 'transcribed').map(s => ({ id: s.id, speaker: s.speaker, original: s.result!.original, english: s.result!.english }));
}
export function newSession(): Session {
  const now = Date.now();
  return { id: crypto.randomUUID(), title: 'Untitled conversation', createdAt: now, updatedAt: now, state: 'idle', elapsedMs: 0, segments: [], notes: null, notesState: 'empty' };
}
export function recoverSession(session: Session): Session {
  return { ...session, state: ['recording', 'ending'].includes(session.state) ? 'paused' : session.state,
    segments: session.segments.map(s => ['queued', 'processing', 'failed'].includes(s.state) ? { ...s, state: 'interrupted', error: 'Audio is no longer available. Please rerecord this part.' } : s) };
}
export function latencyStats(segments: Segment[]) {
  const times = segments.flatMap(s => s.latencyMs === undefined ? [] : [s.latencyMs]).sort((a,b) => a-b);
  if (!times.length) return null;
  const middle = Math.floor(times.length / 2);
  return { median: times.length % 2 ? times[middle] : (times[middle-1]+times[middle])/2, slowest: times[times.length-1], count: times.length };
}
