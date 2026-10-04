import {
  hasResumeLoopMarker, loginReturnPath, markResumeDestination, parseResumeResult,
  RESUME_LOOP_WINDOW_MS, RESUME_STORAGE_KEY, suppressAutomaticResume,
} from './resume-contract';

export type RecoveryState = 'checking' | 'form' | 'unavailable' | 'loop' | 'navigating';
export type RecoveryTrigger = 'mount' | 'pageshow' | 'foreground' | 'online' | 'manual';
export interface RecoveryEnvironment {
  search: () => URLSearchParams;
  hash: () => string;
  visible: () => boolean;
  online: () => boolean;
  now: () => number;
  readStorage: (key: string) => string | null;
  writeStorage: (key: string, value: string) => void;
  probe: (destination: string, signal: AbortSignal, trigger: RecoveryTrigger) => Promise<unknown>;
  navigate: (destination: string) => void;
  state: (state: RecoveryState) => void;
}

/** Bounded login-only recovery. No polling, browser getSession authority,
 * local token backup, auth-state mutation, or request while entering credentials.
 * Dependencies make lifecycle races executable without a real auth account. */
export function createLoginRecovery(env: RecoveryEnvironment) {
  let epoch = 0, lastStart = -Infinity;
  let stopped = false, navigating = false, disabled = false, disposed = false, busy = false;
  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const stop = () => {
    epoch++;
    controller?.abort(); controller = null;
    if (timer) clearTimeout(timer);
    timer = null; busy = false;
  };
  const looped = () => {
    if (hasResumeLoopMarker(env.search())) return true;
    try {
      const at = Number(env.readStorage(RESUME_STORAGE_KEY));
      return at > 0 && env.now() >= at && env.now() - at < RESUME_LOOP_WINDOW_MS;
    } catch { return false; } // URL marker remains if storage is unavailable
  };
  return {
    async start(trigger: RecoveryTrigger = 'mount') {
      const manual = trigger === 'manual';
      if (disposed || busy || navigating || !env.visible() || disabled || (stopped && !manual)) return;
      if (!manual && looped()) { env.state('loop'); return; }
      if (suppressAutomaticResume(env.search(), env.hash()) && !manual) { env.state('form'); return; }
      // Explicit logout / recovery links cannot be overridden even by a lifecycle
      // event. A manual session check button is not rendered for these URLs.
      if (env.search().has('signedOut') || env.search().has('code') || env.search().has('token_hash') ||
          /(?:access_token|refresh_token|error)=/.test(env.hash())) { env.state('form'); return; }
      if (!manual && env.now() - lastStart < 2000) return;
      if (!env.online()) { env.state('unavailable'); return; }
      lastStart = env.now(); busy = true;
      const current = ++epoch;
      controller = new AbortController();
      const signal = controller.signal;
      env.state('checking');
      // A provider/HTTP hang must not trap someone outside the sign-in form.
      timer = setTimeout(() => {
        if (disposed || current !== epoch) return;
        stop(); env.state('unavailable');
      }, 10_000);
      try {
        const value = await env.probe(loginReturnPath(env.search()), signal, trigger);
        if (disposed || current !== epoch) return;
        const result = parseResumeResult(value);
        if (!result || result.status === 'unavailable') { env.state('unavailable'); return; }
        if (result.status === 'anonymous' || result.status === 'disabled') {
          if (result.status === 'disabled') { disabled = true; stopped = true; }
          env.state('form'); return;
        }
        if (!env.visible()) { env.state('form'); return; }
        // Record before navigating; a returned Login document must not bounce
        // forever. Neither this timestamp nor the URL marker grants authority.
        try { env.writeStorage(RESUME_STORAGE_KEY, String(env.now())); } catch { /* optional */ }
        env.state('navigating');
        navigating = true;
        env.navigate(markResumeDestination(result.destination));
      } catch {
        if (!disposed && current === epoch) env.state('unavailable');
      } finally {
        if (current === epoch) {
          if (timer) clearTimeout(timer);
          timer = null; controller = null; busy = false;
        }
      }
    },
    /** Prevent a late result or later foreground event interrupting sign-in. */
    enteringCredentials() { stopped = true; stop(); },
    suspend() {
      stop(); navigating = false; lastStart = -Infinity;
      // A quick background/foreground transition must not leave a cancelled
      // checking screen stuck behind the lifecycle throttle. User-entered
      // credentials still suppress automatic checks when the page returns.
      if (!disposed) env.state('form');
    },
    dispose() { disposed = true; stop(); },
  };
}

/** Shared native lifecycle wiring; detachable for React cleanup and fixtures. */
export function attachLoginRecoveryEvents(control: ReturnType<typeof createLoginRecovery>, win: Window, doc: Document) {
  const pageShow = (event: PageTransitionEvent) => { if (event.persisted) void control.start('pageshow'); };
  const visibility = () => { if (doc.hidden) control.suspend(); else void control.start('foreground'); };
  const online = () => { void control.start('online'); };
  const pageHide = () => control.suspend();
  win.addEventListener('pageshow', pageShow); win.addEventListener('pagehide', pageHide);
  doc.addEventListener('visibilitychange', visibility); win.addEventListener('online', online);
  return () => {
    control.dispose(); win.removeEventListener('pageshow', pageShow); win.removeEventListener('pagehide', pageHide);
    doc.removeEventListener('visibilitychange', visibility); win.removeEventListener('online', online);
  };
}
