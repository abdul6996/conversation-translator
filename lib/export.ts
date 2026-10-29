import { latencyStats, type Session } from './types';
export function timeLabel(ms: number) { return `${Math.floor(ms/60000).toString().padStart(2,'0')}:${Math.floor(ms/1000%60).toString().padStart(2,'0')}`; }
export function markdown(session: Session) {
  const n = session.notes;
  const missing = session.segments.filter(s => s.state !== 'done' || s.result?.status === 'unclear').length;
  const lines = [`# ${session.title}`, '', new Date(session.createdAt).toLocaleString(), session.sample ? '\nSample conversation. Not a live recording.' : '', `\nDuration: ${timeLabel(session.elapsedMs)}`, `Record status: ${session.notesState}`, missing ? `\nIncomplete record: ${missing} segment(s) missing or unclear.` : ''];
  if (n) {
    lines.push('\n## Summary',n.summary,'\n## Key points',...n.keyPoints.map(p=>`- ${p.text} [${p.segmentIds.join(', ')}]`),'\n## Decisions',...n.decisions.map(p=>`- ${p.text} [${p.segmentIds.join(', ')}]`),'\n## Action items',...n.actions.map(p=>`- ${p.action} | Owner: ${p.owner || 'Not stated'} | Deadline: ${p.deadline || 'Not stated'} [${p.segmentIds.join(', ')}]`),'\n## Open questions',...n.openQuestions.map(p=>`- ${p.text} [${p.segmentIds.join(', ')}]`));
  }
  lines.push('\n## Transcript');
  for (const s of session.segments) lines.push(`\n### ${s.speaker==='person1'?'Person 1':'Person 2'} | ${timeLabel(s.startMs)} | ${s.id}`,s.result?.original || s.error || s.state,s.result?.english ? `English: ${s.result.english}` : '',s.result?.uncertainty || '');
  const stats = latencyStats(session.segments);
  if (stats) lines.push(`\nProcessing latency (excludes capture): median ${(stats.median/1000).toFixed(1)}s, slowest ${(stats.slowest/1000).toFixed(1)}s.`);
  return lines.join('\n');
}
export function downloadSession(session: Session, format: 'json'|'md') {
  const content = format === 'json' ? JSON.stringify({ ...session, latency: latencyStats(session.segments) },null,2) : markdown(session);
  const url = URL.createObjectURL(new Blob([content],{type: format==='json'?'application/json':'text/markdown;charset=utf-8'}));
  const a = document.createElement('a'); a.href=url; a.download=`${session.title.replace(/[^\p{L}\p{N} -]/gu,'').trim() || 'conversation'}.${format}`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
