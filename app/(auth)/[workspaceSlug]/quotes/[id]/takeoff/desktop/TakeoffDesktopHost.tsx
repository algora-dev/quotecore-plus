'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import './takeoff-desktop.css';

/** Desktop layout adapter only. Never owns a Fabric instance, transform, zoom,
 * or business state. Stable root on Desktop/Touch changes. The protected touch
 * shell's legacy desktop widening wrapper is corrected via scoped CSS, without
 * editing app/lib or moving the workstation's canvas ancestors.
 */
export function TakeoffDesktopHost({ active, fill = false, children }: { active: boolean; fill?: boolean; children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!active || fill || !host) return;
    let frame = 0;
    const measure = () => {
      // Document position, not scroll position, prevents scroll/resize feedback.
      const top = host.getBoundingClientRect().top + window.scrollY;
      const height = Math.max(360, Math.floor(window.innerHeight - top - 12));
      const value = `${height}px`;
      if (host.style.getPropertyValue('--qc-takeoff-height') !== value) {
        host.style.setProperty('--qc-takeoff-height', value);
      }
    };
    const queue = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(queue);
    // Required notices, header wrapping and shell width can change independently.
    for (const element of [host.parentElement, ...document.querySelectorAll('.qc-topbar, .qc-required-notices')]) {
      if (element) observer?.observe(element);
    }
    window.addEventListener('resize', queue);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener('resize', queue); };
  }, [active]);
  return <div ref={hostRef} className="qc-takeoff-host" data-qc-desktop={active ? 'true' : 'false'} {...(fill ? { 'data-qc-fill': 'true' } : {})}>{children}</div>;
}
