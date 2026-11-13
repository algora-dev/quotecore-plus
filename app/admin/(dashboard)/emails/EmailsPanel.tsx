'use client';

import { useMemo, useState } from 'react';
import type { OutreachRecipient, OutreachTemplateInfo, SendResult } from './actions';
import { sendOutreachEmails } from './actions';

/**
 * Admin outreach emails (owner 2026-11-13): pick recipients from recent
 * signups (with onboarding signals), preview the DB-stored template, send in
 * one batch. Suppressed and already-sent recipients are selectable-but-
 * skipped server-side; the table shows why.
 */
export function EmailsPanel({
  template,
  previewHtml,
  initialRecipients,
  initialError,
}: {
  template: OutreachTemplateInfo | null;
  previewHtml: string;
  initialRecipients: OutreachRecipient[];
  initialError: string | null;
}) {
  const [recipients] = useState(initialRecipients);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [armed, setArmed] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      recipients.filter((r) =>
        !q || [r.companyName, r.ownerEmail, r.ownerName].some((f) => (f ?? '').toLowerCase().includes(q)),
      ),
    [recipients, q],
  );
  const eligible = recipients.filter((r) => !r.sentAt && !r.suppressed);
  const selectedEligible = recipients.filter((r) => selected.has(r.companyId) && !r.sentAt && !r.suppressed);

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

  const toggle = (companyId: string) => {
    setArmed(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(companyId)) next.delete(companyId);
      else next.add(companyId);
      return next;
    });
  };

  const selectAllEligible = () => {
    setArmed(false);
    setSelected(new Set(eligible.map((r) => r.companyId)));
  };

  const send = async () => {
    if (!template || !selectedEligible.length || sending) return;
    setSending(true);
    try {
      const res = await sendOutreachEmails(template.key, selectedEligible.map((r) => r.companyId));
      setResult(res);
      setArmed(false);
      if (res.ok) setSelected(new Set());
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Outreach emails</h1>
          <p className="mt-1 text-sm text-slate-500">
            DB-stored templates sent to hand-picked recent signups. Suppressed and already-sent addresses are skipped automatically.
          </p>
        </div>
      </div>

      {initialError && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load: {initialError}
        </div>
      )}

      {template ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-900">{template.name}</div>
              <div className="text-sm text-slate-500">Subject: {template.subject}</div>
            </div>
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:border-orange-300 hover:bg-orange-50/40 transition"
            >
              {showPreview ? 'Hide preview' : 'Preview email'}
            </button>
          </div>
          {showPreview && (
            <iframe
              title="Email preview"
              srcDoc={previewHtml}
              sandbox=""
              className="mt-3 w-full h-[540px] rounded-lg border border-slate-200 bg-white"
            />
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          No active template found — seed outreach_templates first.
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search by business, email or name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-[220px] max-w-md px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-orange-500 focus:outline-none bg-white"
        />
        <button
          type="button"
          onClick={selectAllEligible}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white hover:border-orange-300 hover:bg-orange-50/40 transition"
        >
          Select {eligible.length} eligible
        </button>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => { setSelected(new Set()); setArmed(false); }}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition"
          >
            Clear selection
          </button>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
            No signups match.
          </div>
        )}
        {filtered.map((r) => {
          const isSelected = selected.has(r.companyId);
          const disabled = !!r.sentAt || r.suppressed;
          return (
            <label
              key={r.companyId}
              className={[
                'flex items-start gap-3 rounded-xl border bg-white px-4 py-3 transition-all cursor-pointer',
                isSelected ? 'border-orange-300 bg-orange-50/40' : 'border-slate-200 hover:border-orange-200',
                disabled ? 'opacity-60 cursor-not-allowed' : '',
              ].join(' ')}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={disabled}
                onChange={() => toggle(r.companyId)}
                className="mt-1 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate-900 truncate">{r.companyName}</span>
                  <span className="text-xs text-slate-500 truncate">{r.ownerEmail}</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  <span className="rounded-full px-2 py-0.5 text-xs bg-slate-100 text-slate-600">Joined {fmtDate(r.signedUpAt)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${r.componentCount ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {r.componentCount} pricing
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${r.quoteCount ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {r.quoteCount} jobs
                  </span>
                  {r.demoSession && (
                    <span className="rounded-full px-2 py-0.5 text-xs bg-sky-50 text-sky-700">Demo</span>
                  )}
                  {r.suppressed && (
                    <span className="rounded-full px-2 py-0.5 text-xs bg-red-50 text-red-700 border border-red-200">Suppressed</span>
                  )}
                  {r.sentAt && (
                    <span className="rounded-full px-2 py-0.5 text-xs bg-slate-900 text-white">Sent {fmtDate(r.sentAt)}</span>
                  )}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-3 sticky bottom-4">
        {!armed ? (
          <button
            type="button"
            disabled={!selectedEligible.length || sending || !template}
            onClick={() => setArmed(true)}
            className="px-4 py-2.5 text-sm font-semibold rounded-xl text-white bg-orange-500 hover:bg-orange-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send to {selectedEligible.length} recipient{selectedEligible.length === 1 ? '' : 's'}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={sending}
              onClick={send}
              className="px-4 py-2.5 text-sm font-semibold rounded-xl text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-40"
            >
              {sending ? 'Sending…' : `Confirm — send to ${selectedEligible.length}`}
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={() => setArmed(false)}
              className="px-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition"
            >
              Cancel
            </button>
          </>
        )}
      </div>

      {result && (
        <div className={[
          'mt-4 rounded-xl border px-4 py-3 text-sm',
          !result.ok ? 'border-red-200 bg-red-50 text-red-700'
          : result.summary.failed > 0 ? 'border-amber-200 bg-amber-50 text-amber-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700',
        ].join(' ')}>
          {result.ok ? (
            <>
              <strong>Done:</strong> {result.summary.sent} sent · {result.summary.skipped} skipped · {result.summary.failed} failed.
              {result.outcomes.some((o) => o.status === 'failed') && (
                <ul className="mt-2 space-y-1 text-xs">
                  {result.outcomes.filter((o) => o.status === 'failed').map((o) => (
                    <li key={o.companyId}>{o.email}: {o.detail}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>Send failed: {result.error}</>
          )}
        </div>
      )}
    </div>
  );
}
