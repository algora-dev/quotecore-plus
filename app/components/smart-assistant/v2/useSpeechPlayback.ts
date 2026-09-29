'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { speechChunks } from './media-utils';
export type SpeechPlaybackState = 'off' | 'loading' | 'speaking' | 'paused' | 'error';

/** Optional browser/device speech. Canonical text is never replaced; no model calls or task actions. */
export function useSpeechPlayback(visible: boolean, storageKey: string) {
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState(false);
  const [state, setState] = useState<SpeechPlaybackState>('off');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState('');
  const [error, setError] = useState<string | null>(null);
  const synth = useRef<SpeechSynthesis | null>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const ticket = useRef(0);
  const status = useRef<SpeechPlaybackState>('off');
  const preference = useRef(false);
  const selectedVoice = useRef('');
  const permitted = useRef(visible);
  useEffect(() => { permitted.current = visible; }, [visible]);
  const considered = useRef(new Set<string>());
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transition = useCallback((next: SpeechPlaybackState) => { status.current = next; setState(next); }, []);
  const stop = useCallback(() => {
    ticket.current++;
    if (startTimer.current) clearTimeout(startTimer.current);
    startTimer.current = null;
    try { synth.current?.cancel(); } catch { /* platform audio failure is not a task failure */ } utterance.current = null;
    transition('off'); setError(null);
  }, [transition]);

  /* eslint-disable react-hooks/set-state-in-effect -- post-mount hydration of persisted browser preferences: localStorage + speechSynthesis are unavailable during SSR, so the SSR-safe load pattern sets state inside this mount effect. */
  useEffect(() => {
    considered.current.clear();
    const supported = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
    synth.current = supported ? window.speechSynthesis : null; setAvailable(supported);
    let saved = false; let voice = '';
    try { saved = localStorage.getItem(storageKey) === '1'; voice = localStorage.getItem(`${storageKey}:voice`) ?? ''; } catch { /* optional */ }
    preference.current = saved; setEnabled(saved); selectedVoice.current = voice; setVoiceURI(voice);
    const updateVoices = () => { try { setVoices(synth.current?.getVoices() ?? []); } catch { setVoices([]); } };
    updateVoices(); synth.current?.addEventListener('voiceschanged', updateVoices);
    return () => { synth.current?.removeEventListener('voiceschanged', updateVoices); stop(); synth.current = null; };
  }, [storageKey, stop]);
  /* eslint-enable react-hooks/set-state-in-effect */
  // eslint-disable-next-line react-hooks/set-state-in-effect -- imperative speech stop when the assistant hides: external-system sync, not derived render state.
  useEffect(() => { if (!visible) stop(); }, [visible, stop]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, [stop]);

  const toggleEnabled = useCallback(() => {
    const next = !preference.current; preference.current = next; setEnabled(next);
    try { localStorage.setItem(storageKey, next ? '1' : '0'); } catch { /* optional */ }
    if (!next) stop();
    // Enabling never replays historic replies.
  }, [storageKey, stop]);
  const chooseVoice = useCallback((uri: string) => {
    stop(); selectedVoice.current = uri; setVoiceURI(uri);
    try { localStorage.setItem(`${storageKey}:voice`, uri); } catch { /* optional */ }
  }, [storageKey, stop]);
  const play = useCallback((text: string) => {
    if (!permitted.current || document.hidden || !synth.current) return;
    const chunks = speechChunks(text); if (!chunks.length) return;
    stop(); const generation = ticket.current;
    transition('loading');
    const fail = () => {
      if (generation !== ticket.current) return;
      ticket.current++; try { synth.current?.cancel(); } catch { /* platform audio failure is not a task failure */ } utterance.current = null;
      if (startTimer.current) clearTimeout(startTimer.current); startTimer.current = null;
      transition('error'); setError('Audio could not play. Your text answer is still here. Tap Read aloud to try again.');
    };
    const speakNext = (index: number) => {
      if (generation !== ticket.current || !permitted.current || !synth.current) return;
      if (startTimer.current) clearTimeout(startTimer.current);
      startTimer.current = null;
      if (index >= chunks.length) { transition('off'); utterance.current = null; return; }
      transition('loading');
      try {
      const part = new SpeechSynthesisUtterance(chunks[index]);
      const voice = synth.current.getVoices().find(v => v.voiceURI === selectedVoice.current);
      if (voice) { part.voice = voice; part.lang = voice.lang; }
      part.rate = 1;
      part.onstart = () => { if (generation === ticket.current) { if (startTimer.current) clearTimeout(startTimer.current); startTimer.current = null; transition('speaking'); } };
      part.onend = () => { if (generation === ticket.current) speakNext(index + 1); };
      part.onerror = fail;
      utterance.current = part;
      startTimer.current = setTimeout(() => { if (generation === ticket.current && status.current === 'loading') fail(); }, 5000);
      synth.current.speak(part);
      } catch { fail(); }
    };
    speakNext(0);
  }, [stop, transition]);
  const autoSpeak = useCallback((id: string, text: string) => {
    // Called only for this client's newly completed canonical runs, not from render/history effects.
    if (considered.current.has(id)) return;
    considered.current.add(id);
    if (considered.current.size > 256) considered.current.delete(considered.current.values().next().value!);
    if (preference.current) play(text);
  }, [play]);
  const pauseOrResume = useCallback(() => {
    try {
      if (status.current === 'speaking') { synth.current?.pause(); transition('paused'); }
      else if (status.current === 'paused') { synth.current?.resume(); transition('speaking'); }
    } catch { stop(); setError('Playback control is unavailable. Your text answer is still here.'); transition('error'); }
  }, [stop, transition]);
  return { enabled, available, state, error, voices, voiceURI, chooseVoice, toggleEnabled, autoSpeak, play, stop, pauseOrResume };
}
