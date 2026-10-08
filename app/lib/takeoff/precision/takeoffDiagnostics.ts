// Mobile takeoff M9: lightweight in-memory client diagnostics (owner runs).
//
// The owner tests on a real iPhone where we cannot attach a console. This
// module keeps a bounded in-memory ring buffer (200 events) of recent user
// actions, errors, and failed fetches/server actions (URL + status), plus
// uncaught errors/rejections, for the touch takeoff presentation. The
// hamburger menu's "Send diagnostics" action POSTs the buffer to
// /api/takeoff-diagnostics (auth-required, service-role insert into the
// takeoff_diagnostics table, patch_054) and shows the returned reference id
// so the owner can just say "diagnostics sent" and we can pull the payload.
//
// Everything here is best-effort: no throw may escape, no storage, no network
// (except the explicit send).

export interface TakeoffDiagnosticEvent {
  /** ISO timestamp. */
  t: string;
  type: string;
  detail?: unknown;
}

const MAX_EVENTS = 200;

const buffer: TakeoffDiagnosticEvent[] = [];

function push(type: string, detail?: unknown) {
  try {
    buffer.push({ t: new Date().toISOString(), type, detail });
    if (buffer.length > MAX_EVENTS) buffer.splice(0, buffer.length - MAX_EVENTS);
  } catch {
    /* never throw */
  }
}

/** Record a user action / lifecycle event (e.g. 'outline.save.start'). */
export function logTakeoffEvent(type: string, detail?: unknown): void {
  push(type, detail);
}

export function getTakeoffDiagnosticEvents(): readonly TakeoffDiagnosticEvent[] {
  return buffer;
}

export interface TakeoffDiagnosticsSnapshot {
  events: readonly TakeoffDiagnosticEvent[];
  userAgent: string;
  url: string;
  capturedAt: string;
}

export function getTakeoffDiagnosticsSnapshot(): TakeoffDiagnosticsSnapshot {
  return {
    events: buffer.slice(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Install global capture hooks (window errors, unhandled rejections, failed
 * fetches with URL + status). Safe to call repeatedly — only installs once.
 * Returns a no-op cleanup for symmetry; the hooks intentionally persist for
 * the page lifetime (diagnostics must survive the error that motivates them).
 */
export function installTakeoffDiagnostics(): () => void {
  if (typeof window === 'undefined') return () => {};
  const w = window as typeof window & { __takeoffDiagInstalled?: boolean };
  if (w.__takeoffDiagInstalled) return () => {};
  w.__takeoffDiagInstalled = true;

  window.addEventListener('error', (e) => {
    push('window.error', {
      message: e.message,
      source: e.filename != null ? `${e.filename}:${e.lineno ?? 0}` : undefined,
    });
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    push('unhandledrejection', {
      message: reason instanceof Error ? reason.message : String(reason),
    });
  });

  const origFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    try {
      const res = await origFetch(...args);
      if (!res.ok) {
        const url = typeof args[0] === 'string' ? args[0] : String((args[0] as Request).url ?? args[0]);
        push('fetch.failed', { url, status: res.status });
      }
      return res;
    } catch (err) {
      const url = typeof args[0] === 'string' ? args[0] : String((args[0] as Request).url ?? args[0]);
      push('fetch.error', { url, message: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  };

  return () => {};
}

export type SendDiagnosticsResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/** POST the buffer to the diagnostics API and return the stored row id. */
export async function sendTakeoffDiagnostics(): Promise<SendDiagnosticsResult> {
  try {
    const res = await fetch('/api/takeoff-diagnostics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(getTakeoffDiagnosticsSnapshot()),
    });
    const body = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
    if (!res.ok || body == null || body.id == null) {
      return { ok: false, error: body?.error ?? `Diagnostics upload failed (HTTP ${res.status}).` };
    }
    push('diagnostics.sent', { id: body.id });
    return { ok: true, id: body.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Diagnostics upload failed.' };
  }
}
