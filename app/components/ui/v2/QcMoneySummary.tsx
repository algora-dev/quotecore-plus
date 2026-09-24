'use client';
import type { ReactNode } from 'react';
import './qc.css';

/** C35. Accept already-formatted values only. Never calculate or convert here. */
export function QcMoneySummary({ audience, title, rows, totalLabel, total, note }: {
  audience: 'internal' | 'customer' | 'labour' | 'invoice';
  title: string; rows: readonly { id: string; label: string; value: ReactNode }[];
  totalLabel: string; total: ReactNode; note?: ReactNode;
}) {
  return (
    <section data-qc-component="C35" data-qc-audience={audience} className="qc-money-summary" aria-label={title}>
      <h2>{title}</h2>
      <dl className="qc-money-rows">
        {rows.map(row => <div key={row.id}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
      </dl>
      <dl className="qc-money-total"><div><dt>{totalLabel}</dt><dd>{total}</dd></div></dl>
      {note && <p className="qc-help">{note}</p>}
    </section>
  );
}
