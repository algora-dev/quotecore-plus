'use client';

import { useId, useRef, type MouseEvent } from 'react';
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
 * An image that opens a native, keyboard-accessible dialog.
 * Using a small client boundary keeps the marketing page a server component.
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
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  function openImage() {
    if (!dialog.current?.open) dialog.current?.showModal();
  }

  function closeImage() {
    dialog.current?.close();
  }

  function onBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) closeImage();
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={className}
        onClick={openImage}
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
      <dialog
        ref={dialog}
        className={styles.zoomDialog}
        aria-labelledby={titleId}
        onClick={onBackdropClick}
        onClose={() => trigger.current?.focus()}
      >
        <div className={styles.zoomDialogInner}>
          <button
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
      </dialog>
    </>
  );
}
