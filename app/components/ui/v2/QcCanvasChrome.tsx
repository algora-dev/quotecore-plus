'use client';
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { QcButton, type QcButtonProps } from './QcButton';
import './qc-canvas.css';

/** C52: presentation only. The caller owns tools, guards, history and coordinates.
 * Use labelled groups (native Tab order), not an ARIA toolbar without arrow keys.
 * Keep this OUTSIDE the canvas scroll/coordinate owner. No canvas-sized overlay.
 */
export function QcCanvasToolbar({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} data-qc-component="C52" className={`qc-canvas-toolbar ${className}`}>{children}</div>;
}
export function QcCanvasToolGroup({ label, children, className = '' }: {
  label: string; children: ReactNode; className?: string;
}) {
  return <div role="group" aria-label={label} className={`qc-canvas-tool-group ${className}`}>{children}</div>;
}
export const QcToolButton = forwardRef<HTMLButtonElement, QcButtonProps & { selected?: boolean }>(
  function QcToolButton({ selected, className = '', ...props }, ref) {
    return <QcButton {...props} ref={ref} size={props.size ?? 'sm'}
      aria-pressed={selected ?? props['aria-pressed']}
      className={`qc-canvas-tool ${className}`} />;
  },
);
