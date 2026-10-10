'use client';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import './guided-identity.css';

/** Replaces only the existing creation CTA; catalogue and library controls stay put. */
export function ComponentCreationActions({ onGuided, onQuick, disabled = false }: {
  onGuided: () => void; onQuick: () => void; disabled?: boolean;
}) {
  return <div data-qc-ui="v2" className="qc-identity-entry" role="group" aria-label="Create a Smart Component™">
    <QcButton variant="primary" disabled={disabled} className="qc-identity-glint" onClick={onGuided}
      data-copilot="add-component-guided" aria-label="Create with guidance, one step at a time">
      <QcIcon name="assistant" />Create with guidance
    </QcButton>
    <QcButton variant="secondary" disabled={disabled} className="qc-identity-glint" onClick={onQuick}
      data-copilot="add-component" aria-label="Quick create, open the existing editor">
      <QcIcon name="plus" />Quick create
    </QcButton>
  </div>;
}
