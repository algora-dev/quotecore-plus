'use client';
import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { AssistantIcon } from './AssistantIcon';
import s from './assistant.module.css';

/** Local sheet, inside the existing assistant dialog. Never pushes the composer down. */
export function AssistantSheet({ title, onClose, background, children }: {
  title: string; onClose: () => void; background: RefObject<HTMLDivElement>; children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const id = useId();
  useEffect(() => {
    const origin = document.activeElement as HTMLElement | null;
    const behind = background.current;
    const previousInert = behind?.inert ?? false;
    if (behind) behind.inert = true; // eslint-disable-line react-hooks/immutability -- imperative DOM inert control on a parent-owned element; restored on unmount below
    close.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCloseRef.current(); return; }
      if (e.key !== 'Tab') return;
      const nodes = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? [])
        .filter(node => node.getClientRects().length > 0);
      const first = nodes[0]; const last = nodes.at(-1);
      if (!first) { e.preventDefault(); return; }
      if (e.shiftKey && (document.activeElement === first || !panel.current?.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !panel.current?.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('keydown', key, true);
      if (behind) behind.inert = previousInert;
      if (origin?.isConnected && !origin.closest('[inert]')) origin.focus({ preventScroll: true });
    };
  }, [background]);
  return <div className={s.sheetBackdrop} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className={s.sheet} role="dialog" aria-modal="true" aria-labelledby={id} ref={panel}>
      <div className={s.sheetHandle} aria-hidden="true" />
      <div className={s.sheetHeader}><h2 id={id}>{title}</h2><QcButton ref={close} className={s.iconButton} aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}><AssistantIcon name="close" /></QcButton></div>
      <div className={s.sheetBody}>{children}</div>
    </div>
  </div>;
}
