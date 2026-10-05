'use client';
import { useEffect, useId, useRef, type ReactNode, type KeyboardEvent } from 'react';
import { QcButton } from '../../ui/v2/QcButton';
import { Icon } from './Choice';
let scrollLocks = 0;
let previousOverflow = '';
function lockPage(): () => void {
  if (scrollLocks++ === 0) { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
  return () => { if (--scrollLocks === 0) document.body.style.overflow = previousOverflow; };
}
/** Native modal: top-layer rendering, inert background, Escape and focus containment.
 * No portal needed; scoped QuoteCore tokens stay inherited. Real booking remains host-owned. */
export function FocusDialog({ title, eyebrow, onClose, children }: {
  title: string; eyebrow: string; onClose: () => void; children: ReactNode;
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
    const bounds = ref.current?.getBoundingClientRect();
    return !!bounds && (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom);
  }
  function containTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return;
    const dialog = ref.current;
    if (!dialog) return;
    const targets = Array.from(dialog.querySelectorAll<HTMLElement>('summary,button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'))
      .filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true');
    if (!targets.length) { event.preventDefault(); heading.current?.focus(); return; }
    const first = targets[0], last = targets[targets.length - 1];
    // Native dialogs make the page inert, but the final Tab can otherwise move to
    // browser chrome. Wrap both ends, including Shift+Tab from the initial heading.
    if (event.shiftKey && (document.activeElement === first || !targets.includes(document.activeElement as HTMLElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }
  return <dialog className="qcp-dialog" ref={ref} aria-labelledby={`${id}-title`} aria-modal="true" onKeyDown={containTab}
    onCancel={e => { e.preventDefault(); onClose(); }}
    onPointerDown={e => { backdropStarted.current = e.target === e.currentTarget && outside(e.clientX, e.clientY); }}
    onClick={e => { if (backdropStarted.current && e.target === e.currentTarget && outside(e.clientX, e.clientY)) onClose(); backdropStarted.current = false; }}>
    <header className="qcp-dialog-header"><p className="qcp-eyebrow"><span className="qcp-brand-dot" />{eyebrow}</p>
      <QcButton variant="glass" className="qcp-clear qcp-dialog-close" aria-label="Close dialog" onClick={onClose}><Icon name="close" size={19} /></QcButton>
      <h2 ref={heading} tabIndex={-1} id={`${id}-title`}>{title}</h2>
    </header>
    <div className="qcp-dialog-content">{children}</div>
  </dialog>;
}
