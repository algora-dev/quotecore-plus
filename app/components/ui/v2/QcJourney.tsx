'use client';

import { useId, type HTMLAttributes, type ReactNode } from 'react';
import { QcDialog } from './QcDialog';
import { QcHostedDialogScope } from './QcHostedDialog';
import './qc.css';
import './qc-journeys.css';

/** C61: opt-in presentation for the journeys between workspaces.
 * No request, routing, form, entitlement or selection state is owned here.
 * Only explicitly classed controls are styled; embedded workspaces are not reset.
 */
export function QcJourney({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} data-qc-ui="v2" data-qc-component="C61" className={`qc-journey ${className}`}>{children}</div>;
}

export function QcJourneyHeader({ title, description, eyebrow, children }: {
  title: string; description?: string; eyebrow?: string; children?: ReactNode;
}) {
  return <header className="qc-journey-header">
    <div>{eyebrow && <p className="qc-journey-eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>{description && <p>{description}</p>}
    </div>{children && <div className="qc-journey-header-actions">{children}</div>}
  </header>;
}

/** C62: non-interactive progress, reflecting (never driving) the caller's step.
 * It intentionally cannot skip validation or move a user between stages.
 */
export function QcJourneySteps({ steps, current, label = 'Progress' }: {
  steps: readonly string[]; current: number; label?: string;
}) {
  return <ol className="qc-journey-steps" aria-label={label} data-qc-component="C62">
    {steps.map((step, index) => <li key={step} aria-current={index === current ? 'step' : undefined}
      data-complete={index < current || undefined}>
      <span aria-hidden="true">{index < current ? '✓' : index + 1}</span><strong>{step}</strong>
    </li>)}
  </ol>;
}

/** C63: use the existing C27 native-dialog controller, not a second overlay system.
 * Original content/handlers are supplied as children. Default Escape policy is
 * explicit-action-only, as in the converted legacy overlays. Backdrop never closes.
 * Only pass onRequestClose when that flow already supports Escape dismissal.
 */
export function QcJourneyDialog({ label, children, size = 'md', onRequestClose, pending = false }: {
  label: string; children: ReactNode; size?: 'sm' | 'md' | 'lg'; onRequestClose?: () => void; pending?: boolean;
}) {
  const id = useId();
  return <QcDialog open labelledBy={id} size={size} pending={pending || !onRequestClose}
    onRequestClose={onRequestClose ?? (() => {})} className="qc-journey-dialog">
    <span id={id} className="qc-flow-sr-only">{label}</span>
    <QcHostedDialogScope enabled><div className="qc-flow-dialog-content">{children}</div></QcHostedDialogScope>
  </QcDialog>;
}
