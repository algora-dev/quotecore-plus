import type { ReactNode } from 'react';
import './qc-document-output.css';

/** Optional editor-only affordance. Recipient/export callers omit selection. */
export interface DocumentSelection { active: string; hovered?: string; onSelect: (target: string) => void }
export function documentRegion(selection: DocumentSelection | undefined, id: string) {
  return { 'data-doc-region': id, 'data-doc-selected': selection?.active === id || undefined,
    'data-doc-hovered': selection?.hovered === id || undefined, 'data-doc-interactive': !!selection || undefined };
}
export function DocumentEditTarget({ selection, id, label }: {
  selection?: DocumentSelection; id: string; label: string;
}) {
  if (!selection) return null;
  return <button type="button" className="qc-output-edit-target" data-exclude-pdf data-html2canvas-ignore="true"
    aria-label={`Edit ${label}`} aria-pressed={selection.active === id} onClick={() => selection.onSelect(id)}>
    <span aria-hidden="true">Edit</span>
  </button>;
}
/** A normal block, not a table row/section, owns the absolute edit target.
 * WebKit versions that ignore positioned tr/tfoot must not anchor it to the page.
 * Recipient callers retain exactly their original cell contents. */
export function DocumentCellContent({ selection, id, label, children }: {
  selection?: DocumentSelection; id: string; label: string; children: ReactNode;
}) {
  if (!selection) return <>{children}</>;
  return <div className="qc-output-cell-content">
    {children}<DocumentEditTarget selection={selection} id={id} label={label} />
  </div>;
}
export function DocumentRegion({ selection, id, label, children, className = '' }: {
  selection?: DocumentSelection; id: string; label: string; children: ReactNode; className?: string;
}) {
  return <div className={`qc-output-region ${className}`} {...documentRegion(selection, id)}>
    {children}<DocumentEditTarget selection={selection} id={id} label={label} />
  </div>;
}
