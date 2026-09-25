'use client';
import { createContext, useContext, useId, forwardRef, useCallback, type HTMLAttributes, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
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
 */
export function QcHostedDialog({ label, size = 'sm', onRequestClose, pending = false, floating = false,
  className = '', children, ...legacyProps }: HTMLAttributes<HTMLDivElement> & {
  label: string; size?: 'sm' | 'md' | 'lg'; onRequestClose?: () => void; pending?: boolean; floating?: boolean;
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
