# Conversation Translator

A local, single-user proof of concept for two people sharing a microphone. Gemini 3.5 Flash-Lite identifies spoken languages, transcribes the original words, translates into English, and extracts a conversation record.

## Run

Requires Node.js 20.9 or newer and a Google AI Studio API key with access to `gemini-3.5-flash-lite`.

```powershell
npm install
Copy-Item .env.example .env.local
# Set GEMINI_API_KEY in .env.local, then:
npm run dev
```

Open http://127.0.0.1:3000 in desktop Chrome or Edge. The sample conversation works without a key. After changing the key, restart the server and reload the page. Never use a NEXT_PUBLIC environment variable for the key.

## Try a conversation

1. Choose the microphone and Person 1 or Person 2.
2. Select **Start listening** and speak. Short segments are submitted after 700ms of silence or eight seconds of speech.
3. Select the other person before they speak. Buffered audio is flushed under the previous speaker.
4. Pause when needed. Three queued segments automatically pause capture so processing can catch up; resume explicitly when ready.
5. Select **End session** to stop capture, finish processing and finalize notes.
6. Review transcript references, edit the completed record, and export Markdown or JSON. Open saved conversations from the header; deletion requires confirmation.

This is segment-based translation, not the Gemini Live API. It cannot promise instant output or accurate recognition of every language. Long speech may split mid-sentence. The basic energy detector can miss very quiet speech or trigger on noise; use a quiet room and take turns. Sessions are capped at 15 minutes.

## Data and recovery

Completed text and notes are autosaved in IndexedDB on this browser origin. Switching ports, clearing site data, or using another browser does not carry these records over. Raw audio is held in memory for the current page visit, released after success, and retained for failed-segment retries until the page closes or you switch sessions. Reload marks unfinished segments as requiring rerecording.

Audio and transcript context are sent to Google's Gemini API. The application has no server database, audio files, accounts, or cloud synchronization. API interactions request `store: false`; provider processing remains subject to your Gemini account's terms. The local server listens only on 127.0.0.1.

Draft notes update after every three successfully transcribed segments. They use the complete transcript, not prior summaries. Missing or unclear segments are disclosed. Decisions, actions, points and questions cite transcript IDs, which the server validates. Editing a completed record disables automatic replacement of those edits.

## Verification

```powershell
npm run typecheck
npm test
npm run build
```

The core suite checks WAV encoding, silence gating, speaker switching, eight-second splitting, a simulated ten-minute recording, reload recovery, evidence, exports and latency calculations. Browser checks can use synthetic microphone audio and mocked API responses; they do not establish real language quality.

For a live acceptance trial, record reference conversations in English, Spanish, Arabic, Hindi and Mandarin, plus mixed-language speech. Compare original transcripts and English translations against bilingual references, especially names, amounts, dates and negation. Check note evidence and unconfirmed commitments. Run a ten-minute microphone session and inspect request latency in **Processing latency**. Test noisy/quiet audio, permission denial, unplugged microphones, offline recovery, rate limits and invalid keys. Live model accuracy and end-to-end microphone trials require a configured key and suitable audio fixtures.

## Implementation

- Next.js App Router, React, TypeScript, official Radix Themes, Phosphor icons, self-hosted Geist.
- `/api/segments`: WAV plus speaker, timestamps and the previous two transcript entries; validated transcript/translation JSON.
- `/api/notes`: completed entries; validated general conversation record with supporting IDs.
- `/api/health`: configuration status only; never returns a secret.
- Google GenAI SDK Interactions API, configurable model (`GEMINI_MODEL`, default `gemini-3.5-flash-lite`), schema-constrained output and Zod validation.
- AudioWorklet capture and segmentation; mono PCM WAV at the microphone context's sample rate.
- Browser appearance follows the system initially; an explicit light/dark choice is remembered.

Design settings: DESIGN_VARIANCE 5, MOTION_INTENSITY 2, VISUAL_DENSITY 3. Semantic CSS color tokens, one teal accent, 10px panel / 7px button radii. Layer 10 is reserved for the sticky mobile recording bar; Radix manages dialog layers.

Voice output, automatic speaker recognition, multi-device calls, configurable templates and hosting are intentionally deferred.

## Dependency limitation

The verified local build uses Next.js 16.2.10. The package audit reports 3 affected packages (Next.js, PostCSS, and Sharp), including critical Next.js advisories. Attempts to install 16.4.3 and 16.4.1 failed because the configured registry did not provide their matching `@next/env` dependencies. Do not expose this server beyond localhost. Resolve registry access and upgrade to a patched Next.js release, then rerun the audit and build before hosting. No deployment is included in this proof of concept.
