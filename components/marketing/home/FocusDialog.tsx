'use client';
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from './Icon';
import s from './Homepage.module.css';
import controls from '../MarketingButton.module.css';
let scrollLocks = 0;
let previousOverflow = '';
function lockPage() {
  if (scrollLocks++ === 0) { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
  return () => { if (--scrollLocks === 0) document.body.style.overflow = previousOverflow; };
}
/** Adapted from pricing-selector v5 FocusDialog: native top layer, inert page,
 * explicit tab containment, Escape, backdrop dismissal, focus restoration. */
export function FocusDialog({ title, eyebrow, onClose, children, wide = false }: {
  title: string; eyebrow: string; onClose: () => void; children: ReactNode; wide?: boolean;
}) {
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const backdropStarted = useRef(false);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const unlock = lockPage();
    dialog.showModal();
    heading.current?.focus({ preventScroll: true });
    return () => {
      if (dialog.open) dialog.close();
      unlock();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  function outside(x: number, y: number) {
    const b = ref.current?.getBoundingClientRect();
    return !!b && (x < b.left || x > b.right || y < b.top || y > b.bottom);
  }
  function containTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab' || !ref.current) return;
    const targets = Array.from(ref.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),summary,iframe,[tabindex]:not([tabindex="-1"])'))
      .filter(el => el.tabIndex >= 0 && el.getClientRects().length > 0);
    if (!targets.length) { event.preventDefault(); heading.current?.focus(); return; }
    const first = targets[0], last = targets[targets.length - 1];
    if (event.shiftKey && (document.activeElement === first || !targets.includes(document.activeElement as HTMLElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  return <dialog ref={ref} className={`${s.dialog} ${wide ? s.dialogWide : ''}`} aria-labelledby={`${id}-title`} aria-modal="true"
    onKeyDown={containTab} onCancel={e => { e.preventDefault(); onClose(); }}
    onPointerDown={e => { backdropStarted.current = e.target === e.currentTarget && outside(e.clientX, e.clientY); }}
    onClick={e => { if (backdropStarted.current && e.target === e.currentTarget && outside(e.clientX, e.clientY)) onClose(); backdropStarted.current = false; }}>
    <header className={s.dialogHeader}>
      <p className={s.eyebrow}>{eyebrow}</p>
      <button className={`${controls.button} ${controls.glass} ${s.iconButton} ${s.dialogClose}`} type="button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button>
      <h2 ref={heading} tabIndex={-1} id={`${id}-title`}>{title}</h2>
    </header>
    <div className={s.dialogBody}>{children}</div>
  </dialog>;
}
