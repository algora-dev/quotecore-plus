'use client';
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { AssistantIcon } from './AssistantIcon';
import { recordingTime, waveformLevels } from './media-utils';
import type { useVoiceNote } from './useVoiceNote';
import s from './assistant.module.css';

/** DOM-only amplitude updates: recording does not re-render the whole transcript at 60fps. */
function Waveform({ analyser, active }: { analyser: RefObject<AnalyserNode | null>; active: boolean }) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    let frame = 0; let previous = 0;
    const bytes = new Uint8Array(256);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const draw = (time: number) => {
      if (time - previous >= (motion.matches ? 250 : 50)) {
        previous = time;
        const meter = analyser.current;
        if (meter) meter.getByteTimeDomainData(bytes); else bytes.fill(128);
        const levels = waveformLevels(bytes);
        element.current?.querySelectorAll<HTMLElement>('span').forEach((bar, i) => {
          // A fixed visual taper, never a synthetic time-varying signal. Silence remains dots.
          const taper = 0.24 + 0.76 * Math.sin(Math.PI * (i + 0.5) / levels.length);
          bar.style.height = `${5 + Math.round(levels[i] * taper * (motion.matches ? 20 : 64))}px`;
        });
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [active, analyser]);
  return <div ref={element} className={s.waveform} aria-hidden="true">{Array.from({ length: 15 }, (_, i) => <span key={i} />)}</div>;
}

export function VoiceCapture({ voice, disabled, expanded, beforeStart }: {
  voice: ReturnType<typeof useVoiceNote>; disabled: boolean; expanded: boolean; beforeStart: () => void;
}) {
  const refs = useRef({ voice, beforeStart });
  useEffect(() => { refs.current = { voice, beforeStart }; });
  const lastStarted = useRef(0);
  const start = useCallback(() => { refs.current.beforeStart(); lastStarted.current = Date.now(); void refs.current.voice.start(); }, []);
  // Tap-only recording (owner feedback 2026-09-29): one tap starts, tapping Finish
  // stops into review. A 380ms lockout absorbs accidental double-taps. There is no
  // press-and-hold mode: holding used to land the finger on Cancel and kill the note.
  const toggle = useCallback(() => {
    if (disabled || ['requesting', 'transcribing'].includes(refs.current.voice.state)) return;
    if (refs.current.voice.state === 'recording') {
      if (Date.now() - lastStarted.current > 380) refs.current.voice.finish();
    } else start();
  }, [disabled, start]);
  const recording = voice.state === 'recording';
  const waiting = voice.state === 'requesting' || voice.state === 'transcribing';
  // Transcribe & send skips the review card: same lockout as Finish so a
  // mis-tap right after starting cannot fire an unintended send.
  const finishAndSend = useCallback(() => {
    if (Date.now() - lastStarted.current > 380) refs.current.voice.finish(true);
  }, []);
  return <section className={s.voiceCapture} data-expanded={expanded} data-recording={recording} data-waiting={waiting} aria-label="Voice recorder">
    {waiting ? <div className={s.voiceWaiting}>
      <span className={s.spinner} aria-hidden="true" /><strong role="status">{voice.state === 'requesting' ? 'Opening microphone…' : 'Transcribing…'}</strong>
      <p>{voice.state === 'requesting' ? 'Allow access to start your voice note.' : voice.armedSend ? 'Your words go straight to the assistant.' : 'You’ll review your words before sending.'}</p>
      <QcButton onClick={voice.cancel}>Cancel</QcButton>
    </div> : <>
      <div className={s.voiceHeading}>
        <strong>{recording ? 'Listening…' : 'Ready when you are'}</strong>
        <p>{recording ? 'Your microphone is on — the screen stays awake while you talk' : 'Tap to talk'}</p>
      </div>
      {recording && <><Waveform analyser={voice.analyser} active={recording}/><div className={s.recordingTime}><span className={s.recordingDot} aria-hidden="true"/>{recordingTime(voice.elapsedSeconds)}</div></>}
      <div className={s.voiceControls}>
        {recording && <QcButton className={s.recordCancel} onClick={voice.cancel}><AssistantIcon name="close"/><span>Cancel</span></QcButton>}
        {recording && <QcButton className={s.recordSend} disabled={disabled} onClick={finishAndSend}><AssistantIcon name="send"/><span>Transcribe & send</span></QcButton>}
        <QcButton className={recording ? s.recordFinish : s.voiceOrb} aria-label={recording ? 'Finish recording' : 'Start recording'} aria-pressed={recording} disabled={disabled} onClick={toggle} onContextMenu={e => e.preventDefault()}>
          <AssistantIcon name={recording ? 'stop' : 'mic'}/>
          {recording && <span>Finish</span>}
        </QcButton>
      </div>
      {!recording && <p className={s.recordHint}>Tap to record <span>·</span> review before sending</p>}
      {recording && !voice.meterAvailable && <p className={s.recordHint}>Recording · live meter unavailable</p>}
    </>}
  </section>;
}
