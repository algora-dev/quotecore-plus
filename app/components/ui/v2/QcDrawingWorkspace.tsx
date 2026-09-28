'use client';

import { useState, type HTMLAttributes } from 'react';
import { QcButton } from './QcButton';
import { QcDialog } from './QcDialog';
import './qc.css';
import './qc-drawings.css';

/** C67: fixed-coordinate drawing host. No canvas dimensions, transforms,
 * pointer handlers, calculations, history or persistence are owned here. */
export function QcDrawingWorkspace({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} data-qc-ui="v2" data-qc-component="C67" className={`qc-drawing-workspace ${className}`} />;
}

/** C68: click/tap help, not an overflow-prone hover-only tooltip.
 * Nested native dialog reuses C27's focus, Escape and backdrop contracts. */
export function QcToolHelp({ title, description, image }: { title: string; description: string; image: string }) {
  const [open, setOpen] = useState(false);
  return <span className="qc-tool-help" data-qc-ui="v2">
    <QcButton size="sm" className="qc-icon-button" aria-label={`Help: ${title}`} aria-haspopup="dialog"
      onClick={event => { event.preventDefault(); event.stopPropagation(); setOpen(true); }}>
      <span aria-hidden="true">?</span>
    </QcButton>
    <QcDialog open={open} title={title} onRequestClose={() => setOpen(false)}
      footer={<QcButton onClick={() => setOpen(false)}>Close help</QcButton>}>
      {/* Existing local illustration; no image transformation or geometry. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt={title} className="qc-tool-help-image" />
      <p className="qc-tool-help-copy">{description}</p>
    </QcDialog>
  </span>;
}
