'use client';

// Admin > Call to action: configure the end-of-flow email-capture popup -
// on/off, the discount on offer and all copy. {pct} placeholders fill with
// the discount percent. The tool popup reads these settings live.

import type { AdminData } from '../adminData';
import { SectionCard } from './AdminPanel';

export function AdminCta({ admin, setAdmin }: { admin: AdminData; setAdmin: (fn: (a: AdminData) => AdminData) => void }) {
  const inputCls = 'mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

  function patch(p: Partial<AdminData['cta']>) {
    setAdmin(a => ({ ...a, cta: { ...a.cta, ...p } }));
  }

  return (
    <SectionCard title="Call to action" desc="The popup shown on the pricing output. Offer a discount in exchange for an email signup - every capture lands in Tracking.">
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={admin.cta.enabled} onChange={e => patch({ enabled: e.target.checked })} className="h-4 w-4 accent-slate-900" />
        Show the popup on the output
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-slate-600">Discount on offer (%)</label>
          <input type="number" min="0" max="50" step="0.5" value={admin.cta.discountPct} onChange={e => patch({ discountPct: parseFloat(e.target.value) || 0 })} className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Headline</label>
          <input type="text" value={admin.cta.headline} onChange={e => patch({ headline: e.target.value })} className={inputCls} />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-slate-600">Body text</label>
          <textarea value={admin.cta.body} onChange={e => patch({ body: e.target.value })} rows={2} className={inputCls} />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-slate-600">Button label</label>
          <input type="text" value={admin.cta.buttonLabel} onChange={e => patch({ buttonLabel: e.target.value })} className={inputCls} />
        </div>
      </div>
      <p className="text-xs text-slate-400">Tip: use <code className="rounded bg-slate-100 px-1">{'{pct}'}</code> in any field to insert the discount percent automatically.</p>
    </SectionCard>
  );
}
