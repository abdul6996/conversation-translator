/** Next.js can normalize request.url to localhost while preserving the actual
 * browser-facing address in Host. Compare against Host, never forwarded headers.
 * This app is loopback-only, so reject other hostnames to prevent DNS rebinding.
 */
export function hasSameOrigin(request: Request): boolean {
  try {
    const internal = new URL(request.url);
    const host = request.headers.get('host') || internal.host;
    const target = new URL(`${internal.protocol}//${host}`);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)) return false;
    const origin = request.headers.get('origin');
    if (!origin) return true;
    return new URL(origin).origin === target.origin;
  } catch { return false; }
}
