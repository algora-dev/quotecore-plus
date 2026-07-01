'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updatePlan, type PlanData } from './actions';

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(0)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${bytes} B`;
}

const FEAT_FIELDS: { key: keyof PlanData; label: string }[] = [
  { key: 'feat_activity_card', label: 'Activity Card' },
  { key: 'feat_attachment_library', label: 'Attachments' },
  { key: 'feat_catalogs', label: 'Catalogs' },
  { key: 'feat_digital_takeoff', label: 'Digital Takeoff' },
  { key: 'feat_email_send', label: 'Email Send' },
  { key: 'feat_flashings', label: 'Drawings' },
  { key: 'feat_followups', label: 'Follow-ups' },
  { key: 'feat_invoices', label: 'Invoices' },
  { key: 'feat_material_orders', label: 'Material Orders' },
  { key: 'feat_message_center', label: 'Message Center' },
];

export function PlanManagementTab({ plans }: { plans: PlanData[] }) {
  const router = useRouter();
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [priceAck, setPriceAck] = useState(false);

  // Editable field state per expanded plan
  const [editData, setEditData] = useState<Record<string, unknown>>({});

  function toggleExpand(plan: PlanData) {
    if (expandedCode === plan.code) {
      setExpandedCode(null);
      setEditData({});
      setPriceAck(false);
    } else {
      setExpandedCode(plan.code);
      setEditData({
        display_name: plan.display_name,
        tagline: plan.tagline ?? '',
        price_cents_monthly: plan.price_cents_monthly,
        price_cents_monthly_original: plan.price_cents_monthly_original ?? '',
        active: plan.active,
        coming_soon: plan.coming_soon,
        sort_order: plan.sort_order,
        monthly_quote_limit: plan.monthly_quote_limit,
        storage_limit_bytes: plan.storage_limit_bytes,
        component_limit: plan.component_limit ?? '',
        flashing_limit: plan.flashing_limit ?? '',
        attachment_limit: plan.attachment_limit ?? '',
        catalog_limit: plan.catalog_limit ?? '',
        included_seats: plan.included_seats,
        monthly_ai_tokens: plan.monthly_ai_tokens ?? '',
        monthly_invoice_limit: plan.monthly_invoice_limit ?? '',
        monthly_material_order_limit: plan.monthly_material_order_limit ?? '',
        ...Object.fromEntries(FEAT_FIELDS.map((f) => [f.key, plan[f.key]])),
      });
      setPriceAck(false);
    }
  }

  function save(planCode: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      // Build fields object, converting empty strings to null
      const fields: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(editData)) {
        if (v === '' || v === undefined) {
          fields[k] = null;
        } else {
          fields[k] = v;
        }
      }
      // Convert numeric fields
      const numericFields = ['price_cents_monthly', 'price_cents_monthly_original', 'sort_order', 'monthly_quote_limit', 'storage_limit_bytes', 'component_limit', 'flashing_limit', 'attachment_limit', 'catalog_limit', 'included_seats', 'monthly_ai_tokens', 'monthly_invoice_limit', 'monthly_material_order_limit'];
      for (const nf of numericFields) {
        if (fields[nf] !== null && fields[nf] !== undefined) {
          fields[nf] = Number(fields[nf]);
        }
      }

      const res = await updatePlan(planCode, fields, priceAck);
      if (res.ok) {
        setNotice(res.message);
        setExpandedCode(null);
        setEditData({});
        setPriceAck(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          ✅ {notice}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stripe fields notice */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <strong>Read-only:</strong> Stripe Price IDs (<code>stripe_price_id_test/live</code>) and <code>code</code> cannot be edited here. Price changes require a new Stripe Price — see MEMORY.md PRICING section.
      </div>

      {plans.map((plan) => (
        <div key={plan.code} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Collapsed row */}
          <button
            type="button"
            onClick={() => toggleExpand(plan)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-orange-50/40 transition text-left"
          >
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-900 text-sm">{plan.display_name}</span>
              <span className="text-xs text-slate-400 font-mono">{plan.code}</span>
              {plan.active ? (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-400 border border-slate-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Inactive
                </span>
              )}
              {plan.coming_soon && (
                <span className="rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-700">Coming soon</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-700">
                ${(plan.price_cents_monthly / 100).toFixed(0)}/mo
              </span>
              <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedCode === plan.code ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          {/* Expanded editor */}
          {expandedCode === plan.code && (
            <div className="border-t border-slate-100 p-4 space-y-4">
              {/* Basic fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Field label="Display Name">
                  <input type="text" value={String(editData.display_name ?? '')} onChange={(e) => setEditData({ ...editData, display_name: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Tagline">
                  <input type="text" value={String(editData.tagline ?? '')} onChange={(e) => setEditData({ ...editData, tagline: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Sort Order">
                  <input type="number" value={String(editData.sort_order ?? '')} onChange={(e) => setEditData({ ...editData, sort_order: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Price (cents/mo)">
                  <input type="number" value={String(editData.price_cents_monthly ?? '')} onChange={(e) => setEditData({ ...editData, price_cents_monthly: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Original Price (cents/mo)">
                  <input type="number" value={String(editData.price_cents_monthly_original ?? '')} onChange={(e) => setEditData({ ...editData, price_cents_monthly_original: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Included Seats">
                  <input type="number" value={String(editData.included_seats ?? '')} onChange={(e) => setEditData({ ...editData, included_seats: e.target.value })} className={inputCls} />
                </Field>
              </div>

              {/* Price change acknowledgement */}
              {Number(editData.price_cents_monthly) !== plan.price_cents_monthly && (
                <label className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <input type="checkbox" checked={priceAck} onChange={(e) => setPriceAck(e.target.checked)} className="rounded" />
                  I confirm I have created a new Stripe Price and updated the <code>stripe_price_id</code> separately. Changing <code>price_cents_monthly</code> without a new Stripe Price will cause a drift.
                </label>
              )}

              {/* Limits */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <Field label="Monthly Quote Limit">
                  <input type="number" value={String(editData.monthly_quote_limit ?? '')} onChange={(e) => setEditData({ ...editData, monthly_quote_limit: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Storage (bytes)">
                  <input type="number" value={String(editData.storage_limit_bytes ?? '')} onChange={(e) => setEditData({ ...editData, storage_limit_bytes: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Component Limit">
                  <input type="number" value={String(editData.component_limit ?? '')} onChange={(e) => setEditData({ ...editData, component_limit: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Flashing Limit">
                  <input type="number" value={String(editData.flashing_limit ?? '')} onChange={(e) => setEditData({ ...editData, flashing_limit: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Attachment Limit">
                  <input type="number" value={String(editData.attachment_limit ?? '')} onChange={(e) => setEditData({ ...editData, attachment_limit: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Catalog Limit">
                  <input type="number" value={String(editData.catalog_limit ?? '')} onChange={(e) => setEditData({ ...editData, catalog_limit: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Monthly AI Tokens">
                  <input type="number" value={String(editData.monthly_ai_tokens ?? '')} onChange={(e) => setEditData({ ...editData, monthly_ai_tokens: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Monthly Invoice Limit">
                  <input type="number" value={String(editData.monthly_invoice_limit ?? '')} onChange={(e) => setEditData({ ...editData, monthly_invoice_limit: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Monthly Order Limit">
                  <input type="number" value={String(editData.monthly_material_order_limit ?? '')} onChange={(e) => setEditData({ ...editData, monthly_material_order_limit: e.target.value })} className={inputCls} />
                </Field>
              </div>

              {/* Feature toggles */}
              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Features</p>
                <div className="flex flex-wrap gap-2">
                  {FEAT_FIELDS.map((f) => (
                    <label key={f.key} className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 cursor-pointer hover:bg-slate-100 transition">
                      <input
                        type="checkbox"
                        checked={Boolean(editData[f.key])}
                        onChange={(e) => setEditData({ ...editData, [f.key]: e.target.checked })}
                        className="rounded"
                      />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Status toggles */}
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={Boolean(editData.active)} onChange={(e) => setEditData({ ...editData, active: e.target.checked })} className="rounded" />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={Boolean(editData.coming_soon)} onChange={(e) => setEditData({ ...editData, coming_soon: e.target.checked })} className="rounded" />
                  Coming soon
                </label>
              </div>

              {/* Stripe IDs (read-only) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Stripe Price ID (test)">
                  <input type="text" value={plan.stripe_price_id_test ?? '—'} readOnly className={`${inputCls} bg-slate-50 text-slate-400 cursor-not-allowed`} />
                </Field>
                <Field label="Stripe Price ID (live)">
                  <input type="text" value={plan.stripe_price_id_live ?? '—'} readOnly className={`${inputCls} bg-slate-50 text-slate-400 cursor-not-allowed`} />
                </Field>
              </div>

              {/* Save */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setExpandedCode(null); setEditData({}); setPriceAck(false); }}
                  className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => save(plan.code)}
                  disabled={pending}
                  className="inline-flex items-center rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30 disabled:opacity-50"
                >
                  {pending ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const inputCls = 'w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
