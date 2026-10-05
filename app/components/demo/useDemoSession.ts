'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DemoGuideState } from '@/app/lib/demo/model';
import { readGuide } from '@/app/lib/demo/model';
import type { GuideCommand } from '@/app/lib/demo/commands';
import { acceptGuideRevision, isDemoSystem, type DemoSystem } from '@/app/lib/demo/presentation';
import { DemoRequestError, demoJsonRequest, demoRequest } from '@/app/lib/demo/client-request';

export type DemoAllowance = { turnsRemaining: number; turnsLimit: number; sendsRemaining: number; sendsLimit: number; configured: boolean };
type Snapshot = { sessionId: string; expiresAt: string; tutorialState: DemoGuideState; units?: DemoSystem; allowance?: DemoAllowance; aiEnabled?: boolean; selfSendEnabled?: boolean; skylightAdded?: boolean };
export type GuideReply = { tutorialState: DemoGuideState; href: string };

/** One in-flight poll, monotonic revisions, abort on unmount. A late GET must
 * never undo a newer PATCH or reopen a guide the visitor just dismissed. */
export function useDemoSession(sessionId: string, expiresAt: string, initialState: DemoGuideState) {
  const [state, setState] = useState(initialState);
  const [units, setUnits] = useState<DemoSystem | null>(null);
  const [allowance, setAllowance] = useState<DemoAllowance | null>(null);
  const [features, setFeatures] = useState<{ ai: boolean; selfSend: boolean } | null>(null);
  const [skylightAdded, setSkylightAdded] = useState(false);
  const [expired, setExpired] = useState(false);
  const [pending, setPending] = useState(false);
  const [syncError, setSyncError] = useState('');
  const alive = useRef(false);
  const poll = useRef<AbortController | null>(null);
  const write = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const stopped = useRef(false);
  const refreshQueued = useRef(false);
  const apply = useCallback((incoming: DemoGuideState) => {
    if (alive.current) setState(previous => acceptGuideRevision(previous, readGuide(incoming)));
  }, []);
  const end = useCallback(() => { stopped.current = true; if (alive.current) setExpired(true); }, []);
  const refresh = useCallback(async (): Promise<void> => {
    if (!alive.current || stopped.current) return;
    // Coalesce, rather than lose, a save/visibility signal arriving while a
    // previous read or write is in flight. No overlapping GETs or polling storm.
    if (poll.current || busy.current) { refreshQueued.current = true; return; }
    refreshQueued.current = false;
    const controller = new AbortController(); poll.current = controller;
    try {
      const result = await demoRequest<Snapshot>('/api/demo/state', { signal: controller.signal });
      if (!alive.current || controller.signal.aborted) return;
      if (result.sessionId !== sessionId) { end(); return; }
      if (!result.tutorialState || result.tutorialState.version !== 2) throw new Error('Invalid progress response.');
      apply(result.tutorialState);
      if (isDemoSystem(result.units)) setUnits(result.units);
      if (result.allowance) setAllowance(result.allowance);
      setFeatures({ ai: result.aiEnabled === true, selfSend: result.selfSendEnabled === true });
      // This is only an instructional hint, not a completion acknowledgement.
      setSkylightAdded(result.skylightAdded === true);
      setSyncError('');
    } catch (error) {
      if (!alive.current || controller.signal.aborted) return;
      if (error instanceof DemoRequestError && (error.status === 401 || error.status === 410)) end();
      else setSyncError('Guide progress could not refresh. Your saved work has not been changed.');
    } finally {
      if (poll.current === controller) poll.current = null;
      if (alive.current && refreshQueued.current && !busy.current && !poll.current && !stopped.current) void refresh();
    }
  }, [sessionId, apply, end]);

  useEffect(() => {
    alive.current = true; stopped.current = false;
    void refresh();
    const visibleRefresh = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = window.setInterval(visibleRefresh, 5000);
    document.addEventListener('visibilitychange', visibleRefresh);
    window.addEventListener('online', visibleRefresh);
    window.addEventListener('qc-demo-refresh', visibleRefresh);
    return () => {
      alive.current = false; refreshQueued.current = false; poll.current?.abort(); poll.current = null; write.current?.abort();
      clearInterval(timer); document.removeEventListener('visibilitychange', visibleRefresh);
      window.removeEventListener('online', visibleRefresh); window.removeEventListener('qc-demo-refresh', visibleRefresh);
    };
  }, [refresh]);
  useEffect(() => {
    const remaining = Date.parse(expiresAt) - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) { end(); return; }
    const timer = setTimeout(end, Math.min(remaining, 2147483647));
    return () => clearTimeout(timer);
  }, [expiresAt, end]);

  const command = useCallback(async (input: GuideCommand): Promise<GuideReply | null> => {
    if (busy.current || stopped.current || !alive.current) return null;
    busy.current = true; setPending(true);
    poll.current?.abort(); poll.current = null;
    const controller = new AbortController(); write.current = controller;
    try {
      const result = await demoRequest<GuideReply>('/api/demo/state', { ...demoJsonRequest(input), method: 'PATCH', signal: controller.signal }, 30_000);
      if (!alive.current || controller.signal.aborted) return null;
      if (!result.tutorialState || result.tutorialState.version !== 2) throw new DemoRequestError('Could not confirm guide progress. Refresh before trying again.', 502);
      apply(result.tutorialState); setSyncError('');
      return result;
    } catch (error) {
      if (!alive.current || controller.signal.aborted) return null;
      if (error instanceof DemoRequestError && (error.status === 401 || error.status === 410)) end();
      throw error;
    } finally {
      busy.current = false; if (write.current === controller) write.current = null;
      if (alive.current) {
        setPending(false);
        if (refreshQueued.current && !stopped.current) void refresh();
      }
    }
  }, [apply, end, refresh]);
  return { state, units, allowance, features, skylightAdded, expired, pending, syncError, refresh, command };
}
