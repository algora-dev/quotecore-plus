'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type SpeechPlaybackState = 'off' | 'speaking' | 'paused' | 'unavailable';

export function useSpeechPlayback(visible: boolean, storageKey: string) {
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<SpeechPlaybackState>('off');
  const synth = useRef<SpeechSynthesis | null>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const spokenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      // Browser-API feature detection must run post-mount to avoid hydration mismatch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState('unavailable');
      return;
    }
    synth.current = window.speechSynthesis;
    try {
      setEnabled(localStorage.getItem(storageKey) === '1');
    } catch {
      /* ignore preference storage failures */
    }
    return () => {
      synth.current?.cancel();
      utterance.current = null;
    };
  }, [storageKey]);

  const stop = useCallback(() => {
    synth.current?.cancel();
    utterance.current = null;
    if (state !== 'unavailable') setState('off');
  }, [state]);

  useEffect(() => {
    // Stopping speech when the assistant hides; conditional by design (stop is stable).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!visible) stop();
  }, [visible, stop]);

  const toggleEnabled = useCallback(() => {
    setEnabled(current => {
      const next = !current;
      try { localStorage.setItem(storageKey, next ? '1' : '0'); } catch { /* ignore */ }
      if (!next) {
        synth.current?.cancel();
        utterance.current = null;
        if (state !== 'unavailable') setState('off');
      }
      return next;
    });
  }, [state, storageKey]);

  const pauseOrResume = useCallback(() => {
    if (!synth.current) return;
    if (state === 'speaking') {
      synth.current.pause();
      setState('paused');
    } else if (state === 'paused') {
      synth.current.resume();
      setState('speaking');
    }
  }, [state]);

  const speak = useCallback((id: string, text: string) => {
    if (!enabled || !text.trim() || spokenIds.current.has(id) || !synth.current || state === 'unavailable') return;
    synth.current.cancel();
    const next = new SpeechSynthesisUtterance(text.trim());
    next.rate = 1;
    next.pitch = 1;
    next.onstart = () => setState('speaking');
    next.onpause = () => setState('paused');
    next.onresume = () => setState('speaking');
    next.onend = () => {
      utterance.current = null;
      setState('off');
    };
    next.onerror = () => {
      utterance.current = null;
      setState('off');
    };
    spokenIds.current.add(id);
    utterance.current = next;
    synth.current.speak(next);
  }, [enabled, state]);

  return useMemo(() => ({ enabled, state, toggleEnabled, speak, stop, pauseOrResume }), [enabled, state, toggleEnabled, speak, stop, pauseOrResume]);
}
