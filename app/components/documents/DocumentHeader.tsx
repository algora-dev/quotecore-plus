import type { ReactNode } from 'react';
import { DocumentRegion, type DocumentSelection } from './DocumentSelection';

/** C60. A shared reading hierarchy, not a shared business/data model. */
export function DocumentHeader({ title, number, companyName, logo, companyDetails, recipientLabel,
  recipient, meta, selection, headerTarget = 'header', recipientTarget, metaTarget }: {
  title: string; number?: ReactNode; companyName?: string; logo?: string | null;
  companyDetails?: ReactNode; recipientLabel: string; recipient: ReactNode; meta?: ReactNode;
  selection?: DocumentSelection; headerTarget?: string; recipientTarget?: string; metaTarget?: string;
}) {
  return <div className="qc-output-header" data-pdf-block>
    <div className="qc-output-masthead">
      <DocumentRegion selection={selection} id={headerTarget} label="company details and logo" className="qc-output-brand">
        {logo && <img src={logo} alt={companyName ? `${companyName} logo` : 'Company logo'} className="qc-output-logo" />}
        {companyName && <p className="qc-output-company">{companyName}</p>}
        <div className="qc-output-contact">{companyDetails}</div>
      </DocumentRegion>
      <div className="qc-output-document-identity"><p className="qc-output-kicker">{title}</p>{number && <h2>{number}</h2>}</div>
    </div>
    <div className="qc-output-address-row">
      <DocumentRegion selection={recipientTarget ? selection : undefined} id={recipientTarget || 'recipient'} label="recipient and delivery details" className="qc-output-recipient">
        <p className="qc-output-label">{recipientLabel}</p>{recipient}
      </DocumentRegion>
      <DocumentRegion selection={metaTarget ? selection : undefined} id={metaTarget || 'metadata'} label="document details" className="qc-output-metadata">{meta}</DocumentRegion>
    </div>
  </div>;
}
