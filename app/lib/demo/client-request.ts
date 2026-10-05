/** Bounded demo requests. Mutations are NEVER retried automatically: a timeout
 * is not proof that a save, reset or email did not reach the server. */
export class DemoRequestError extends Error {
  constructor(message: string, public readonly status = 0, public readonly code = 'demo_network') {
    super(message); this.name = 'DemoRequestError';
  }
}
export async function demoRequest<T>(url: string, init: RequestInit = {}, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (init.signal?.aborted) controller.abort();
  init.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetch(url, { ...init, cache: 'no-store', signal: controller.signal });
    const body: unknown = await response.json().catch(() => null);
    const record = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
    if (!response.ok) throw new DemoRequestError(
      typeof record?.error === 'string' ? record.error : 'The demo could not complete that request. Please try again.',
      response.status, typeof record?.code === 'string' ? record.code : 'demo_request');
    if (!record) throw new DemoRequestError('The demo returned an unexpected response. Please try again.', 502, 'demo_response');
    return body as T;
  } catch (error) {
    if (error instanceof DemoRequestError) throw error;
    if (init.signal?.aborted) throw error; // caller cancellation is not an error message
    if (timedOut) throw new DemoRequestError('The demo is taking longer than expected. Check your connection and try again.', 0, 'demo_timeout');
    throw new DemoRequestError('Could not reach the demo. Check your connection and try again.');
  } finally {
    clearTimeout(timer); init.signal?.removeEventListener('abort', abort);
  }
}
export function demoJsonRequest(value: unknown): RequestInit {
  return { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) };
}
/** Accept only this workspace's internal navigation, never a protocol URL. */
export function safeDemoHref(value: unknown, slug: string): value is string {
  if (typeof value !== 'string' || !value.startsWith('/') || !/^demo-[a-z0-9-]+$/i.test(slug)) return false;
  const root = `/${slug}`;
  if (/[\\\r\n]/.test(value) || value.startsWith('//')) return false;
  try {
    const url = new URL(value, 'https://demo.invalid');
    return url.origin === 'https://demo.invalid' && (url.pathname === root || url.pathname.startsWith(`${root}/`));
  } catch { return false; }
}
