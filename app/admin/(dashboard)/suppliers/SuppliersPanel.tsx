'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  getSuppliers,
  setSupplierStatus,
  type SupplierProfile,
} from './actions';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  suspended: 'bg-orange-100 text-orange-700 border-orange-200',
  revoked: 'bg-red-100 text-red-700 border-red-200',
};

export function SuppliersPanel() {
  const [suppliers, setSuppliers] = useState<SupplierProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [, startTransition] = useTransition();

  useEffect(() => {
    loadSuppliers();
  }, []);

  async function loadSuppliers() {
    setLoading(true);
    setError(null);
    try {
      const data = await getSuppliers();
      setSuppliers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(id: string, status: 'pending' | 'approved' | 'suspended' | 'revoked') {
    startTransition(async () => {
      try {
        await setSupplierStatus(id, status);
        await loadSuppliers();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update status');
      }
    });
  }

  const filtered = suppliers.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.supplier_name.toLowerCase().includes(q) ||
      s.slug.toLowerCase().includes(q) ||
      (s.master_email ?? '').toLowerCase().includes(q) ||
      (s.company_name ?? '').toLowerCase().includes(q) ||
      s.status.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return <div className="text-sm text-slate-400 py-8 text-center">Loading suppliers...</div>;
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-3 underline">Dismiss</button>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, status..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
        />
      </div>

      <p className="text-xs text-slate-500">{filtered.length} supplier{filtered.length !== 1 ? 's' : ''}</p>

      {/* Supplier list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border-dashed border border-slate-200 px-6 py-12 text-center">
          <p className="text-sm text-slate-400">
            {search ? 'No suppliers match your search.' : 'No suppliers yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-slate-200 bg-white hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Name + status */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-slate-900">{s.supplier_name}</h3>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${STATUS_STYLES[s.status] || STATUS_STYLES.pending}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                      {s.status}
                    </span>
                    {s.takeoff_builder_enabled && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 border border-blue-200">
                        Builder ON
                      </span>
                    )}
                    {s.enquiries_enabled && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-600 border border-green-200">
                        Enquiries ON
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    {s.master_email && (
                      <span className="text-xs text-slate-500">Master: <span className="text-orange-600 font-medium">{s.master_email}</span></span>
                    )}
                    {s.company_name && (
                      <span className="text-xs text-slate-500">Company: {s.company_name}</span>
                    )}
                    {s.currency && (
                      <span className="text-xs text-slate-500">Currency: {s.currency}</span>
                    )}
                    {s.branch_city && (
                      <span className="text-xs text-slate-500">Location: {s.branch_city}{s.branch_region ? `, ${s.branch_region}` : ''}, {s.branch_country || ''}</span>
                    )}
                  </div>

                  {/* Builder URL */}
                  {s.takeoff_builder_enabled && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-slate-400">Builder URL:</span>
                      <code className="text-xs text-[#BD4A1A] bg-orange-50/50 px-2 py-0.5 rounded">
                        quote-core.com/free-roofing-takeoff-builder/{s.slug}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(`https://quote-core.com/free-roofing-takeoff-builder/${s.slug}`)}
                        className="text-xs text-slate-400 hover:text-slate-600 transition"
                        title="Copy URL"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10a2 2 0 00-2 2v3a2 2 0 002 2h10a2 2 0 002-2v-3a2 2 0 00-2-2z" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {s.roofing_types?.map((t) => (
                      <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{t}</span>
                    ))}
                    {s.service_areas?.map((a) => (
                      <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{a}</span>
                    ))}
                  </div>
                </div>

                {/* Status actions */}
                <div className="flex flex-col gap-1 items-end shrink-0">
                  {s.status === 'approved' ? (
                    <button
                      onClick={() => handleStatusChange(s.id, 'suspended')}
                      className="text-xs px-2.5 py-1 rounded-full border border-orange-300 text-orange-600 hover:bg-orange-50 transition"
                    >
                      Suspend
                    </button>
                  ) : s.status === 'suspended' || s.status === 'pending' ? (
                    <button
                      onClick={() => handleStatusChange(s.id, 'approved')}
                      className="text-xs px-2.5 py-1 rounded-full border border-emerald-300 text-emerald-600 hover:bg-emerald-50 transition"
                    >
                      Approve
                    </button>
                  ) : null}
                  {s.status !== 'revoked' && (
                    <button
                      onClick={() => handleStatusChange(s.id, 'revoked')}
                      className="text-xs px-2.5 py-1 rounded-full border border-red-300 text-red-600 hover:bg-red-50 transition"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info note */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <p>Supplier details are managed by suppliers through their dashboard. To edit a supplier&apos;s profile, use user impersonation from the <a href="/admin/users" className="text-[#2563EB] hover:underline">Users</a> tab.</p>
      </div>
    </div>
  );
}
