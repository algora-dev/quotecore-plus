import { listRateLimits } from './actions';
import type { RateLimitRowWithMeta } from './helpers';
import { RateLimitsPanel } from './RateLimitsPanel';

export const dynamic = 'force-dynamic';

export default async function RateLimitsPage() {
  const result = await listRateLimits();

  const rows: RateLimitRowWithMeta[] = result.ok ? result.rows : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Rate Limits</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          View and reset rate-limit buckets. Buckets are sorted by urgency — red (≥80% of limit) at the top.
          Resets zero the count and restart the window.
        </p>
      </div>

      {!result.ok && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {result.error}
        </div>
      )}

      <RateLimitsPanel initialRows={rows} />
    </div>
  );
}
