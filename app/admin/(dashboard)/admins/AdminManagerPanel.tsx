'use client';

import { useState, useTransition, useEffect } from 'react';
import {
  listAdmins,
  createAdmin,
  changeAdminPassword,
  revokeAdmin,
  type AdminUser,
} from './actions';

export function AdminManagerPanel() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();

  // Create form
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, startCreate] = useTransition();

  // Password change
  const [pwTarget, setPwTarget] = useState<AdminUser | null>(null);
  const [pwValue, setPwValue] = useState('');
  const [changingPw, startChangePw] = useTransition();

  // Revoke
  const [revokeTarget, setRevokeTarget] = useState<AdminUser | null>(null);
  const [revokeDelete, setRevokeDelete] = useState(false);
  const [revoking, startRevoke] = useTransition();

  // Notices
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function reload() {
    startLoad(async () => {
      const res = await listAdmins();
      if (res.ok) setAdmins(res.admins);
      else setLoadError(res.error);
    });
  }

  useEffect(() => { reload(); }, []);

  function clearNotices() {
    setNotice(null);
    setActionError(null);
  }

  // --- Create admin ---
  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    clearNotices();
    startCreate(async () => {
      const res = await createAdmin(newEmail, newPassword, newName);
      if (res.ok) {
        setNotice(res.summary);
        setNewEmail('');
        setNewPassword('');
        setNewName('');
        reload();
      } else {
        setActionError(res.error);
      }
    });
  }

  // --- Change password ---
  function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!pwTarget) return;
    clearNotices();
    startChangePw(async () => {
      const res = await changeAdminPassword(pwTarget.id, pwValue);
      if (res.ok) {
        setNotice(res.summary);
        setPwTarget(null);
        setPwValue('');
      } else {
        setActionError(res.error);
      }
    });
  }

  // --- Revoke admin ---
  function onRevoke(e: React.FormEvent) {
    e.preventDefault();
    if (!revokeTarget) return;
    clearNotices();
    startRevoke(async () => {
      const res = await revokeAdmin(revokeTarget.id, revokeDelete);
      if (res.ok) {
        setNotice(res.summary);
        setRevokeTarget(null);
        setRevokeDelete(false);
        reload();
      } else {
        setActionError(res.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Notices */}
      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {notice}
        </div>
      )}
      {(actionError || loadError) && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {actionError ?? loadError}
        </div>
      )}

      {/* Create new admin */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-lg font-semibold text-slate-900">Add admin</h2>
        <p className="text-sm text-slate-500 mt-1">
          Create a new admin login or promote an existing user. If the email is already
          registered, they&apos;ll be promoted to admin and their password will be updated.
        </p>
        <form onSubmit={onCreate} className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="text"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 8 characters"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name (optional)</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Full name"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none text-sm"
            />
          </div>
        </form>
        <div className="mt-4">
          <button
            type="button"
            onClick={onCreate}
            disabled={creating}
            className="inline-flex items-center rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30 disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Add admin'}
          </button>
        </div>
      </section>

      {/* Admin list */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Admin accounts</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Users with admin panel access. You can change passwords or revoke access.
          </p>
        </div>

        {loading && admins.length === 0 ? (
          <p className="text-sm text-slate-500 p-6 text-center">Loading…</p>
        ) : admins.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center m-5">
            <p className="text-sm text-slate-500">No admin accounts found.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Email</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Name</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Workspace</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Created</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {admins.map((a) => (
                <tr key={a.id} className="hover:bg-orange-50/40 hover:border-orange-200 transition">
                  <td className="px-5 py-3 font-medium text-slate-900">{a.email}</td>
                  <td className="px-5 py-3 text-slate-600">{a.fullName ?? <span className="text-slate-400">—</span>}</td>
                  <td className="px-5 py-3 text-slate-600">{a.companyName ?? <span className="text-slate-400">—</span>}</td>
                  <td className="px-5 py-3 text-xs text-slate-400">
                    {new Date(a.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => { setPwTarget(a); setPwValue(''); clearNotices(); }}
                      className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50 transition mr-2"
                    >
                      Change password
                    </button>
                    <button
                      onClick={() => { setRevokeTarget(a); setRevokeDelete(false); clearNotices(); }}
                      className="rounded-full border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50 transition"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Change password modal */}
      {pwTarget && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Change password</h3>
            <p className="text-sm text-slate-500 mt-2">
              Set a new password for <strong>{pwTarget.email}</strong>. They&apos;ll need to use
              this password next time they log in.
            </p>
            <form onSubmit={onChangePassword} className="mt-4 space-y-3">
              <input
                type="text"
                required
                minLength={8}
                value={pwValue}
                onChange={(e) => setPwValue(e.target.value)}
                placeholder="New password (min 8 characters)"
                autoFocus
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none text-sm"
              />
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => { setPwTarget(null); setPwValue(''); }}
                  className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changingPw || pwValue.length < 8}
                  className="px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {changingPw ? 'Updating…' : 'Update password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revoke admin modal */}
      {revokeTarget && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Revoke admin access</h3>
            <p className="text-sm text-slate-500 mt-2">
              Remove admin panel access for <strong>{revokeTarget.email}</strong>.
            </p>
            <form onSubmit={onRevoke} className="mt-4 space-y-4">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={revokeDelete}
                  onChange={(e) => setRevokeDelete(e.target.checked)}
                  className="rounded"
                />
                Also delete the login entirely (cannot be undone)
              </label>
              <p className="text-xs text-slate-400">
                {revokeDelete
                  ? 'This will permanently delete the auth user and their admin workspace. They will not be able to log in at all.'
                  : 'The user will lose admin access but keep their login. They can still use the regular app if they have a company.'}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => { setRevokeTarget(null); setRevokeDelete(false); }}
                  className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={revoking}
                  className="px-4 py-2 text-sm font-medium rounded-full bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50"
                >
                  {revoking ? 'Processing…' : revokeDelete ? 'Delete permanently' : 'Revoke admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
