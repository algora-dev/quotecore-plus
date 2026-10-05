'use client';
import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import './qc.css';

let openDialogCount = 0;
let originalBodyOverflow = '';
function lockBody() {
  if (openDialogCount++ === 0) {
    originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  return () => {
    openDialogCount = Math.max(0, openDialogCount - 1);
    if (openDialogCount === 0) document.body.style.overflow = originalBodyOverflow;
  };
}

interface QcDialogProps {
  open: boolean;
  onRequestClose: () => void;
  /** Preserve the owning flow's Escape policy. The backdrop never dismisses. */
  pending?: boolean;
  title?: string;
  /** For an existing, visible heading inside children. */
  labelledBy?: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  initialFocusRef?: RefObject<HTMLElement>;
  className?: string;
}

/** C27 + C29. Native modal top layer supplies inert background and focus containment.
 * The feature still owns open/close, dirty state, confirmation and request timing.
 * Never add a backdrop click handler here: that is a locked product rule.
 */
export function QcDialog({ open, onRequestClose, pending = false, title, labelledBy,
  description, children, footer, size = 'sm', initialFocusRef, className = '' }: QcDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const initialFocus = useRef(initialFocusRef);
  initialFocus.current = initialFocusRef;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    const unlock = lockBody();
    initialFocus.current?.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      unlock();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;
  return (
    <dialog ref={dialogRef} data-qc-ui="v2" data-qc-component="C27" data-qc-size={size}
      className={`qc-dialog ${className}`} aria-modal="true"
      aria-labelledby={labelledBy || titleId} aria-describedby={description ? descriptionId : undefined}
      onCancel={event => { event.preventDefault(); if (!pending) onRequestClose(); }}>
      {title && <header className="qc-dialog-header"><h2 id={titleId}>{title}</h2>
        {description && <p id={descriptionId}>{description}</p>}
      </header>}
      {children && <div className="qc-dialog-body">{children}</div>}
      {footer && <div className="qc-dialog-footer">{footer}</div>}
    </dialog>
  );
}
