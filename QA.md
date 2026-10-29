# Verification record

## Flash-Lite live verification

The app now defaults to `gemini-3.5-flash-lite`, configurable through `GEMINI_MODEL` in `.env.local`. The existing key was preserved. Health and generation both read the same model setting.

Live API checks passed on 2026-10-28 through the actual local production server:

- English audio, generated offline with Windows speech synthesis: exact transcription of "The order is for two notebooks, not three. Please send them by Friday." Preserved quantity, negation and deadline. Request time: 9.493 seconds.
- French audio from [Google's public speech codelab](https://codelabs.developers.google.com/codelabs/cloud-speech-text-python3/), cropped to 7.5 seconds: automatically detected French, transcribed the crow-and-cheese passage, and translated into English. Request time: 8.373 seconds. One earlier request returned a temporary 503; a later retry succeeded.
- Conversation notes: captured the notebook quantity and dispatch commitment, kept the unstated action owner null, left decisions empty, and cited valid transcript IDs. Request time: 5.445 seconds.
- A separate mixed Spanish/English transcript also produced notes and an action successfully.
- All 18 automated tests and the production build passed.

The first notes request exposed excessive nested JSON Schema bounds, which Gemini rejected. Generation now receives a simplified shape schema while the complete Zod constraints still validate responses on the server. Two regression tests cover this behavior.

Full successful results were saved locally in the ignored `live-test-results.json`. To generate a new report with suitable WAV fixtures, use `node scripts/live-smoke.mjs path/to/english.wav path/to/french.wav`. `--resume` reuses completed checks to avoid repeating requests. These live checks consume the configured project's model quota. The multilingual test covers French, not every supported language.

The sections below preserve the original pre-key verification history.

Verified on 2026-10-28 using desktop Chrome with synthetic microphone audio. No Gemini API key was configured during verification.

## Passed

- TypeScript checking and an optimized production build.
- Nine core tests: PCM WAV encoding, silence rejection, silence-boundary segmentation, speaker-switch flushing, eight-second splitting, ten-minute simulated capture, interrupted-session recovery, exports, evidence and latency calculations.
- Actual browser microphone pipeline using a synthetic WAV input: start, select speaker, pause, flush, end, process and finalize mocked notes.
- Mocked Gemini rate limit: failed audio remained retryable, retry used the same segment ID and updated the existing entry.
- Queue backpressure: three waiting segments paused recording and exposed Resume.
- Denied microphone permission: readable error with an enabled retry control.
- Missing Gemini key: server returned a helpful 503 response without exposing secrets.
- Cross-origin API request rejected with 403.
- Sample notes edited, JSON export downloaded and inspected, browser reload, and saved conversation reopened with edits intact.
- Delete cancellation preserved the saved rows; confirmed deletion removed one row.
- Transcript references navigated to the supporting entry, including switching mobile tabs.
- Light and dark themes visually inspected. At 390px and 320px widths there was no horizontal page overflow.
- The primary light-theme button uses RGB(35,120,110) with near-white text, replacing the brighter default teal for contrast.
- No uncaught browser errors in the main workspace checks.

## Not established

- Real Gemini model access, translation quality, model latency, or multilingual recognition accuracy. These require your API key and bilingual reference recordings.
- A real ten-minute human microphone conversation. The ten-minute duration was tested against the actual worklet with generated PCM frames.
- All language-pair combinations, unusual hardware, quiet/noisy rooms or cross-browser compatibility beyond the documented desktop target.
- Patched dependency availability. The audit found 3 affected packages; attempted framework upgrades could not resolve their companion packages from the registry. See README before any hosting.

The sample is explicitly labeled and is not presented as live translation. Mocked model output was used only in the isolated browser checks.

## Same-origin regression fix

The first real in-app recording exposed a server-origin bug missed by the mocked browser tests: Next normalized `request.url` to `localhost`, while the browser used `127.0.0.1`. The guard now compares Origin with the browser-facing Host header and restricts that host to loopback. Six regression tests cover this normalization, localhost, differing ports, unrelated/null origins, DNS rebinding and spoofed forwarded headers. All 15 tests, TypeScript and the production build pass after the fix. A prominent missing-key notice was also added; a Gemini key is still required for actual translation.
