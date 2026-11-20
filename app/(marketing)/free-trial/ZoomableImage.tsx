'use client';

import { useCallback, useEffect, useId, useRef, useState, type MouseEvent } from 'react';
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
 * An image that opens in a clean, centered modal overlay
 * (owner 2026-11-20: the native dialog felt glitchy; this state-driven
 * overlay animates in, locks page scroll, closes on Escape/backdrop and
 * restores focus to the trigger). Keeping this a small client boundary
 * preserves the server-component marketing pages.
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
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  const closeImage = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeImage();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger.current?.focus();
    };
  }, [open, closeImage]);

  function onBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) closeImage();
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
            <div className={styles.zoomDialogInner}>
              <button
                ref={closeRef}
                type="button"
                className={styles.zoomDialogClose}
                onClick={closeImage}
                aria-label="Close image preview"
              >
                ×
              </button>
              <Image
                src={src}
                alt={alt}
                width={width}
                height={height}
                sizes="(max-width: 620px) 100vw, 1240px"
                className={styles.zoomDialogImage}
              />
              <p id={titleId} className={styles.zoomDialogCaption}>{title}</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
