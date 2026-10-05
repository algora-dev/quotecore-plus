'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Access } from '@/app/lib/smart-assistant/v2/contracts';
import { capability } from './client';

/** Only the latest, mounted request may publish access or resolve an opener.
 * Failed refresh is not evidence that V2 is disabled: retain the last snapshot
 * and report an error instead of silently falling back to the legacy client. */
export function useCapability() {
  const sequence = useRef(0);
  const mounted = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const [state, setState] = useState<{ ready: boolean; refreshing: boolean; access: Access | null; error: string | null }>({ ready: false, refreshing: false, access: null, error: null });
  const refresh = useCallback(async (): Promise<Access | null> => {
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    const id = ++sequence.current;
    let timeout = false;
    const timer = setTimeout(() => { timeout = true; request.abort(); }, 15_000);
    if (mounted.current) setState(previous => ({ ...previous, refreshing: true, error: null }));
    try {
      const access = await capability(request.signal);
      if (!mounted.current || id !== sequence.current || request.signal.aborted) return null;
      setState({ ready: true, refreshing: false, access, error: null });
      return access;
    } catch (error) {
      if (!mounted.current || id !== sequence.current || (request.signal.aborted && !timeout)) return null;
      setState(previous => ({ ...previous, ready: true, refreshing: false, error: timeout ? 'Checking Assistant access took too long. Please try again.' : error instanceof Error ? error.message : 'Assistant access could not be checked.' }));
      return null;
    } finally { clearTimeout(timer); if (controller.current === request) controller.current = null; }
  }, []);
  useEffect(() => {
    mounted.current = true; void refresh();
    return () => { mounted.current = false; controller.current?.abort(); };
  }, [refresh]);
  return { ...state, refresh };
}
