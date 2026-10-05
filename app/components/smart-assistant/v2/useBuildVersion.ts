'use client';
import { useEffect, useRef, useState } from 'react';

/** Baked at build time; compared against /api/build-id at runtime. */
const BAKED_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? 'local';

/**
 * Stale-bundle guard for the installed PWA: a home-screen app keeps its old
 * JavaScript until it is fully restarted, so testing after a deploy can
 * unknowingly run yesterday's build (owner 2026-09-29: spinner/Proceed
 * "missing" while the app was still on the pre-deploy bundle). Checks on
 * mount, on regaining visibility and every 5 minutes. When the deployed build
 * differs: auto-reload while idle, or surface a reload chip while a turn or
 * voice note is in flight.
 */
export function useBuildVersion(idle: boolean): boolean {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const idleRef = useRef(idle);
  const lastCheck = useRef(0);
  useEffect(() => { idleRef.current = idle; }, [idle]);
  useEffect(() => {
    let cancelled = false;
    const check = () => {
      const now = Date.now();
      if (now - lastCheck.current < 60_000) return;
      lastCheck.current = now;
      fetch('/api/build-id', { cache: 'no-store' })
        .then(response => (response.ok ? response.json() : null))
        .then((data: { buildId?: string } | null) => {
          if (cancelled || !data || typeof data.buildId !== 'string') return;
          if (data.buildId === BAKED_BUILD_ID) return;
          if (idleRef.current) window.location.reload();
          else setUpdateAvailable(true);
        })
        .catch(() => { /* offline-tolerant */ });
    };
    check();
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(check, 5 * 60_000);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, []);
  return updateAvailable;
}
