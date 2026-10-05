'use client';

import { useId, useEffect, useRef, type HTMLAttributes, type ReactNode } from 'react';
import { QcButton } from './QcButton';
import './qc-document.css';

/** C55 / T05. Presentation only: the editor retains every data and save owner.
 * Never put document-specific calculations, requests or routing in this file.
 * One controls tree and one live preview tree at every viewport size.
 */
export function QcDocumentWorkspace({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} data-qc-ui="v2" data-qc-component="C55"
    className={`qc-document-workspace ${className}`}>{children}</div>;
}

export function QcDocumentHeader({ title, subtitle, back, status, actions }: {
  title: ReactNode; subtitle?: ReactNode; back?: ReactNode; status?: ReactNode; actions?: ReactNode;
}) {
  return <header className="qc-document-header qc-document-controls">
    <div className="qc-document-heading">
      {back && <div className="qc-document-back">{back}</div>}
      <div className="qc-document-identity"><p className="qc-document-eyebrow">Document workspace</p>
        <h1>{title}</h1>{subtitle && <p className="qc-document-subtitle">{subtitle}</p>}
      </div>
    </div>
    <div className="qc-document-header-end">{status}{actions && <div className="qc-document-actions">{actions}</div>}</div>
  </header>;
}

/** Shows only state supplied by the existing controller. An undefined dirty
 * state (Orders) does NOT mean saved. No timer, observer, polling or autosave.
 */
export function QcDocumentSaveState({ saving = false, dirty, lastSaved, idle = 'Save before leaving' }: {
  saving?: boolean; dirty?: boolean; lastSaved?: Date | null; idle?: string;
}) {
  const text = saving ? 'Saving…' : dirty ? 'Unsaved changes' : lastSaved
    ? `Saved ${lastSaved.toLocaleTimeString()}` : idle;
  return <p className="qc-document-save-state" role="status" aria-live="polite"
    data-state={saving ? 'saving' : dirty ? 'dirty' : lastSaved ? 'saved' : 'idle'}>
    <span aria-hidden="true" />{text}
  </p>;
}

export function QcDocumentBody({ children, collapsed = false }: { children: ReactNode; collapsed?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const previousCollapsed = useRef(collapsed);
  useEffect(() => {
    if (previousCollapsed.current === collapsed) return;
    previousCollapsed.current = collapsed;
    // Presentation-only focus handoff. A hidden Hide button must not retain
    // keyboard focus; reopening returns focus to the editing panel.
    rootRef.current?.querySelector<HTMLButtonElement>(collapsed
      ? '[data-qc-document-expand]' : '[data-qc-document-collapse]')?.focus();
  }, [collapsed]);
  return <div ref={rootRef} className="qc-document-body" data-panel-collapsed={collapsed}>{children}</div>;
}

/** `hidden` removes the controls from layout AND tab order, without unmounting
 * children. A visible Show editing panel button must live in the preview bar.
 */
export function QcDocumentPanel({ collapsed = false, children, className = '', ...props }: HTMLAttributes<HTMLDivElement> & {
  collapsed?: boolean;
}) {
  return <div {...props} className={`qc-document-panel qc-document-controls ${className}`}
    hidden={collapsed}>{children}</div>;
}

export function QcDocumentPanelHeader({ title = 'Edit document', description, count, onCollapse, action }: {
  title?: string; description?: string; count?: number; onCollapse?: () => void; action?: ReactNode;
}) {
  return <div className="qc-document-panel-header">
    <div className="qc-document-panel-title"><h2>{title}</h2>
      {count !== undefined && <span className="qc-document-count">{count}</span>}
      {onCollapse && <QcButton size="sm" onClick={onCollapse} className="qc-document-collapse"
        data-qc-document-collapse title="Hide editing panel" aria-label="Hide editing panel"><span aria-hidden="true">‹</span><span>Hide</span></QcButton>}
    </div>
    {description && <p className="qc-document-help">{description}</p>}
    {action && <div className="qc-document-add">{action}</div>}
  </div>;
}

/** Non-collapsing sections keep guide targets and all capabilities reachable. */
export function QcDocumentSection({ title, description, children, action, className = '', ...props }: HTMLAttributes<HTMLElement> & {
  title: string; description?: ReactNode; action?: ReactNode;
}) {
  const id = useId();
  return <section {...props} className={`qc-document-section ${className}`} aria-labelledby={id}>
    <div className="qc-document-section-heading"><h3 id={id}>{title}</h3>{action}</div>
    {description && <p className="qc-document-help">{description}</p>}
    {children}
  </section>;
}

/** The document island is deliberately OUTSIDE qc-document-controls.
 * It receives no fonts, colours, visibility rules, margin maths or PDF hooks
 * from this chrome. Preserve the original PDF selector inside children.
 */
export function QcDocumentPreview({ title = 'Live preview', description, tools, collapsed = false,
  onExpand, children, className = '', ...props }: HTMLAttributes<HTMLDivElement> & {
  title?: string; description?: ReactNode; tools?: ReactNode; collapsed?: boolean; onExpand?: () => void;
}) {
  return <div {...props} className={`qc-document-preview ${className}`}>
    <div className="qc-document-preview-bar qc-document-controls">
      <div><h2>{title}</h2>{description && <p className="qc-document-help">{description}</p>}</div>
      <div className="qc-document-preview-tools">
        {collapsed && onExpand && <QcButton size="sm" onClick={onExpand} data-qc-document-expand aria-label="Show editing panel">Show editing panel</QcButton>}
        {tools}
      </div>
    </div>
    <div className="qc-document-preview-scroll" role="region" aria-label={title} tabIndex={0}>
      {children}
    </div>
  </div>;
}

/** C56. Opt-in visual adapter for legacy document forms/overlays only. This
 * does not create a dialog, change Escape/backdrop policy, portal, or trap
 * focus. The original dialog/form controller remains mounted inside it.
 * Never apply it at the app root, to Takeoff or to a recipient document.
 */
export function QcDocumentDialogScope({ children }: { children: ReactNode }) {
  return <div className="qc-document-dialog-scope" data-qc-ui="v2" data-qc-component="C56">{children}</div>;
}
