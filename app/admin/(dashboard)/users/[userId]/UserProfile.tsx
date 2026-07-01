'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { UserProfileData } from './actions';
import {
  updateCompanyName,
  adminOverridePlan,
  changePaidPlan,
  removeOverride,
  listAvailableCoupons,
  getCurrentCoupon,
  applyCoupon,
  removeCoupon,
  pauseAccess,
  resumeAccess,
  sendPasswordReset,
  deleteAccount,
  startImpersonation,
  listAttachments,
  type CouponInfo,
  type AttachmentRow,
} from './actions';
import { StorageTab } from './StorageTab';

const PLAN_OPTIONS = [
  { code: 'free', label: 'Free' },
  { code: 'starter', label: 'Starter' },
  { code: 'pro', label: 'Pro' },
  { code: 'pro_plus', label: 'Pro Plus' },
];

const STATUS_BADGE: Record<string, string> = {
  active:    'bg-emerald-100 text-emerald-700 border-emerald-200',
  trialing:  'bg-amber-100 text-amber-700 border-amber-200',
  past_due:  'bg-orange-100 text-orange-700 border-orange-200',
  grace:     'bg-orange-100 text-orange-700 border-orange-200',
  disputed:  'bg-red-100 text-red-700 border-red-200',
  canceled:  'bg-slate-100 text-slate-400 border-slate-100',
  suspended: 'bg-slate-100 text-slate-400 border-slate-100',
  pending_data_purge: 'bg-red-100 text-red-700 border-red-200',
  cancellation_pending: 'bg-orange-100 text-orange-700 border-orange-200',
};

