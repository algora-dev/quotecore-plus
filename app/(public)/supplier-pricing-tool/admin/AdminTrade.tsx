'use client';

// Admin > Trade pricing: discount tiers (blanket %-off) + the customer
// email database. Adding an email "invites" them - first login sets their
// password; the owner can only trigger a password-reset email (demo-grade:
// simulated). Their tier discount replaces the blanket discount in the tool.

import { useState } from 'react';
import type { AdminData, TradeTier, TradeCustomer } from '../adminData';
import type { SupplierConfig } from '../supplierConfig';
import { SectionCard } from './AdminPanel';

export function AdminTrade({ admin, setAdmin, cfg }: { admin: AdminData; setAdmin: (fn: (a: AdminData) => AdminData) => void; cfg: SupplierConfig }) {
  const [email, setEmail] = useState('');
  const [tierId, setTierId] = useState<string>(admin.tiers[0]?.id ?? '');
  const [notice, setNotice] = useState('');

  const inputCls = 'mt-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

  function patchTier(id: string, p: Partial<TradeTier>) {
    setAdmin(a => ({ ...a, tiers: a.tiers.map(t => (t.id === id ? { ...t, ...p } : t)) }));
  }

  function addTier() {
    setAdmin(a => ({ ...a, tiers: [...a.tiers, { id: `t${Date.now()}`, name: `Trade Tier ${a.tiers.length + 1}`, discountPct: 5 }] }));
  }

  function removeTier(id: string) {
    setAdmin(a => ({
      ...a,
      tiers: a.tiers.filter(t => t.id !== id),
      customers: a.customers.map(c => (c.tierId === id ? { ...c, tierId: null } : c)),
    }));
  }

  function addCustomer() {
    const e = email.trim();
    if (!e || !e.includes('@')) { setNotice('Enter a valid email address.'); return; }
    if (admin.customers.some(c => c.email.toLowerCase() === e.toLowerCase())) { setNotice('That email is already on the list.'); return; }
    const customer: TradeCustomer = { email: e, tierId: tierId || null, status: 'invited', addedAt: new Date().toISOString(), lastLoginAt: null };
    setAdmin(a => ({ ...a, customers: [customer, ...a.customers] }));
    setEmail('');
    setNotice(`Invite email sent to ${e} - they set their own password on first login.`);
  }

  function setCustomerTier(emailAddr: string, tId: string | null) {
    setAdmin(a => ({ ...a, customers: a.customers.map(c => (c.email === emailAddr ? { ...c, tierId: tId } : c)) }));
  }

  function removeCustomer(emailAddr: string) {
    setAdmin(a => ({ ...a, customers: a.customers.filter(c => c.email !== emailAddr) }));
  }

  function resetPassword(emailAddr: string) {
    setNotice(`Password reset email sent to ${emailAddr} - only the user can set a new password.`);
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Trade tiers" desc={`Blanket %-off price lists. Customers on a tier get that discount instead of the default ${cfg.discountPct}% blanket discount. Custom per-business pricing available on request.`}>
        <div className="grid gap-2 md:grid-cols-2">
          {admin.tiers.map(t => (
            <div key={t.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
              <input type="text" value={t.name} onChange={e => patchTier(t.id, { name: e.target.value })} className={`${inputCls} flex-1`} aria-label={`Tier name ${t.id}`} />
              <input type="number" min="0" max="80" step="0.5" value={t.discountPct} onChange={e => patchTier(t.id, { discountPct: parseFloat(e.target.value) || 0 })} className={`${inputCls} w-20 text-right`} aria-label={`Tier discount ${t.id}`} />
              <span className="text-sm text-slate-500">% off</span>
              <button onClick={() => removeTier(t.id)} className="text-slate-300 hover:text-red-500 transition" aria-label={`Remove tier ${t.name}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
        <button onClick={addTier} className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 transition">+ Add tier</button>
      </SectionCard>

      <SectionCard title={`Trade customers (${admin.customers.length})`} desc="Emails with trade-pricing access. First login: the customer sets their own password. Reset only sends them an email - owners never set customer passwords.">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600">Customer email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addCustomer(); }} className={`${inputCls} w-64`} placeholder="buyer@business.co.uk" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Tier</label>
            <select value={tierId} onChange={e => setTierId(e.target.value)} className={`${inputCls} w-48`}>
              {admin.tiers.map(t => <option key={t.id} value={t.id}>{t.name} (-{t.discountPct}%)</option>)}
            </select>
          </div>
          <div className="pb-0.5">
            <button onClick={addCustomer} className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition">Add & send invite</button>
          </div>
        </div>
        {notice && <p className="text-xs text-green-700 rounded-lg bg-green-50 border border-green-200 px-3 py-2">{notice}</p>}
        {admin.customers.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-1.5 pr-2 font-medium">Email</th>
                  <th className="py-1.5 pr-2 font-medium">Tier</th>
                  <th className="py-1.5 pr-2 font-medium">Status</th>
                  <th className="py-1.5 pr-2 font-medium">Added</th>
                  <th className="py-1.5" />
                </tr>
              </thead>
              <tbody>
                {admin.customers.map(c => (
                  <tr key={c.email} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2 text-slate-900">{c.email}</td>
                    <td className="py-1.5 pr-2">
                      <select value={c.tierId ?? ''} onChange={e => setCustomerTier(c.email, e.target.value || null)} className={`${inputCls} py-1`} aria-label={`Tier for ${c.email}`}>
                        <option value="">No tier</option>
                        {admin.tiers.map(t => <option key={t.id} value={t.id}>{t.name} (-{t.discountPct}%)</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 pr-2">
                      <span className="rounded-full px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-600">{c.status}</span>
                    </td>
                    <td className="py-1.5 pr-2 text-xs text-slate-400">{new Date(c.addedAt).toLocaleDateString('en-GB')}</td>
                    <td className="py-1.5 text-right whitespace-nowrap">
                      <button onClick={() => resetPassword(c.email)} className="text-xs font-medium text-slate-500 hover:text-slate-800 transition">Reset password</button>
                      <button onClick={() => removeCustomer(c.email)} className="ml-3 text-slate-300 hover:text-red-500 transition" aria-label={`Remove ${c.email}`}>
                        <svg className="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
