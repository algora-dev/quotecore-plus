'use client';

import { useEffect, useId, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
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
 * Enlarged-image viewer, rebuilt from scratch (owner 2026-11-20).
 *
 * Root cause of the previous glitchiness: the overlay rendered inside the
 * card elements, whose hover transforms (translateY lift) reposition any
 * position:fixed descendant while it is open. This version portals the
 * overlay to document.body so it lives outside every animated ancestor.
 *
 * Deliberately simple: plain dark overlay, centered white card, image with
 * explicit intrinsic dimensions (no size jump while loading), close on X,
 * backdrop click or Escape. No animations, no scroll lock, no focus
 * juggling. The full-size image is preloaded on hover so it is usually
 * cached before the click.
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
  const titleId = useId();

  function preloadFullImage() {
    const preload = document.createElement('img');
    preload.src = src;
  }

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
        type="button"
        className={className}
        onClick={() => setOpen(true)}
        onMouseEnter={preloadFullImage}
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
      {open
        ? createPortal(
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
                {/* eslint-disable-next-line @next/next/no-img-element -- Plain img with intrinsic dimensions; preloaded on hover so it renders instantly. */}
                <img src={src} alt={alt} width={width} height={height} className={styles.zoomDialogImage} />
                <p id={titleId} className={styles.zoomDialogCaption}>{title}</p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
