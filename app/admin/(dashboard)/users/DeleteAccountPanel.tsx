'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import {
  listAccounts,
  lookupAccount,
  deleteAccount,
  deleteAccounts,
  type AccountRow,
  type AccountMatch,
} from './actions';

const PLAN_BADGE: Record<string, string> = {
  pro_plus:  'bg-purple-100 text-purple-700',
  pro:       'bg-blue-100 text-blue-700',
  growth:    'bg-sky-100 text-sky-700',
  starter:   'bg-emerald-100 text-emerald-700',
  trial:     'bg-amber-100 text-amber-700',
  free:      'bg-slate-100 text-slate-500',
};

function PlanBadge({ code }: { code: string | null }) {
  if (!code || code === 'premium') return null;
  const cls = PLAN_BADGE[code] ?? 'bg-slate-100 text-slate-600';
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
      {code.replace(/_/g, ' ')}
    </span>
  );
}

export function DeleteAccountPanel() {
  const [search, setSearch] = useState('');
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();

  // Per-row check state
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Single-delete confirm state
  const [singleTarget, setSingleTarget] = useState<AccountMatch | null>(null);
  const [singleTyped, setSingleTyped] = useState('');

  // Bulk-delete confirm state
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkTyped, setBulkTyped] = useState('');

  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  // Load all accounts on mount
  useEffect(() => {
    startLoad(async () => {
      const res = await listAccounts();
      if (res.ok) setAccounts(res.accounts);
      else setLoadError(res.error);
    });
  }, []);

  // Client-side search filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) =>
      a.companyName.toLowerCase().includes(q) ||
      a.users.some((u) =>
        u.email.toLowerCase().includes(q) ||
        (u.fullName ?? '').toLowerCase().includes(q),
      ),
    );
  }, [accounts, search]);

  const allFilteredIds = filtered.map((a) => a.companyId);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selected.has(id));
  const someSelected = allFilteredIds.some((id) => selected.has(id));
  const selectedCount = allFilteredIds.filter((id) => selected.has(id)).length;

  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => new Set([...prev, ...allFilteredIds]));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // --- Single delete (from row "Delete" button) ---
  function onSingleDelete(row: AccountRow) {
    setActionError(null);
    // Use the lookupAccount action to get full counts for the confirm view
    startLoad(async () => {
      const res = await lookupAccount(row.users[0]?.email ?? '');
      if (res.ok && res.matches.length > 0) {
        setSingleTarget(res.matches[0]);
        setSingleTyped('');
      } else {
        setActionError(res.ok ? 'Account not found.' : res.error);
      }
    });
  }

  function onConfirmSingle() {
    if (!singleTarget) return;
    startDelete(async () => {
      const res = await deleteAccount(singleTarget.companyId, singleTyped);
      if (res.ok) {
        setNotice(res.summary);
        setSingleTarget(null);
        setSingleTyped('');
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(singleTarget.companyId);
          return next;
        });
        // Reload list
        const fresh = await listAccounts();
        if (fresh.ok) setAccounts(fresh.accounts);
      } else {
        setActionError(res.error);
      }
    });
  }

  // --- Bulk delete ---
  function onConfirmBulk() {
    const ids = allFilteredIds.filter((id) => selected.has(id));
    startDelete(async () => {
      const res = await deleteAccounts(ids, bulkTyped);
      if (res.ok) {
        setNotice(res.summary);
        setShowBulkConfirm(false);
        setBulkTyped('');
        setSelected(new Set());
        const fresh = await listAccounts();
        if (fresh.ok) setAccounts(fresh.accounts);
      } else {
        setActionError(res.error);
      }
    });
  }

  const selectedRows = filtered.filter((a) => selected.has(a.companyId));

  return (
    <div className="space-y-4">
      {/* Search + bulk action bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email, name, or company…"
          className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        {selectedCount > 0 && (
          <button
            onClick={() => { setShowBulkConfirm(true); setBulkTyped(''); setActionError(null); }}
            className="rounded-full bg-red-600 text-white px-5 py-2 text-sm font-medium hover:bg-red-700 transition whitespace-nowrap"
          >
            Delete {selectedCount} selected
          </button>
        )}
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          ✅ {notice}
        </div>
      )}
      {(actionError || loadError) && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {actionError ?? loadError}
        </div>
      )}

      {/* Bulk confirm */}
      {showBulkConfirm && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-3">
          <p className="text-sm font-semibold text-red-800">
            Permanently delete {selectedCount} account{selectedCount !== 1 ? 's' : ''}?
          </p>
          <ul className="text-xs text-red-700 space-y-0.5 max-h-32 overflow-y-auto">
            {selectedRows.map((r) => (
              <li key={r.companyId}>
                <strong>{r.companyName}</strong> — {r.users.map((u) => u.email).join(', ')}
              </li>
            ))}
          </ul>
          <p className="text-xs text-red-700">This cannot be undone. Type <code className="bg-white/70 px-1 rounded font-mono">DELETE</code> to confirm:</p>
          <input
            type="text"
            value={bulkTyped}
            onChange={(e) => setBulkTyped(e.target.value)}
            placeholder="DELETE"
            className="w-full rounded-full border border-red-300 px-4 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          <div className="flex gap-2">
            <button
              onClick={onConfirmBulk}
              disabled={deleting || bulkTyped !== 'DELETE'}
              className="rounded-full bg-red-600 text-white px-5 py-2 text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : `Permanently delete ${selectedCount} account${selectedCount !== 1 ? 's' : ''}`}
            </button>
            <button
              onClick={() => { setShowBulkConfirm(false); setBulkTyped(''); }}
              className="rounded-full border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Single-delete confirm */}
      {singleTarget && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-3">
          <p className="text-sm font-semibold text-red-800">
            Permanently delete <strong>{singleTarget.companyName}</strong>?
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
            {[
              ['Quotes', singleTarget.counts.quotes],
              ['Invoices', singleTarget.counts.invoices],
              ['Orders', singleTarget.counts.materialOrders],
              ['Components', singleTarget.counts.components],
              ['Messages', singleTarget.counts.outboundMessages],
            ].map(([label, n]) => (
              <div key={label as string} className="rounded-lg bg-white/70 border border-red-100 py-2">
                <p className="text-lg font-semibold text-red-900">{n as number}</p>
                <p className="text-[11px] text-red-600">{label as string}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-red-700">
            Type <code className="bg-white/70 px-1 rounded">{singleTarget.users[0]?.email}</code> to confirm:
          </p>
          <input
            type="email"
            value={singleTyped}
            onChange={(e) => setSingleTyped(e.target.value)}
            placeholder="Type the email exactly"
            className="w-full rounded-full border border-red-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          <div className="flex gap-2">
            <button
              onClick={onConfirmSingle}
              disabled={
                deleting ||
                !singleTarget.users.some(
                  (u) => u.email.toLowerCase() === singleTyped.trim().toLowerCase(),
                )
              }
              className="rounded-full bg-red-600 text-white px-5 py-2 text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Permanently delete'}
            </button>
            <button
              onClick={() => { setSingleTarget(null); setSingleTyped(''); }}
              className="rounded-full border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Account list */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading && accounts.length === 0 ? (
          <p className="text-sm text-slate-500 p-6 text-center">Loading accounts…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-500 p-6 text-center">
            {search ? `No accounts matching "${search}"` : 'No accounts found.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Company</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Plan</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => {
                const primaryUser = row.users[0];
                const extraUsers = row.users.slice(1);
                const isChecked = selected.has(row.companyId);
                return (
                  <tr
                    key={row.companyId}
                    className={`hover:bg-orange-50/40 transition ${isChecked ? 'bg-red-50/30' : ''}`}
                    onClick={() => toggleOne(row.companyId)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOne(row.companyId)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{primaryUser?.email ?? '—'}</p>
                      {extraUsers.length > 0 && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          +{extraUsers.length} more: {extraUsers.map((u) => u.email).join(', ')}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {primaryUser?.fullName ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.companyName}</td>
                    <td className="px-4 py-3">
                      <PlanBadge code={row.planCode} />
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onSingleDelete(row)}
                        disabled={loading || deleting}
                        className="rounded-full border border-red-200 text-red-600 px-3 py-1 text-xs hover:bg-red-50 transition disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {filtered.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
            {filtered.length} account{filtered.length !== 1 ? 's' : ''}
            {search ? ` matching "${search}"` : ''}
            {selectedCount > 0 ? ` · ${selectedCount} selected` : ''}
          </div>
        )}
      </div>
    </div>
  );
}
