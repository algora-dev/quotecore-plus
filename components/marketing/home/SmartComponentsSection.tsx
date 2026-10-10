'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Smart Components(TM) premium section, website edition 1.0.0 (approved package).
 * Loads the native bundle once, then mounts <qc-smart-pricing-section autoplay
 * loop> client-side. All rendering, styling, animation and the demonstration
 * calculator stay inside the shadow-scoped custom element; nothing here touches
 * production pricing logic. Server markup is a readable fallback statement.
 */
type PricingSectionElement = HTMLElement & {
  ready: Promise<PricingSectionElement>;
  animation: HTMLElement & {
    play(): void;
    pause(): void;
    replay(): void;
    seek(seconds: number, options?: { play?: boolean }): void;
    enterExplore(focus?: boolean): void;
  };
};

const SCRIPT_SRC = '/quotecore/qc-smart-pricing-section.js';
let sectionScript: Promise<void> | null = null;

function loadSectionScript(): Promise<void> {
  if (customElements.get('qc-smart-pricing-section')) return Promise.resolve();
  if (sectionScript) return sectionScript;
  sectionScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (customElements.get('qc-smart-pricing-section')) resolve();
      else {
        script.remove();
        sectionScript = null;
        reject(new Error('The pricing-section script did not register its component.'));
      }
    };
    script.onerror = () => {
      script.remove();
      sectionScript = null;
      reject(new Error('Unable to load the Smart Components\u2122 demonstration.'));
    };
    document.head.appendChild(script);
  });
  return sectionScript;
}

export function SmartComponentsSection({ className }: { className?: string }) {
  const mount = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let section: PricingSectionElement | undefined;
    loadSectionScript()
      .then(async () => {
        if (cancelled || !mount.current) return;
        section = document.createElement('qc-smart-pricing-section') as PricingSectionElement;
        section.setAttribute('autoplay', '');
        section.setAttribute('loop', '');
        mount.current.appendChild(section);
        await section.ready;
        if (cancelled) return;
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      section?.remove(); // Disconnects observers and cancels animation frames.
    };
  }, []);

  return (
    <div id="smart-components" className={className}>
      <div ref={mount} />
      {!loaded && (
        <p role={failed ? 'status' : undefined} className="smart-components-fallback">
          {failed ? 'The interactive demonstration could not load. ' : ''}
          You bring the knowledge. Smart Components™ save it and handle the calculations.
        </p>
      )}
    </div>
  );
}
