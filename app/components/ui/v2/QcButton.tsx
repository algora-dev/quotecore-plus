'use client';
import { forwardRef, type ButtonHTMLAttributes, type AnchorHTMLAttributes } from 'react';
import './qc.css';

export type QcButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'glass';
export type QcButtonSize = 'sm' | 'md' | 'lg';
export interface QcButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: QcButtonVariant;
  size?: QcButtonSize;
  /** Visual pending state only. The feature owns the request and its lifetime. */
  pending?: boolean;
}

/** C01. Native button/ref/form semantics; no request, pricing or permission logic. */
export const QcButton = forwardRef<HTMLButtonElement, QcButtonProps>(function QcButton(
  { variant = 'ghost', size = 'md', pending = false, disabled, type = 'button', className = '', children, ...props }, ref,
) {
  return (
    <button {...props} ref={ref} type={type} disabled={disabled || pending}
      aria-busy={pending || props['aria-busy'] || undefined}
      data-qc-component="C01" data-qc-variant={variant} data-qc-size={size}
      className={`qc-button ${className}`}>
      {children}
    </button>
  );
});

/** C02. For native links. Next Link can use the same class/data recipe directly. */
export const QcLinkButton = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: QcButtonVariant; size?: QcButtonSize;
}>(function QcLinkButton({ variant = 'ghost', size = 'md', className = '', ...props }, ref) {
  return <a {...props} ref={ref} data-qc-component="C02" data-qc-variant={variant}
    data-qc-size={size} className={`qc-button ${className}`} />;
});
