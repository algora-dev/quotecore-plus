'use client';
import { createContext, useContext, useId, useRef, forwardRef, useCallback, type HTMLAttributes, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { QcDialog } from './QcDialog';
import { QcButton, type QcButtonProps } from './QcButton';
import './qc-hosted-dialog.css';

const HostedDialogPresentation = createContext(false);
/** Opt in a reviewed flow, never the whole app. Inherited by nested pickers.
 * Disabled for the hidden desktop owner beneath the mobile/touch workspace.
 */
export function QcHostedDialogScope({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <HostedDialogPresentation.Provider value={enabled}>{children}</HostedDialogPresentation.Provider>;
}
/** C53: compatibility adapter onto C27, not a second modal controller.
 * Keeps existing form state/callbacks in the caller and leaves non-opted-in
 * callers on their original div. The named close callback is optional: absent
 * means the original explicit-action-only Escape policy. Backdrop NEVER closes.
 * Existing key handlers remain on the content (e.g. Line's Enter/Escape).
 *
 * floating (2026-09-25): small measurement-entry dialogs that must NOT block
 * the canvas behind them - no backdrop blur/dim beyond a faint veil, and a
 * drag grip so the user can move the dialog aside to read the plan (e.g. the
 * line they just drew whose length they are typing in). Works in both the
 * native-dialog path (drags the <dialog>) and the legacy div path (drags the
 * first card child).
 *
 * modeless (2026-09-25, desktop scope only): renders a plain floating card
 * instead of a native modal - NO backdrop, NO inert background, NO body
 * scroll lock. The page/canvas behind stays fully interactive (pan/zoom) so
 * the user can reveal the measurement they need while the card is open.
 * Freeform drag via the header strip. Legacy (touch) scope is untouched.
 */
export function QcHostedDialog({ label, size = 'sm', onRequestClose, pending = false, floating = false, modeless = false,
  className = '', children, ...legacyProps }: HTMLAttributes<HTMLDivElement> & {
  label: string; size?: 'sm' | 'md' | 'lg'; onRequestClose?: () => void; pending?: boolean; floating?: boolean; modeless?: boolean;
}) {
  const enabled = useContext(HostedDialogPresentation);
  const nameId = useId();

  // Pointer-based drag of the floating dialog. The drag target is the native
  // <dialog> (enabled path) or the legacy overlay's first card (div path).
  // The translation lives in element-local CSS vars so re-renders never fight
  // the drag offset and no React state is needed.
  const onGripPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const grip = event.currentTarget;
    const dragTarget = (enabled ? grip.closest('dialog') : grip.nextElementSibling) as HTMLElement | null;
    if (!dragTarget) return;
    event.preventDefault();
    grip.setPointerCapture(event.pointerId);
    let dx = parseFloat(dragTarget.style.getPropertyValue('--qc-drag-x')) || 0;
    let dy = parseFloat(dragTarget.style.getPropertyValue('--qc-drag-y')) || 0;
    const lastX = event.clientX;
    const lastY = event.clientY;
    const rect = dragTarget.getBoundingClientRect(); // geometry at drag start
    const minX = 8 - rect.left;
    const maxX = window.innerWidth - 8 - rect.right;
    const minY = 8 - rect.top;
    const maxY = window.innerHeight - 8 - rect.bottom;
    const onMove = (e: PointerEvent) => {
      dx = Math.min(Math.max(dx + (e.clientX - lastX), minX), maxX);
      dy = Math.min(Math.max(dy + (e.clientY - lastY), minY), maxY);
      dragTarget.style.setProperty('--qc-drag-x', `${dx}px`);
      dragTarget.style.setProperty('--qc-drag-y', `${dy}px`);
    };
    const onUp = () => {
      grip.removeEventListener('pointermove', onMove);
      grip.removeEventListener('pointerup', onUp);
      grip.removeEventListener('pointercancel', onUp);
    };
    grip.addEventListener('pointermove', onMove);
    grip.addEventListener('pointerup', onUp);
    grip.addEventListener('pointercancel', onUp);
  }, [enabled]);

  // Modeless card drag: header moves the card via left/top (fixed position).
  const modelessRef = useRef<HTMLDivElement | null>(null);
  const onModelessHeaderPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const card = modelessRef.current;
    const header = event.currentTarget;
    if (!card) return;
    event.preventDefault();
    header.setPointerCapture(event.pointerId);
    const rect = card.getBoundingClientRect();
    const grabX = event.clientX - rect.left;
    const grabY = event.clientY - rect.top;
    const onMove = (e: PointerEvent) => {
      const x = Math.min(Math.max(e.clientX - grabX, 8), Math.max(8, window.innerWidth - rect.width - 8));
      const y = Math.min(Math.max(e.clientY - grabY, 8), Math.max(8, window.innerHeight - 48));
      card.style.left = `${x}px`;
      card.style.top = `${y}px`;
      card.style.right = 'auto';
    };
    const onUp = () => {
      header.removeEventListener('pointermove', onMove);
      header.removeEventListener('pointerup', onUp);
      header.removeEventListener('pointercancel', onUp);
    };
    header.addEventListener('pointermove', onMove);
    header.addEventListener('pointerup', onUp);
    header.addEventListener('pointercancel', onUp);
  }, []);

  // Modeless presentation (desktop scope only): a floating card, not a modal.
  if (enabled && modeless) {
    return (
      <div ref={modelessRef} role="dialog" aria-label={label} data-qc-component="C53"
        className="qc-modeless-card qc-hosted-dialog">
        <div className="qc-modeless-header" onPointerDown={onModelessHeaderPointerDown}>
          <span className="qc-modeless-grip" aria-hidden="true" />
          <span className="qc-modeless-label">{label}</span>
        </div>
        <div className="qc-modeless-body">{children}</div>
      </div>
    );
  }

  // In the enabled (native dialog) presentation the legacy wrapper classes are
  // viewport-overlay mechanics (fixed inset-0 backdrop/centering) that break
  // hit-testing inside a native <dialog>: content painted outside the dialog
  // box cannot receive pointer events, which made lower form rows (confirm
  // buttons) unclickable. Strip overlay/positioning utilities; keep the rest.
  const overlayMechanics = new Set(['fixed', 'inset-0', 'flex', 'items-center', 'justify-center', 'bg-black/50', 'bg-black/40', 'z-40', 'z-50', 'z-[60]']);
  const retained = className.split(/\s+/).filter(Boolean).filter((cls) => !overlayMechanics.has(cls) && !/^z-\d+$/.test(cls) && !/^inset-/.test(cls)).join(' ');
  if (!enabled) return (
    <div {...legacyProps} className={`${className}${floating ? ' qc-hosted-floating-legacy' : ''}`}>
      {floating && <div onPointerDown={onGripPointerDown} className="qc-hosted-floating-grip" aria-hidden="true" />}
      {children}
    </div>
  );
  return <QcDialog open labelledBy={nameId} size={size}
    pending={pending || !onRequestClose} onRequestClose={onRequestClose ?? (() => {})}
    className={floating ? 'qc-hosted-dialog qc-hosted-floating' : 'qc-hosted-dialog'}>
    <span id={nameId} className="qc-hosted-dialog-name">{label}</span>
    {floating && <div onPointerDown={onGripPointerDown} className="qc-hosted-floating-grip" aria-hidden="true" />}
    <div {...legacyProps} role={undefined} aria-modal={undefined} aria-labelledby={undefined}
      data-qc-component="C53" className={`qc-hosted-dialog-content ${retained}`}>
      {children}
    </div>
  </QcDialog>;
}

/** C01 adapter. Preserve native default submit semantics and legacy classes
 * outside the explicitly reviewed scope. No implicit disabled/pending guards. */
export const QcHostedButton = forwardRef<HTMLButtonElement, QcButtonProps>(function QcHostedButton(
  { variant = 'ghost', size, pending, ...props }, ref,
) {
  const enabled = useContext(HostedDialogPresentation);
  if (!enabled) return <button {...props} ref={ref} />;
  return <QcButton {...props} ref={ref} type={props.type ?? 'submit'} variant={variant} size={size} pending={pending} />;
});
