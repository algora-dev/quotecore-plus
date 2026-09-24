'use client';
import { createContext, useContext, useId, forwardRef, type HTMLAttributes, type ReactNode } from 'react';
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
 */
export function QcHostedDialog({ label, size = 'sm', onRequestClose, pending = false,
  className = '', children, ...legacyProps }: HTMLAttributes<HTMLDivElement> & {
  label: string; size?: 'sm' | 'md' | 'lg'; onRequestClose?: () => void; pending?: boolean;
}) {
  const enabled = useContext(HostedDialogPresentation);
  const nameId = useId();
  if (!enabled) return <div {...legacyProps} className={className}>{children}</div>;
  return <QcDialog open labelledBy={nameId} size={size}
    pending={pending || !onRequestClose} onRequestClose={onRequestClose ?? (() => {})}
    className="qc-hosted-dialog">
    <span id={nameId} className="qc-hosted-dialog-name">{label}</span>
    <div {...legacyProps} role={undefined} aria-modal={undefined} aria-labelledby={undefined}
      data-qc-component="C53" className={`qc-hosted-dialog-content ${className}`}>
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
