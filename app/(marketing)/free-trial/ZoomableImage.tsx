'use client';

import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import Image from 'next/image';
import styles from './FreeWorkspaceLocked.module.css';

type ZoomableImageProps = {
  src: string;
  alt: string;
  title: string;
  width: number;
  height: number;
  className: string;
  badge?: string;
  hint?: string;
  sizes?: string;
  priority?: boolean;
};

/**
 * An image that opens as a simple centered enlarged view (owner 2026-11-20):
 * plain overlay, no animations, no scroll lock, no blur - just show the
 * image large in the middle of the page and close on X, backdrop or Escape.
 * Small client boundary keeps the marketing pages server-rendered.
 */
export default function ZoomableImage({
  src,
  alt,
  title,
  width,
  height,
  className,
  badge,
  hint,
  sizes = '(max-width: 620px) 100vw, 50vw',
  priority = false,
}: ZoomableImageProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function onBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) setOpen(false);
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={className}
        onClick={() => setOpen(true)}
        aria-label={`View larger: ${title}`}
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          priority={priority}
        />
        {badge ? <span className={badge.includes(' / Demo job') ? styles.demoTag : styles.heroTag}>{badge}</span> : null}
        {hint ? (
          <span className={badge?.includes(' / Demo job') ? styles.enlarge : styles.heroHint} aria-hidden="true">
            {badge?.includes(' / Demo job') ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="10" cy="10" r="6" />
                <path d="m15 15 6 6M10 7v6M7 10h6" />
              </svg>
            ) : null}
            {hint}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className={styles.zoomOverlay} onClick={onBackdropClick} role="presentation">
          <div
            className={styles.zoomDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.zoomDialogClose}
              onClick={() => setOpen(false)}
              aria-label="Close image preview"
            >
              ×
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element -- Plain img: uses the exact src already cached by the browser, no re-optimization pop-in. */}
            <img src={src} alt={alt} className={styles.zoomDialogImage} />
            <p id={titleId} className={styles.zoomDialogCaption}>{title}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
