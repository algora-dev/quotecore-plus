import Link from 'next/link';
import type { ReactNode } from 'react';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';

export function JobHeader({ title, customer, address, quoteLabel, status, statusTone, backHref,
  backLabel, updatedLabel, editHref, sendAction, expiry, primarySend }: {
  title: string; customer: string; address: string | null; quoteLabel: string; status: string;
  statusTone: string; backHref: string; backLabel: string; updatedLabel: string; editHref: string;
  sendAction: ReactNode; expiry: ReactNode; primarySend: boolean;
}) {
  return <header className="qc-job-header">
    <Link href={backHref} prefetch={false} className="qc-text-link qc-job-back"><QcIcon name="back" />{backLabel}</Link>
    <div className="qc-job-header-main"><div className="qc-job-identity">
      <h1>{title}</h1><p className="qc-job-subtitle">{customer}{address && address !== title ? ` · ${address}` : ''}</p>
      <div className="qc-job-meta"><span>{quoteLabel}</span><span className="qc-status" data-qc-tone={statusTone}>{status}</span><span>Updated {updatedLabel}</span></div>
    </div><div className="qc-job-header-actions"><Link href={editHref} prefetch={false} className="qc-button" data-qc-variant="glass"><QcIcon name="edit" />Edit pricing</Link>
      <div className="qc-job-send" data-primary={primarySend ? 'true' : 'false'}>{sendAction}</div></div></div>
    {expiry && <div className="qc-job-expiry">{expiry}</div>}
  </header>;
}
