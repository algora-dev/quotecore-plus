'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { speechChunks, speechText } from './media-utils';
export type SpeechPlaybackState = 'off' | 'loading' | 'speaking' | 'paused' | 'error';

/** Premium neural voices offered by the server TTS route (SA Phase 2a).
 * Mirrors the route allowlist exactly - the client never sends other ids. */
export const PREMIUM_VOICES = [
  { id: 'alloy', label: 'Alloy · neutral' },
  { id: 'verse', label: 'Verse · versatile' },
  { id: 'sage', label: 'Sage · calm' },
  { id: 'coral', label: 'Coral · warm' },
] as const;

const SPEAK_ENDPOINT = '/api/smart-assistant/v2/speak';
/** Must match TTS_CONFIG.maxInputChars on the speak route. Longer replies stay
 * on the free browser path (chunked), so no reply is ever silently truncated. */
const PREMIUM_MAX_CHARS = 4000;

/** Owner feedback 2026-09-29: the raw device list is long and mostly robotic.
 * Offer only a few high-quality natural voices, never novelty/robot voices.
 * Premium engine names first (Natural/Premium/Enhanced/Neural/Google), network
 * engines over local ones, English locales, one per accent, hard cap of four. */
function curateVoices(list: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const english = list.filter(v => v.lang.toLowerCase().startsWith('en'));
  const premium = /(natural|premium|enhanced|neural|google|azure|siri)/i;
  const score = (v: SpeechSynthesisVoice) => (premium.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
  const seen = new Set<string>();
  const picked = [...english].sort((a, b) => score(b) - score(a)).filter(v => {
    const key = v.lang.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 4);
  return picked.length ? picked : english.slice(0, 4);
}

/** Optional browser/device speech. Canonical text is never replaced; no model calls or task actions.
 * Premium tier (SA Phase 2a): when the `sa-tts:` preference is on AND the
 * speak route answers, replies play through server-side neural TTS
 * (fetch -> blob -> audio). The browser path below stays untouched as the
 * free tier and remains the fallback whenever premium is off or unavailable. */
export function useSpeechPlayback(visible: boolean, storageKey: string, ttsKey: string) {
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState(false);
  const [state, setState] = useState<SpeechPlaybackState>('off');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState('');
  const [premiumEnabled, setPremiumEnabled] = useState(false);
  const [premiumReady, setPremiumReady] = useState(false);
  const [premiumVoice, setPremiumVoice] = useState<string>('alloy');
  const [error, setError] = useState<string | null>(null);
  const synth = useRef<SpeechSynthesis | null>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const ticket = useRef(0);
  const status = useRef<SpeechPlaybackState>('off');
  const preference = useRef(false);
  const selectedVoice = useRef('');
  const premiumPreference = useRef(false);
  const premiumArmed = useRef(false);
  const premiumVoiceRef = useRef('alloy');
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);
  const permitted = useRef(visible);
  useEffect(() => { permitted.current = visible; }, [visible]);
  const considered = useRef(new Set<string>());
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transition = useCallback((next: SpeechPlaybackState) => { status.current = next; setState(next); }, []);
  const releaseAudio = useCallback(() => {
    const audio = audioEl.current; audioEl.current = null;
    if (audio) { try { audio.pause(); audio.removeAttribute('src'); audio.load(); } catch { /* platform audio failure is not a task failure */ } }
    if (audioUrl.current) { URL.revokeObjectURL(audioUrl.current); audioUrl.current = null; }
  }, []);
  const stop = useCallback(() => {
    ticket.current++;
    if (startTimer.current) clearTimeout(startTimer.current);
    startTimer.current = null;
    try { synth.current?.cancel(); } catch { /* platform audio failure is not a task failure */ } utterance.current = null;
    releaseAudio();
    transition('off'); setError(null);
  }, [releaseAudio, transition]);

  /** One cheap probe per browser session decides whether the premium route is
   * live (deploy flag + key). Failure just keeps the free browser path. */
  const probePremium = useCallback(async () => {
    let ok = false;
    try {
      const res = await fetch(SPEAK_ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Hi', voice: premiumVoiceRef.current }),
      });
      ok = res.ok && (res.headers.get('content-type') ?? '').includes('audio');
    } catch { ok = false; }
    try { sessionStorage.setItem(`${ttsKey}:probe`, ok ? 'ok' : 'no'); } catch { /* optional */ }
    if (ok && premiumPreference.current) { premiumArmed.current = true; setPremiumReady(true); }
    else { premiumArmed.current = false; setPremiumReady(false); }
  }, [ttsKey]);

  // Post-mount hydration of persisted browser preferences: localStorage and
  // speechSynthesis are unavailable during SSR, so this mount effect sets state
  // directly (SSR-safe load pattern).
  useEffect(() => {
    considered.current.clear();
    const supported = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
    synth.current = supported ? window.speechSynthesis : null; setAvailable(supported);
    let saved = false; let voice = '';
    try { saved = localStorage.getItem(storageKey) === '1'; voice = localStorage.getItem(`${storageKey}:voice`) ?? ''; } catch { /* optional */ }
    preference.current = saved; setEnabled(saved); selectedVoice.current = voice; setVoiceURI(voice);
    // Premium neural-voice preference (same SSR-safe hydration pattern).
    let premiumSaved = false; let premiumVoiceSaved = 'alloy'; let probed: string | null = null;
    try {
      premiumSaved = localStorage.getItem(ttsKey) === '1';
      const savedId = localStorage.getItem(`${ttsKey}:voice`) ?? '';
      if (PREMIUM_VOICES.some(v => v.id === savedId)) premiumVoiceSaved = savedId;
      probed = sessionStorage.getItem(`${ttsKey}:probe`);
    } catch { /* optional */ }
    premiumPreference.current = premiumSaved; setPremiumEnabled(premiumSaved);
    premiumVoiceRef.current = premiumVoiceSaved; setPremiumVoice(premiumVoiceSaved);
    if (premiumSaved && probed === 'ok') { premiumArmed.current = true; setPremiumReady(true); }
    else if (premiumSaved && probed !== 'no') void probePremium();
    const updateVoices = () => {
      try {
        const curated = curateVoices(synth.current?.getVoices() ?? []);
        setVoices(curated);
        // A saved voice outside the curated set (e.g. an old novelty voice) falls back to the best available.
        if (curated.length && !curated.some(v => v.voiceURI === selectedVoice.current)) {
          selectedVoice.current = curated[0].voiceURI; setVoiceURI(curated[0].voiceURI);
          try { localStorage.setItem(`${storageKey}:voice`, curated[0].voiceURI); } catch { /* optional */ }
        }
      } catch { setVoices([]); }
    };
    updateVoices(); synth.current?.addEventListener('voiceschanged', updateVoices);
    return () => { synth.current?.removeEventListener('voiceschanged', updateVoices); stop(); synth.current = null; };
  }, [storageKey, ttsKey, stop, probePremium]);
  // Imperative speech stop when the assistant hides: external-system sync, not derived render state.
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
  const togglePremium = useCallback(() => {
    const next = !premiumPreference.current;
    premiumPreference.current = next; setPremiumEnabled(next);
    try { localStorage.setItem(ttsKey, next ? '1' : '0'); } catch { /* optional */ }
    if (!next) { premiumArmed.current = false; setPremiumReady(false); stop(); return; }
    // Fresh probe on every enable: session cache may predate the deploy flag.
    void probePremium();
  }, [ttsKey, stop, probePremium]);
  const chooseVoice = useCallback((uri: string) => {
    stop(); selectedVoice.current = uri; setVoiceURI(uri);
    try { localStorage.setItem(`${storageKey}:voice`, uri); } catch { /* optional */ }
  }, [storageKey, stop]);
  const choosePremiumVoice = useCallback((id: string) => {
    if (!PREMIUM_VOICES.some(v => v.id === id)) return;
    stop(); premiumVoiceRef.current = id; setPremiumVoice(id);
    try { localStorage.setItem(`${ttsKey}:voice`, id); } catch { /* optional */ }
  }, [ttsKey, stop]);
  const playBrowser = useCallback((text: string) => {
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
  /** Premium path: server-synthesized speech of the SAME reply text. Any
   * failure falls back to the browser path, so premium can never lose a reply. */
  const playPremium = useCallback(async (text: string) => {
    const clean = speechText(text).slice(0, PREMIUM_MAX_CHARS).trim();
    if (!clean) { playBrowser(text); return; }
    stop(); const generation = ticket.current;
    transition('loading');
    try {
      const res = await fetch(SPEAK_ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean, voice: premiumVoiceRef.current }),
      });
      if (generation !== ticket.current) return;
      if (!res.ok) throw new Error('premium_unavailable');
      const blob = await res.blob();
      if (generation !== ticket.current) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioEl.current = audio; audioUrl.current = url;
      audio.onplaying = () => { if (generation === ticket.current) transition('speaking'); };
      audio.onended = () => {
        if (generation !== ticket.current) return;
        releaseAudio(); transition('off'); setError(null);
      };
      audio.onerror = () => {
        if (generation !== ticket.current) return;
        ticket.current++; releaseAudio();
        transition('error'); setError('Audio could not play. Your text answer is still here. Tap Read aloud to try again.');
      };
      await audio.play();
    } catch {
      if (generation !== ticket.current) return;
      ticket.current++; releaseAudio();
      playBrowser(text);
    }
  }, [playBrowser, releaseAudio, stop, transition]);
  const play = useCallback((text: string) => {
    if (!permitted.current || document.hidden || !synth.current) return;
    if (premiumArmed.current && speechText(text).trim().length <= PREMIUM_MAX_CHARS) void playPremium(text);
    else playBrowser(text);
  }, [playBrowser, playPremium]);
  const autoSpeak = useCallback((id: string, text: string) => {
    // Called only for this client's newly completed canonical runs, not from render/history effects.
    if (considered.current.has(id)) return;
    considered.current.add(id);
    if (considered.current.size > 256) considered.current.delete(considered.current.values().next().value!);
    if (preference.current) play(text);
  }, [play]);
  const pauseOrResume = useCallback(() => {
    try {
      if (audioEl.current && (status.current === 'speaking' || status.current === 'paused')) {
        if (status.current === 'speaking') { audioEl.current.pause(); transition('paused'); }
        else { void audioEl.current.play(); transition('speaking'); }
        return;
      }
      if (status.current === 'speaking') { synth.current?.pause(); transition('paused'); }
      else if (status.current === 'paused') { synth.current?.resume(); transition('speaking'); }
    } catch { stop(); setError('Playback control is unavailable. Your text answer is still here.'); transition('error'); }
  }, [stop, transition]);
  return { enabled, available, state, error, voices, voiceURI, chooseVoice, toggleEnabled, autoSpeak, play, stop, pauseOrResume,
    premiumEnabled, premiumReady, premiumVoices: PREMIUM_VOICES, premiumVoice, togglePremium, choosePremiumVoice };
}
