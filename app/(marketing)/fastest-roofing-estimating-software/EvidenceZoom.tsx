'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import s from './fastest.module.css';

type ZoomPayload = { src: string; alt: string; title: string; caption?: string };
type OpenZoom = (payload: ZoomPayload) => void;

const ZoomContext = createContext<OpenZoom>(() => {});

/**
 * Evidence zoom viewer for the fastest-roofing-estimating-software page.
 * Renders the modal OUTSIDE any transformed ancestor (hero cards use rotate/scale
 * transforms, which would break position:fixed inside them) and keeps the last
 * trigger focused for keyboard users on close.
 */
export function EvidenceZoomRoot({ children }: { children: ReactNode }) {
  const [zoom, setZoom] = useState<ZoomPayload | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const open = useCallback((payload: ZoomPayload) => {
    lastTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setZoom(payload);
  }, []);

  const close = useCallback(() => setZoom(null), []);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      lastTriggerRef.current?.focus();
    };
  }, [zoom, close]);

  return (
    <ZoomContext.Provider value={open}>
      {children}
      {zoom ? (
        <div
          className={`${s['image-modal']} ${s['open']}`}
          role="dialog"
          aria-modal="true"
          aria-label={zoom.title}
          onClick={close}
        >
          <div className={s['image-modal-dialog']} onClick={(event) => event.stopPropagation()}>
            <button type="button" className={s['image-modal-close']} aria-label="Close evidence preview" onClick={close} ref={closeRef}>
              ×
            </button>
            <div className={s['image-modal-meta']}>
              <div>
                <strong>{zoom.title}</strong>
                <span>{zoom.caption ?? 'Actual Quote #1040 benchmark evidence.'}</span>
              </div>
            </div>
            <img src={zoom.src} alt={zoom.alt} />
          </div>
        </div>
      ) : null}
    </ZoomContext.Provider>
  );
}

export function ZoomCard({ title, caption, src, alt, className, children }: {
  title: string;
  caption?: string;
  src: string;
  alt: string;
  className: string;
  children: ReactNode;
}) {
  const open = useContext(ZoomContext);
  return (
    <div
      className={className}
      role="button"
      tabIndex={0}
      data-modal-title={title}
      aria-label={`Open larger view: ${title}`}
      onClick={() => open({ src, alt, title, caption })}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open({ src, alt, title, caption });
        }
      }}
    >
      {children}
    </div>
  );
}
