'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { triggerCronJob, retryScheduledMessage, type CronStatusData } from './actions';

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function CronStatusTab({ cronStatus }: { cronStatus: CronStatusData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null);

  function onTrigger(jobName: string) {
    setError(null);
    setNotice(null);
    setTriggeringJob(jobName);
    startTransition(async () => {
      const res = await triggerCronJob(jobName);
      if (res.ok) {
        setNotice(res.message);
      } else {
        setError(res.error);
      }
      setTriggeringJob(null);
      router.refresh();
    });
  }

  function onRetry(id: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await retryScheduledMessage(id);
      if (res.ok) {
        setNotice(res.message);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  const stats = cronStatus.scheduledMessageStats;

  return (
    <div className="space-y-4">
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

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Pending Msgs" value={stats.pending} color="amber" />
        <StatCard label="Claimed Msgs" value={stats.claimed} color="blue" />
        <StatCard label="Failed Msgs" value={stats.failed} color="red" />
        <StatCard label="Rate Limit Buckets" value={cronStatus.rateLimitCount} color="slate" />
      </div>

      {/* Cron jobs list */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Cron Jobs</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Job</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Source</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Schedule</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cronStatus.jobs.map((job) => (
              <tr key={job.name} className="hover:bg-orange-50/40 transition">
                <td className="px-4 py-3">
                  <div className="font-mono text-xs text-slate-900">{job.name}</div>
                  <div className="text-xs text-slate-400">{job.path}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    job.source === 'vercel'
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    {job.source === 'vercel' ? 'Vercel' : 'pg_cron'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 text-xs">{job.schedule}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onTrigger(job.name)}
                    disabled={pending && triggeringJob === job.name}
                    className="text-xs font-medium text-slate-600 hover:text-orange-600 disabled:opacity-40 transition"
                  >
                    {pending && triggeringJob === job.name ? 'Triggering…' : 'Trigger now'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Last dispatch log */}
      {cronStatus.lastDispatchLog && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Last Dispatch Run</h3>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${
              cronStatus.lastDispatchLog.status === 'success'
                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                : cronStatus.lastDispatchLog.status === 'failed'
                  ? 'bg-red-100 text-red-700 border-red-200'
                  : 'bg-amber-100 text-amber-700 border-amber-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                cronStatus.lastDispatchLog.status === 'success' ? 'bg-emerald-500'
                  : cronStatus.lastDispatchLog.status === 'failed' ? 'bg-red-500'
                    : 'bg-amber-500'
              }`} />
              {cronStatus.lastDispatchLog.status}
            </span>
            <span>Started: {formatTime(cronStatus.lastDispatchLog.started_at)}</span>
            {cronStatus.lastDispatchLog.finished_at && (
              <span>Finished: {formatTime(cronStatus.lastDispatchLog.finished_at)}</span>
            )}
          </div>
          {cronStatus.lastDispatchLog.error && (
            <p className="text-xs text-red-600 mt-2 font-mono">{cronStatus.lastDispatchLog.error}</p>
          )}
        </div>
      )}

      {/* Failed messages */}
      {cronStatus.failedMessages.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Failed Scheduled Messages ({cronStatus.failedMessages.length})</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Recipient</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Trigger</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Error</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Fire At</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cronStatus.failedMessages.map((msg) => (
                <tr key={msg.id} className="hover:bg-orange-50/40 transition">
                  <td className="px-4 py-3 text-slate-900 text-xs">{msg.recipient_email}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs font-mono">{msg.trigger_event}</td>
                  <td className="px-4 py-3 text-red-600 text-xs font-mono max-w-xs truncate" title={msg.failed_error ?? ''}>{msg.failed_error ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatTime(msg.fire_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onRetry(msg.id)}
                      disabled={pending}
                      className="text-xs font-medium text-slate-600 hover:text-orange-600 disabled:opacity-40 transition"
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: 'amber' | 'blue' | 'red' | 'slate' }) {
  const colorMap = {
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
  };
  return (
    <div className={`rounded-xl border p-3 ${colorMap[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium opacity-80">{label}</div>
    </div>
  );
}
