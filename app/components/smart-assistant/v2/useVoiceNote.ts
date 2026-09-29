'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isRecord } from '@/app/lib/smart-assistant/section-permissions';

export type VoiceNoteState = 'off' | 'requesting' | 'recording' | 'transcribing';

type ScreenWakeSentinel = { released?: boolean; release(): Promise<void>; addEventListener?(type: 'release', listener: () => void): void };

/** Capture -> existing authenticated transcription endpoint -> editable text. Never submits a turn. */
export function useVoiceNote(visible: boolean, onText: (text: string) => void, onError: (message: string) => void) {
  const [state, setState] = useState<VoiceNoteState>('off');
  const stateRef = useRef<VoiceNoteState>('off');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [meterAvailable, setMeterAvailable] = useState(false);
  const analyser = useRef<AnalyserNode | null>(null);
  const context = useRef<AudioContext | null>(null);
  const source = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const generation = useRef(0);
  const finishAfterPermission = useRef(false);
  const cap = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clock = useRef<ReturnType<typeof setInterval> | null>(null);
  const upload = useRef<AbortController | null>(null);
  const uploadTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Screen Wake Lock (owner feedback 2026-09-29): long voice notes were lost when
  // the phone screen slept mid-recording. Best-effort: unsupported browsers record on.
  const wakeLock = useRef<ScreenWakeSentinel | null>(null);
  const keepScreenAwake = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<ScreenWakeSentinel> } };
      if (!nav.wakeLock || wakeLock.current) return;
      const sentinel = await nav.wakeLock.request('screen');
      wakeLock.current = sentinel;
      sentinel.addEventListener?.('release', () => { wakeLock.current = null; });
    } catch { /* recording continues without the lock */ }
  }, []);
  const dropWakeLock = useCallback(() => {
    const sentinel = wakeLock.current; wakeLock.current = null;
    try { void sentinel?.release(); } catch { /* already released */ }
  }, []);
  const callbacks = useRef({ onText, onError });
  callbacks.current = { onText, onError };
  const allowed = useRef(visible); allowed.current = visible;
  const transition = useCallback((next: VoiceNoteState) => { stateRef.current = next; setState(next); }, []);

  const release = useCallback(() => {
    if (cap.current) clearTimeout(cap.current);
    if (clock.current) clearInterval(clock.current);
    cap.current = null; clock.current = null;
    analyser.current = null;
    dropWakeLock();
    const ctx = context.current; context.current = null;
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => undefined);
    const tracks = source.current; source.current = null;
    tracks?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    setMeterAvailable(false);
  }, [dropWakeLock]);

  const cancel = useCallback(() => {
    generation.current++;
    finishAfterPermission.current = false;
    upload.current?.abort(); upload.current = null;
    if (uploadTimeout.current) clearTimeout(uploadTimeout.current);
    uploadTimeout.current = null;
    const rec = recorder.current; recorder.current = null;
    if (rec && rec.state !== 'inactive') { try { rec.stop(); } catch { /* already stopped */ } }
    release(); setElapsedSeconds(0); transition('off');
  }, [release, transition]);

  useEffect(() => { if (!visible) cancel(); return cancel; }, [visible, cancel]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) cancel(); };
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, [cancel]);

  const finish = useCallback(() => {
    if (stateRef.current === 'requesting') { finishAfterPermission.current = true; return; }
    const rec = recorder.current;
    if (rec?.state === 'recording') { transition('transcribing'); rec.stop(); }
  }, [transition]);

  const start = useCallback(async () => {
    if (!allowed.current || stateRef.current !== 'off') return;
    if (!window.isSecureContext || typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      callbacks.current.onError('Microphone recording is unavailable here. You can still use Type.'); return;
    }
    const ticket = ++generation.current;
    finishAfterPermission.current = false;
    transition('requesting'); setElapsedSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (ticket !== generation.current || !allowed.current) { stream.getTracks().forEach(t => t.stop()); return; }
      source.current = stream;
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(v => MediaRecorder.isTypeSupported(v));
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorder.current = rec;
      const chunks: Blob[] = []; let bytes = 0; let tooLarge = false;
      // Metering is optional. Failure to initialise AudioContext must not disable recording.
      try {
        const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctor) {
          const ctx = new Ctor(); context.current = ctx;
          const meter = ctx.createAnalyser(); meter.fftSize = 256;
          ctx.createMediaStreamSource(stream).connect(meter); // deliberately not connected to speakers
          analyser.current = meter;
          void ctx.resume().then(() => { if (ticket === generation.current) setMeterAvailable(ctx.state === 'running'); }).catch(() => undefined);
        }
      } catch { analyser.current = null; setMeterAvailable(false); }
      rec.ondataavailable = event => {
        bytes += event.data.size;
        if (bytes > 14 * 1024 * 1024) { tooLarge = true; if (rec.state === 'recording') rec.stop(); }
        else if (event.data.size) chunks.push(event.data);
      };
      rec.onerror = () => { if (ticket === generation.current) { cancel(); callbacks.current.onError('Recording stopped unexpectedly. Please try again or use Type.'); } };
      stream.getAudioTracks().forEach(track => { track.onended = () => { if (ticket === generation.current && stateRef.current === 'recording') { cancel(); callbacks.current.onError('The microphone disconnected. Please try again or use Type.'); } }; });
      rec.onstop = async () => {
        // An old cancelled recorder must not stop a new recorder or its meter.
        if (ticket !== generation.current) return;
        release(); recorder.current = null;
        if (tooLarge || bytes === 0) {
          transition('off'); callbacks.current.onError(tooLarge ? 'That recording is too large. Try a shorter voice note.' : 'No audio was captured. Try again or use Type.'); return;
        }
        transition('transcribing');
        const controller = new AbortController(); upload.current = controller;
        uploadTimeout.current = setTimeout(() => controller.abort(), 45000);
        try {
          const form = new FormData();
          form.append('audio', new Blob(chunks, { type: rec.mimeType }), rec.mimeType.includes('mp4') ? 'voice.mp4' : 'voice.webm');
          const response = await fetch('/api/smart-assistant/transcribe', { method: 'POST', body: form, signal: controller.signal });
          const result: unknown = await response.json().catch(() => null);
          if (ticket !== generation.current || !allowed.current) return;
          if (!response.ok || !isRecord(result) || typeof result.text !== 'string') throw new Error('Transcription failed. Try again or use Type.');
          const text = result.text.trim();
          if (!text) throw new Error('I could not hear any words. Try again or use Type.');
          if (text.length > 16000) throw new Error('The transcript is too long. Please record a shorter message.');
          callbacks.current.onText(text);
        } catch (error) {
          if (ticket === generation.current) callbacks.current.onError(controller.signal.aborted ? 'Transcription took too long. Please try again or use Type.' : error instanceof Error ? error.message : 'Transcription failed. Use Type instead.');
        } finally {
          if (ticket === generation.current) {
            if (uploadTimeout.current) clearTimeout(uploadTimeout.current);
            uploadTimeout.current = null; upload.current = null; transition('off');
          }
        }
      };
      rec.start(250);
      const began = Date.now();
      clock.current = setInterval(() => { if (ticket === generation.current) setElapsedSeconds(Math.floor((Date.now() - began) / 1000)); }, 1000);
      cap.current = setTimeout(() => { if (rec.state === 'recording') finish(); }, 120000);
      transition('recording');
      void keepScreenAwake();
      if (finishAfterPermission.current) finish();
    } catch (error) {
      if (ticket !== generation.current) return;
      cancel();
      const name = error instanceof DOMException ? error.name : '';
      callbacks.current.onError(name === 'NotAllowedError' || name === 'SecurityError'
        ? 'Microphone permission was not granted. Allow microphone access in your browser’s site settings, or use Type.'
        : name === 'NotFoundError' || name === 'OverconstrainedError'
          ? 'No microphone was found. Connect one or use Type.'
          : 'The microphone could not be opened. Check site permission or use Type.');
    }
  }, [cancel, finish, keepScreenAwake, release, transition]);
  return { state, elapsedSeconds, analyser, meterAvailable, start, finish, cancel };
}
