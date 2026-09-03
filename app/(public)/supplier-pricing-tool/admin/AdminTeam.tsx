'use client';

// Admin > Team: add / remove team members, change roles, resend invites
// and trigger password-reset emails (demo-grade: simulated - only the user
// can ever set a password).

import { useState } from 'react';
import type { AdminData, TeamMember } from '../adminData';
import { SectionCard } from './AdminPanel';

const ROLES: TeamMember['role'][] = ['Owner', 'Admin', 'Editor'];

export function AdminTeam({ admin, setAdmin }: { admin: AdminData; setAdmin: (fn: (a: AdminData) => AdminData) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamMember['role']>('Editor');
  const [notice, setNotice] = useState('');

  const inputCls = 'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

  function patchMember(id: string, p: Partial<TeamMember>) {
    setAdmin(a => ({ ...a, team: a.team.map(m => (m.id === id ? { ...m, ...p } : m)) }));
  }

  function removeMember(id: string) {
    setAdmin(a => ({ ...a, team: a.team.filter(m => m.id !== id) }));
  }

  function addMember() {
    const e = email.trim();
    if (!name.trim() || !e.includes('@')) { setNotice('Enter a name and a valid email.'); return; }
    if (admin.team.some(m => m.email.toLowerCase() === e.toLowerCase())) { setNotice('That email is already on the team.'); return; }
    setAdmin(a => ({ ...a, team: [...a.team, { id: `tm-${Date.now()}`, name: name.trim(), email: e, role, status: 'invited' }] }));
    setName(''); setEmail('');
    setNotice(`Invite sent to ${e} - they set their own password from the email.`);
  }

  return (
    <SectionCard title={`Team (${admin.team.length})`} desc="People who can access this admin. Passwords are never set here - invites and resets go by email and the user picks their own.">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-xs font-medium text-slate-600">Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className={`${inputCls} w-40`} placeholder="Sam Taylor" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addMember(); }} className={`${inputCls} w-56`} placeholder="sam@supplier.co.uk" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Role</label>
          <select value={role} onChange={e => setRole(e.target.value as TeamMember['role'])} className={inputCls}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button onClick={addMember} className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition">Add member</button>
      </div>
      {notice && <p className="text-xs text-green-700 rounded-lg bg-green-50 border border-green-200 px-3 py-2">{notice}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-1.5 pr-2 font-medium">Name</th>
              <th className="py-1.5 pr-2 font-medium">Email</th>
              <th className="py-1.5 pr-2 font-medium">Role</th>
              <th className="py-1.5 pr-2 font-medium">Status</th>
              <th className="py-1.5" />
            </tr>
          </thead>
          <tbody>
            {admin.team.map(m => (
              <tr key={m.id} className="border-b border-slate-100">
                <td className="py-1.5 pr-2 text-slate-900">{m.name}</td>
                <td className="py-1.5 pr-2 text-slate-600">{m.email}</td>
                <td className="py-1.5 pr-2">
                  <select value={m.role} onChange={e => patchMember(m.id, { role: e.target.value as TeamMember['role'] })} className={`${inputCls} py-1`} disabled={m.role === 'Owner'} aria-label={`Role for ${m.name}`}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </td>
                <td className="py-1.5 pr-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${m.status === 'active' ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'bg-slate-100 text-slate-600'}`}>{m.status}</span>
                </td>
                <td className="py-1.5 text-right whitespace-nowrap">
                  <button onClick={() => setNotice(`Password reset email sent to ${m.email}.`)} className="text-xs font-medium text-slate-500 hover:text-slate-800 transition">Reset password</button>
                  {m.role !== 'Owner' && (
                    <button onClick={() => removeMember(m.id)} className="ml-3 text-slate-300 hover:text-red-500 transition" aria-label={`Remove ${m.name}`}>
                      <svg className="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