export function UserProfile({ data }: { data: UserProfileData }) {
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startAction] = useTransition();

  function runAction(
    fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>,
    onSuccess?: () => void,
  ) {
    setActionError(null);
    setNotice(null);
    startAction(async () => {
      const res = await fn();
      if (res.ok) {
        setNotice(res.message);
        onSuccess?.();
      } else {
        setActionError(res.error);
      }
    });
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  const overrideActive =
    data.company.adminOverridePlanCode &&
    data.company.adminOverrideUntil &&
    new Date(data.company.adminOverrideUntil) > new Date();

  return (
    <div className="space-y-5">
      {/* Impersonation bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Impersonate User</h2>
          <p className="text-xs text-slate-500 mt-0.5">Log in as this user to see their view. 30-min session, fully audited.</p>
        </div>
        <ImpersonateButton userId={data.user.id} userEmail={data.user.email} onAction={runAction} pending={pending} />
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          ✅ {notice}
        </div>
      )}
      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* A. Company Info */}
      <CompanyInfoSection data={data} onAction={runAction} pending={pending} formatBytes={formatBytes} overrideActive={!!overrideActive} />

      {/* B. Subscription Tier */}
      <SubscriptionSection data={data} onAction={runAction} pending={pending} overrideActive={!!overrideActive} />

      {/* C. Discount / Coupon */}
      <CouponSection data={data} onAction={runAction} pending={pending} />

      {/* D. Access Control */}
      <AccessControlSection data={data} onAction={runAction} pending={pending} />

      {/* E. Password Reset */}
      <PasswordResetSection data={data} onAction={runAction} pending={pending} />

      {/* F. Delete Account */}
      <DeleteAccountSection data={data} onAction={runAction} pending={pending} router={router} />

      {/* G. Add/Remove Users — Coming Soon */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900">User Management</h2>
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center mt-4">
          <p className="text-sm text-slate-500">Coming soon — add/remove additional users on a company account.</p>
        </div>
      </div>

      {/* H. Storage & Files */}
      <StorageSection data={data} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section A: Company Info
// ---------------------------------------------------------------------------

function CompanyInfoSection({
  data,
  onAction,
  pending,
  formatBytes,
  overrideActive,
}: {
  data: UserProfileData;
  onAction: (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>, onSuccess?: () => void) => void;
  pending: boolean;
  formatBytes: (b: number) => string;
  overrideActive: boolean;
}) {
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(data.company.name);
  const [reason, setReason] = useState('');

  const c = data.company;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Company Info</h2>
        <div className="flex items-center gap-2">
          {c.adminPaused && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-red-100 text-red-700 border border-red-200">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Paused
            </span>
          )}
          {overrideActive && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              Override: {c.adminOverridePlanCode}
            </span>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide">Company Name</dt>
          {editingName ? (
            <div className="mt-1 space-y-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
              />
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (required)"
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => onAction(async () => updateCompanyName(c.id, newName, reason), () => { setEditingName(false); setReason(''); })}
                  disabled={pending || !newName.trim() || !reason.trim()}
                  className="rounded-full bg-black px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={() => { setEditingName(false); setNewName(c.name); setReason(''); }}
                  className="px-4 py-1.5 text-xs font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <dd className="mt-1 text-slate-900 flex items-center gap-2">
              {c.name}
              <button
                onClick={() => { setEditingName(true); setNewName(c.name); }}
                className="text-xs text-slate-400 hover:text-slate-600 transition"
              >
                Edit
              </button>
            </dd>
          )}
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide">Slug</dt>
          <dd className="mt-1 text-slate-600">{c.slug ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide">Plan Code</dt>
          <dd className="mt-1 text-slate-900">{c.planCode ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide">Subscription Status</dt>
          <dd className="mt-1">
            {c.subscriptionStatus && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${STATUS_BADGE[c.subscriptionStatus] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                {c.subscriptionStatus}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide">Stripe Customer ID</dt>
          <dd className="mt-1 text-slate-600">
            {c.stripeCustomerId ? (
              <a
                href={`https://dashboard.stripe.com/${c.stripeCustomerId.startsWith('cus_') ? 'test/' : ''}customers/${c.stripeCustomerId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#FF6B35] hover:underline"
              >
                {c.stripeCustomerId} ↗
              </a>
            ) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide">Stripe Subscription ID</dt>
          <dd className="mt-1 text-slate-600">
            {c.stripeSubscriptionId ? (
              <a
                href={`https://dashboard.stripe.com/${c.stripeSubscriptionId.startsWith('sub_') ? 'test/' : ''}subscriptions/${c.stripeSubscriptionId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#FF6B35] hover:underline"
              >
                {c.stripeSubscriptionId} ↗
              </a>
            ) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide">Current Period End</dt>
          <dd className="mt-1 text-slate-600">{c.currentPeriodEnd ? new Date(c.currentPeriodEnd).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide">Storage Used</dt>
          <dd className="mt-1 text-slate-600">
            {formatBytes(c.storageUsedBytes)}
            {c.storageLimitBytes != null ? ` / ${formatBytes(c.storageLimitBytes)}` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide">Created</dt>
          <dd className="mt-1 text-slate-600">{c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</dd>
        </div>
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section B: Subscription Tier
// ---------------------------------------------------------------------------

function SubscriptionSection({
  data,
  onAction,
  pending,
  overrideActive,
}: {
  data: UserProfileData;
  onAction: (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>, onSuccess?: () => void) => void;
  pending: boolean;
  overrideActive: boolean;
}) {
  const [overridePlan, setOverridePlan] = useState('pro');
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverride, setShowOverride] = useState(false);
  const [paidPlan, setPaidPlan] = useState('starter');
  const [paidReason, setPaidReason] = useState('');
  const [showChangePaid, setShowChangePaid] = useState(false);
  const [removeReason, setRemoveReason] = useState('');
  const [showRemove, setShowRemove] = useState(false);

  const c = data.company;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Subscription Tier</h2>

      {overrideActive && (
        <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-sm text-purple-800">
          <strong>Active override:</strong> {c.adminOverridePlanCode} until {new Date(c.adminOverrideUntil!).toLocaleDateString('en-GB')}
          {c.adminOverrideNotes && <span className="block text-xs mt-1 text-purple-600">Reason: {c.adminOverrideNotes}</span>}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => { setShowOverride(!showOverride); setShowChangePaid(false); setShowRemove(false); }}
          className="inline-flex items-center rounded-full bg-[#FF6B35] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#ff5722] hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
        >
          Override (free comp)
        </button>
        <button
          onClick={() => { setShowChangePaid(!showChangePaid); setShowOverride(false); setShowRemove(false); }}
          disabled={!c.stripeSubscriptionId}
          className="inline-flex items-center rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30 disabled:opacity-50"
        >
          Change paid plan
        </button>
        <button
          onClick={() => { setShowRemove(!showRemove); setShowOverride(false); setShowChangePaid(false); }}
          disabled={!overrideActive}
          className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition"
        >
          Remove override
        </button>
      </div>

      {showOverride && (
        <div className="rounded-lg border border-slate-200 p-4 space-y-3">
          <p className="text-sm text-slate-600">Set a free comp override to any plan. No Stripe charge. Duration defaults to 365 days.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={overridePlan}
              onChange={(e) => setOverridePlan(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            >
              {PLAN_OPTIONS.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
            </select>
            <input
              type="text"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Reason (required)"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            />
          </div>
          <button
            onClick={() => onAction(async () => adminOverridePlan(c.id, overridePlan, overrideReason), () => { setShowOverride(false); setOverrideReason(''); })}
            disabled={pending || !overrideReason.trim()}
            className="rounded-full bg-[#FF6B35] px-5 py-2 text-sm font-semibold text-white hover:bg-[#ff5722] transition disabled:opacity-50"
          >
            Apply override
          </button>
        </div>
      )}

      {showChangePaid && (
        <div className="rounded-lg border border-slate-200 p-4 space-y-3">
          <p className="text-sm text-slate-600">Swap the Stripe subscription to a new plan. This charges/prorates via Stripe.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={paidPlan}
              onChange={(e) => setPaidPlan(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            >
              {PLAN_OPTIONS.filter((p) => p.code !== 'free').map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
            </select>
            <input
              type="text"
              value={paidReason}
              onChange={(e) => setPaidReason(e.target.value)}
              placeholder="Reason (required)"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            />
          </div>
          <button
            onClick={() => onAction(async () => changePaidPlan(c.id, paidPlan, paidReason), () => { setShowChangePaid(false); setPaidReason(''); })}
            disabled={pending || !paidReason.trim()}
            className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
          >
            Change plan
          </button>
        </div>
      )}

      {showRemove && (
        <div className="rounded-lg border border-slate-200 p-4 space-y-3">
          <p className="text-sm text-slate-600">Remove the admin override. The user reverts to their Stripe plan.</p>
          <input
            type="text"
            value={removeReason}
            onChange={(e) => setRemoveReason(e.target.value)}
            placeholder="Reason (required)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
          <button
            onClick={() => onAction(async () => removeOverride(c.id, removeReason), () => { setShowRemove(false); setRemoveReason(''); })}
            disabled={pending || !removeReason.trim()}
            className="rounded-full border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
          >
            Remove override
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section C: Discount / Coupon
// ---------------------------------------------------------------------------

function CouponSection({
  data,
  onAction,
  pending,
}: {
  data: UserProfileData;
  onAction: (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>, onSuccess?: () => void) => void;
  pending: boolean;
}) {
  const [coupons, setCoupons] = useState<CouponInfo[]>([]);
  const [currentCoupon, setCurrentCoupon] = useState<CouponInfo | null>(null);
  const [selectedCoupon, setSelectedCoupon] = useState('');
  const [reason, setReason] = useState('');
  const [loaded, setLoaded] = useState(false);

  const c = data.company;

  useEffect(() => {
    if (!c.stripeSubscriptionId) return;
    Promise.all([listAvailableCoupons(), getCurrentCoupon(c.id)]).then(([cl, cc]) => {
      if (cl.ok) setCoupons(cl.coupons);
      if (cc.ok) setCurrentCoupon(cc.coupon);
      setLoaded(true);
    });
  }, [c.id, c.stripeSubscriptionId]);

  if (!c.stripeSubscriptionId) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900">Discount / Coupon</h2>
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center mt-4">
          <p className="text-sm text-slate-500">No Stripe subscription — coupons not available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Discount / Coupon</h2>

      {currentCoupon && (
        <div className="rounded-lg bg-sky-50 border border-sky-200 p-3 text-sm text-sky-800">
          <strong>Current coupon:</strong> {currentCoupon.name ?? currentCoupon.id}
          {currentCoupon.percentOff != null && ` — ${currentCoupon.percentOff}% off`}
          {currentCoupon.amountOff != null && ` — $${(currentCoupon.amountOff / 100).toFixed(2)} off`}
          {` (${currentCoupon.duration})`}
        </div>
      )}

      {loaded && coupons.length === 0 && (
        <p className="text-sm text-slate-500">No admin-visible coupons available. Run the coupon creation script.</p>
      )}

      {coupons.length > 0 && (
        <div className="space-y-3">
          <select
            value={selectedCoupon}
            onChange={(e) => setSelectedCoupon(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          >
            <option value="">Select a coupon…</option>
            {coupons.map((co) => (
              <option key={co.id} value={co.id}>
                {co.name ?? co.id}
                {co.percentOff != null ? ` (${co.percentOff}% off)` : co.amountOff != null ? ` ($${(co.amountOff / 100).toFixed(2)} off)` : ''}
                {` — ${co.duration}`}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (required)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
          <div className="flex gap-3">
            <button
              onClick={() => onAction(async () => applyCoupon(c.id, selectedCoupon, reason), () => { setReason(''); setSelectedCoupon(''); })}
              disabled={pending || !selectedCoupon || !reason.trim()}
              className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
            >
              Apply coupon
            </button>
            {currentCoupon && (
              <button
                onClick={() => onAction(async () => removeCoupon(c.id, reason || 'Admin removal'), () => { setReason(''); })}
                disabled={pending}
                className="px-5 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition disabled:opacity-50"
              >
                Remove coupon
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section D: Access Control
// ---------------------------------------------------------------------------

function AccessControlSection({
  data,
  onAction,
  pending,
}: {
  data: UserProfileData;
  onAction: (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>, onSuccess?: () => void) => void;
  pending: boolean;
}) {
  const [pauseReason, setPauseReason] = useState('');
  const [resumeReason, setResumeReason] = useState('');
  const c = data.company;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Access Control</h2>

      {c.adminPaused ? (
        <div className="space-y-3">
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
            <strong>Account is paused.</strong> The user is locked out of the app.
            {c.adminPauseReason && <span className="block text-xs mt-1">Reason: {c.adminPauseReason}</span>}
            {c.adminPausedAt && <span className="block text-xs">Paused at: {new Date(c.adminPausedAt).toLocaleString('en-GB')}</span>}
          </div>
          <p className="text-sm text-slate-600">Resuming performs a mandatory Stripe sync before clearing the pause.</p>
          <input
            type="text"
            value={resumeReason}
            onChange={(e) => setResumeReason(e.target.value)}
            placeholder="Reason (required)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
          <button
            onClick={() => onAction(async () => resumeAccess(c.id, resumeReason), () => setResumeReason(''))}
            disabled={pending || !resumeReason.trim()}
            className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
          >
            Resume access
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Pausing locks the user out of the app but does not cancel their Stripe subscription.</p>
          <input
            type="text"
            value={pauseReason}
            onChange={(e) => setPauseReason(e.target.value)}
            placeholder="Reason (required)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
          <button
            onClick={() => onAction(async () => pauseAccess(c.id, pauseReason), () => setPauseReason(''))}
            disabled={pending || !pauseReason.trim()}
            className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-50"
          >
            Pause access
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section E: Password Reset
// ---------------------------------------------------------------------------

function PasswordResetSection({
  data,
  onAction,
  pending,
}: {
  data: UserProfileData;
  onAction: (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>, onSuccess?: () => void) => void;
  pending: boolean;
}) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Password Reset</h2>

      {showConfirm ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            This sends a password reset email to <strong>{data.user.email}</strong>. They will set their own new password.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => onAction(async () => sendPasswordReset(data.user.id), () => setShowConfirm(false))}
              disabled={pending}
              className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
            >
              Send reset email
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="px-5 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowConfirm(true)}
          disabled={pending}
          className="px-5 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition disabled:opacity-50"
        >
          Send password reset email
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section F: Delete Account
// ---------------------------------------------------------------------------

function DeleteAccountSection({
  data,
  onAction,
  pending,
  router,
}: {
  data: UserProfileData;
  onAction: (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>, onSuccess?: () => void) => void;
  pending: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [typedEmail, setTypedEmail] = useState('');
  const c = data.company;

  return (
    <div className="bg-white rounded-xl border border-red-200 shadow-sm p-6 space-y-4">
      <h2 className="text-lg font-semibold text-red-900">Danger Zone</h2>

      {showConfirm ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-3">
          <p className="text-sm font-semibold text-red-800">
            Permanently delete <strong>{c.name}</strong>?
          </p>
          <p className="text-xs text-red-700">
            This wipes all data, files, and login(s). The email becomes free to sign up again. This cannot be undone.
          </p>
          <p className="text-xs text-red-700">
            Type <code className="bg-white/70 px-1 rounded">{data.user.email}</code> to confirm:
          </p>
          <input
            type="email"
            value={typedEmail}
            onChange={(e) => setTypedEmail(e.target.value)}
            placeholder="Type the email exactly"
            className="w-full rounded-lg border border-red-300 px-4 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
          <div className="flex gap-3">
            <button
              onClick={() => onAction(
                async () => deleteAccount(c.id, typedEmail),
                () => { router.push('/admin/users'); },
              )}
              disabled={
                pending ||
                typedEmail.trim().toLowerCase() !== data.user.email.toLowerCase()
              }
              className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-50"
            >
              {pending ? 'Deleting…' : 'Permanently delete'}
            </button>
            <button
              onClick={() => { setShowConfirm(false); setTypedEmail(''); }}
              className="px-5 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowConfirm(true)}
          disabled={pending}
          className="rounded-full border border-red-200 text-red-600 px-5 py-2 text-sm font-medium hover:bg-red-50 transition disabled:opacity-50"
        >
          Delete account
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Impersonate Button (Feature 6 — Gerald H-01: server-side overlay)
// ---------------------------------------------------------------------------

function ImpersonateButton({
  userId,
  userEmail,
  onAction,
  pending,
}: {
  userId: string;
  userEmail: string;
  onAction: (
    fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>,
    onSuccess?: () => void,
  ) => void;
  pending: boolean;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [notifyUser, setNotifyUser] = useState(true);
  const router = useRouter();

  function impersonate() {
    onAction(async () => {
      const res = await startImpersonation(userId, { notifyUser });
      if (res.ok && res.redirect) {
        router.push(res.redirect);
      }
      return res;
    });
  }

  if (showConfirm) {
    return (
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={notifyUser}
            onChange={(e) => setNotifyUser(e.target.checked)}
            className="rounded"
          />
          Notify user
        </label>
        <button
          type="button"
          onClick={impersonate}
          disabled={pending}
          className="inline-flex items-center rounded-full bg-[#FF6B35] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#e55a2b] disabled:opacity-50"
        >
          {pending ? 'Starting…' : 'Confirm impersonation'}
        </button>
        <button
          type="button"
          onClick={() => setShowConfirm(false)}
          className="px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setShowConfirm(true)}
      disabled={pending}
      className="inline-flex items-center rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30 disabled:opacity-50"
    >
      Log in as {userEmail.split('@')[0]}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Storage Section (Feature 4 — Gerald H-03: trigger-based accounting)
// ---------------------------------------------------------------------------

function StorageSection({ data }: { data: UserProfileData }) {
  const [attachments, setAttachments] = useState<AttachmentRow[] | null>(null);
  const [loading, startLoad] = useTransition();

  useEffect(() => {
    startLoad(async () => {
      const res = await listAttachments(data.company.id);
      if (res.ok) {
        setAttachments(res.rows);
      } else {
        setAttachments([]);
      }
    });
  }, [data.company.id]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Storage &amp; Files</h2>
      {loading && attachments === null ? (
        <p className="text-sm text-slate-500">Loading files…</p>
      ) : attachments !== null ? (
        <StorageTab
          attachments={attachments}
          companyId={data.company.id}
          storageUsed={data.company.storageUsedBytes}
          storageLimit={data.company.storageLimitBytes}
        />
      ) : (
        <p className="text-sm text-slate-500">Failed to load files.</p>
      )}
    </div>
  );
}
