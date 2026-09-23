'use client';
import { useEffect } from 'react';

/**
 * TEMPORARY cold-start session telemetry (patch_055, 2026-09-23).
 *
 * Fires ONE ping per browser session when the login page renders, so the
 * iOS PWA "logged out after fully closing the app" issue can be diagnosed
 * from data instead of guesses. The server side (see
 * /api/auth-session-debug) records which sb-* cookies the browser actually
 * sent (including httpOnly cookies this page cannot see), the PWA display
 * mode, and whether the /login load came from a middleware redirect.
 *
 * Remove this component (and the route + auth_session_debug table) once the
 * issue is resolved.
 */
export function AuthSessionDebugPing() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem('qcp-sess-debug')) return;
      sessionStorage.setItem('qcp-sess-debug', '1');
      const standalone = typeof window.matchMedia === 'function'
        && window.matchMedia('(display-mode: standalone)').matches;
      const redirected = new URLSearchParams(window.location.search).has('redirect');
      void fetch('/api/auth-session-debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayMode: standalone ? 'standalone' : 'browser',
          referer: document.referrer || '',
          source: redirected ? 'mw-redirect' : 'direct',
        }),
        keepalive: true,
      }).catch(() => { /* best-effort telemetry */ });
    } catch {
      /* ignore - never affect the login page */
    }
  }, []);
  return null;
}
