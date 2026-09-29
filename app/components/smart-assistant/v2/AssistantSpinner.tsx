'use client';
import { useEffect, useRef, useState } from 'react';
import s from './assistant.module.css';

/** SMIL-driven loading ring (VoiceCapture transcribing + working indicator).
 * The owner's device freezes CSS-keyframe animations during long assistant
 * turns (2026-09-29), so rotation runs on the SVG animation clock via
 * animateTransform, with a requestAnimationFrame fallback for engines without
 * SMIL. Size, position, colour and glow match the previous CSS border spinner
 * exactly; prefers-reduced-motion keeps the ring static (design-system rule).
 * Both call sites render this from client-only state, so the lazy mechanism
 * probe never runs during server rendering. */
export function AssistantSpinner() {
  const group = useRef<SVGGElement | null>(null);
  const [smil] = useState(() => typeof window !== 'undefined'
    && 'SVGAnimateTransformElement' in window
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (smil) return;
    const node = group.current;
    if (!node || typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const start = performance.now();
    const draw = (time: number) => {
      node.setAttribute('transform', `rotate(${(((time - start) / 800) % 1) * 360} 10 10)`);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [smil]);
  return <svg className={s.spinner} width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <g ref={group}>
      <circle cx="10" cy="10" r="7.5" fill="none" stroke="#ffffff2e" strokeWidth="2.5"/>
      {/* Same quarter-arc emphasis the CSS border-top-colour spinner had. */}
      <circle cx="10" cy="10" r="7.5" fill="none" stroke="#ff8a4d" strokeWidth="2.5" strokeDasharray="11.78 35.34" transform="rotate(-90 10 10)"/>
      {smil && <animateTransform attributeName="transform" type="rotate" from="0 10 10" to="360 10 10" dur="0.8s" repeatCount="indefinite"/>}
    </g>
  </svg>;
}
