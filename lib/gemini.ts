import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { hasSameOrigin } from './request-origin';
import { getGeminiModel } from './model';
import { generationSchema } from './generation-schema';

export class RequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function generateStructured<T extends z.ZodType>(schema: T, prompt: string, audio?: string): Promise<z.infer<T>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new RequestError('Add GEMINI_API_KEY to .env.local, then restart the app. Your recording is available to retry.', 503);
  const client = new GoogleGenAI({ apiKey, httpOptions: { timeout: 55000 } });
  const signal = AbortSignal.timeout(45000);
  const interaction = await client.interactions.create({
    model: getGeminiModel(),
    input: audio ? [{ type: 'text', text: prompt }, { type: 'audio', data: audio, mime_type: 'audio/wav' }] : prompt,
    response_format: { type: 'text', mime_type: 'application/json', schema: generationSchema(z.toJSONSchema(schema)) as Record<string, unknown> },
    generation_config: { thinking_level: 'low', max_output_tokens: audio ? 4096 : 8192 },
    store: false,
  }, { timeout_ms: 45000, signal, retries: { strategy: 'none' } }).catch(error => {
    if (signal.aborted) throw new RequestError('Gemini took too long to respond. Your audio is preserved for retry; please try again shortly.', 504);
    throw error;
  });
  const text = interaction.output_text;
  if (!text) throw new RequestError('Gemini returned no usable text. Retry this request.', 502);
  try { return schema.parse(JSON.parse(text)); }
  catch { throw new RequestError('Gemini returned an invalid response. Your existing content is safe. Please retry.', 502); }
}
export function errorResponse(error: unknown) {
  if (error instanceof RequestError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: 'The request data is invalid.' }, { status: 400 });
  const details = error as { status?: number; statusCode?: number; name?: string };
  const code = Number(details?.status ?? details?.statusCode);
  const timedOut = ['TimeoutError', 'RequestTimeoutError', 'AbortError', 'RequestAbortedError'].includes(details?.name ?? '');
  const message = timedOut ? 'Gemini took too long to respond. Your audio is preserved for retry; please try again shortly.' : code === 429 ? 'Gemini is rate limited. Wait a moment, then retry.' : code === 503 ? `${getGeminiModel()} is busy due to high demand. Your audio is preserved for retry. Please try again shortly.` : code === 401 || code === 403 ? 'The Gemini key was rejected or cannot access this model. Check your Google AI Studio project.' : code === 404 ? `${getGeminiModel()} is not available for this API key. Check model access in Google AI Studio.` : 'Gemini could not complete the request. Check your connection and retry.';
  return Response.json({ error: message }, { status: timedOut ? 504 : code === 429 ? 429 : code === 503 ? 503 : 502 });
}
export function sameOrigin(request: Request) {
  if (!hasSameOrigin(request)) throw new RequestError('Cross-origin requests are not allowed.', 403);
}
