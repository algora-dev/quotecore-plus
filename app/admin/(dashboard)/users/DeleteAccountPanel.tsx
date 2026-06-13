'use client';

import { useState, useTransition } from 'react';
import {
  lookupAccount,
  deleteAccount,
  type AccountMatch,
} from './actions';

/**
 * Search -> review -> typed-confirmation -> delete.
 *
 * Three-step guard against accidental wipes:
 *   1. Look up the email (read-only) and show the matched company + counts.
 *   2. Admin clicks "Delete this account" -> reveals a confirm box.
 *   3. Admin must type the exact account email, then confirm. Server re-checks
 *      the typed email against the company's users before deleting.
 */
export function DeleteAccountPanel() {
  const [email, setEmail] = useState('');
  const [matches, setMatches] = useState<AccountMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Per-company confirm state: which company is in "confirming" mode + typed value.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [typedEmail, setTypedEmail] = useState('');

  const [searching, startSearch] = useTransition();
  const [deleting, startDelete] = useTransition();

  function onSearch() {
    setError(null);
    setNotice(null);
    setMatches(null);
    setConfirmingId(null);
    setTypedEmail('');
    startSearch(async () => {
      const res = await lookupAccount(email);
      if (res.ok) setMatches(res.matches);
      else setError(res.error);
    });
  }

  function onConfirmDelete(companyId: string) {
    setError(null);
    startDelete(async () => {
      const res = await deleteAccount(companyId, typedEmail);
      if (res.ok) {
        setNotice(res.summary);
        setMatches(null);
        setConfirmingId(null);
        setTypedEmail('');
        setEmail('');
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <label className="block text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">
          Find account by email
        </label>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            placeholder="user@example.com"
            className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          <button
            onClick={onSearch}
            disabled={searching || !email.trim()}
            className="rounded-full bg-black text-white px-5 py-2 text-sm font-medium hover:shadow-[0_0_12px_rgba(0,0,0,0.25)] transition disabled:opacity-50"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {matches && matches.length > 0 && (
        <div className="space-y-4">
          {matches.map((m) => {
            const isConfirming = confirmingId === m.companyId;
            const typedMatches = m.users.some(
              (u) => u.email.toLowerCase() === typedEmail.trim().toLowerCase(),
            );
            return (
              <div
                key={m.companyId}
                className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{m.companyName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {m.companySlug ? `/${m.companySlug}` : '(no slug)'} · plan:{' '}
                      {m.planCode ?? '—'} · status: {m.subscriptionStatus ?? '—'}
                      {m.stripeCustomerId ? ` · stripe: ${m.stripeCustomerId}` : ''}
                    </p>
                  </div>
                  <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
                    {m.companyId.slice(0, 8)}…
                  </span>
                </div>

                {/* Users */}
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1">
                    Login(s) — {m.users.length}
                  </p>
                  <ul className="text-sm text-slate-700 space-y-0.5">
                    {m.users.map((u) => (
                      <li key={u.id} className="flex items-center gap-2">
                        <span>{u.email}</span>
                        {u.isAdmin && (
                          <span className="text-[10px] uppercase px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">
                            admin
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* What gets deleted */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                  {[
                    ['Quotes', m.counts.quotes],
                    ['Invoices', m.counts.invoices],
                    ['Orders', m.counts.materialOrders],
                    ['Components', m.counts.components],
                    ['Messages', m.counts.outboundMessages],
                  ].map(([label, n]) => (
                    <div key={label as string} className="rounded-lg bg-slate-50 border border-slate-200 py-2">
                      <p className="text-lg font-semibold text-slate-900">{n as number}</p>
                      <p className="text-[11px] text-slate-500">{label as string}</p>
                    </div>
                  ))}
                </div>

                {/* Delete flow */}
                {!isConfirming ? (
                  <button
                    onClick={() => {
                      setConfirmingId(m.companyId);
                      setTypedEmail('');
                      setError(null);
                    }}
                    className="rounded-full bg-red-600 text-white px-5 py-2 text-sm font-medium hover:bg-red-700 transition"
                  >
                    Delete this account
                  </button>
                ) : (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                    <p className="text-sm text-red-800 font-medium">
                      This permanently deletes <strong>{m.companyName}</strong> — all data,
                      files, and login(s). It cannot be undone.
                    </p>
                    <p className="text-xs text-red-700">
                      Type the account email{' '}
                      <code className="bg-white/70 px-1 rounded">{m.users[0]?.email}</code> to confirm:
                    </p>
                    <input
                      type="email"
                      value={typedEmail}
                      onChange={(e) => setTypedEmail(e.target.value)}
                      placeholder="Type the email exactly"
                      className="w-full rounded-full border border-red-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => onConfirmDelete(m.companyId)}
                        disabled={deleting || !typedMatches}
                        className="rounded-full bg-red-600 text-white px-5 py-2 text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
                      >
                        {deleting ? 'Deleting…' : 'Permanently delete'}
                      </button>
                      <button
                        onClick={() => {
                          setConfirmingId(null);
                          setTypedEmail('');
                        }}
                        disabled={deleting}
                        className="rounded-full border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
