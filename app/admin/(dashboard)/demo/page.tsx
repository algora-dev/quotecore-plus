import { createAdminClient } from '@/app/lib/supabase/admin';
import { requireAdmin } from '@/app/lib/supabase/server';
import { setDemoSwitch } from './actions';
import { loadDemoVisitors, type DemoVisitorRow } from '@/app/lib/admin/demo-visitors';

export const dynamic = 'force-dynamic';

/**
 * Live Demo control room (Architecture V2 - docs/demo/ARCHITECTURE_V2_2026-09-26.md).
 * Owner requirement 2026-09-28: see what the demo is doing + kill switches that
 * take effect on the next request without a deploy. Everything ships dark;
 * switches live in demo_control row 1.
 */
export default async function AdminDemoPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [controlRes, totalRes, activeRes, failedRes, usageRes] = await Promise.all([
    admin.from('demo_control').select('demo_enabled,ai_enabled,updated_at').eq('id', 1).maybeSingle(),
    admin.from('demo_sessions').select('*', { count: 'exact', head: true }),
    admin.from('demo_sessions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('demo_sessions').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
    admin.from('demo_usage').select('action_type,status,actual_credits').gte('created_at', dayAgo),
  ]);

  const demoOn = controlRes.data?.demo_enabled === true;
  const aiOn = controlRes.data?.ai_enabled === true;
  const updatedAt = (controlRes.data?.updated_at as string | null) ?? null;
  const usage = usageRes.data ?? [];
  // Demo visitors list degrades to empty; switches and stats stay usable.
  let demoVisitors: DemoVisitorRow[] = [];
  try {
    demoVisitors = await loadDemoVisitors(20);
  } catch {
    demoVisitors = [];
  }
  const credits24h = usage.filter((u) => u.status === 'settled').reduce((s, u) => s + (u.actual_credits ?? 0), 0);
  const denied24h = usage.filter((u) => u.status === 'denied').length;
  const byAction = new Map<string, number>();
  for (const u of usage) byAction.set(u.action_type, (byAction.get(u.action_type) ?? 0) + 1);
  const topActions = [...byAction.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  const card = 'bg-white rounded-xl border border-slate-200 p-5';
  const stat = (label: string, value: string | number) => (
    <div key={label} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Demo</h1>
        <p className="mt-1 text-sm text-slate-600">
          Public sandbox on Architecture V2. Switches apply instantly on the next request - no deploy needed.
          {updatedAt && <span className="text-slate-400"> Last changed {new Date(updatedAt).toLocaleString('en-GB')}.</span>}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className={card}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Demo</h2>
              <p className="text-sm text-slate-600">Provisioning + entry point for all demo visitors.</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${demoOn ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
              {demoOn ? 'ON' : 'OFF'}
            </span>
          </div>
          <form action={setDemoSwitch.bind(null, 'demo_enabled', !demoOn)} className="mt-4">
            <button className={`w-full rounded-full px-4 py-2 text-sm font-medium ${demoOn ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}>
              {demoOn ? 'Turn demo OFF (kills entry + provisioning)' : 'Turn demo ON'}
            </button>
          </form>
        </div>

        <div className={card}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Demo AI</h2>
              <p className="text-sm text-slate-600">All paid-model calls for demo tenants (assistant, scans, parse). Requires demo ON.</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${demoOn && aiOn ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
              {demoOn && aiOn ? 'ON' : 'OFF'}
            </span>
          </div>
          <form action={setDemoSwitch.bind(null, 'ai_enabled', !aiOn)} className="mt-4">
            <button className={`w-full rounded-full px-4 py-2 text-sm font-medium ${aiOn ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}>
              {aiOn ? 'Turn AI OFF (emergency brake)' : 'Turn AI ON'}
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stat('Sessions (total)', totalRes.count ?? 0)}
        {stat('Active now', activeRes.count ?? 0)}
        {stat('Failed provisions', failedRes.count ?? 0)}
        {stat('AI credits (24h)', credits24h)}
      </div>

      <div className={card}>
        <h2 className="font-semibold text-slate-900">AI actions (last 24h)</h2>
        {denied24h > 0 && <p className="mt-1 text-sm text-amber-700">{denied24h} denials (budget or switch).</p>}
        {topActions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No demo AI usage yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {topActions.map(([action, count]) => (
              <li key={action} className="flex justify-between py-2 text-sm">
                <span className="text-slate-700">{action}</span>
                <span className="font-medium text-slate-900">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={card}>
        <h2 className="font-semibold text-slate-900">Demo users (newest {demoVisitors.length})</h2>
        <p className="mt-1 text-sm text-slate-500">One row per anonymous visitor session. Placeholder @demo.invalid emails never receive mail.</p>
        {demoVisitors.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No demo visitors yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {demoVisitors.map((d) => {
              const expired = d.expiresAt ? new Date(d.expiresAt).getTime() < Date.now() : false;
              const pill = d.sessionStatus === 'active' && !expired
                ? 'bg-blue-100 text-blue-700 border-blue-200'
                : d.sessionStatus === 'provisioning'
                  ? 'bg-orange-100 text-orange-700 border-orange-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200';
              return (
                <li key={d.companyId} className="flex items-center justify-between gap-4 py-2 text-sm">
                  <span className="min-w-0 truncate text-slate-700">{d.ownerEmail || 'No visitor profile'}</span>
                  <span className="flex flex-shrink-0 items-center gap-1.5">
                    {typeof d.resetCount === 'number' && d.resetCount > 0 && (
                      <span className="rounded-full px-2.5 py-1 text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
                        {d.resetCount} reset{d.resetCount === 1 ? '' : 's'}
                      </span>
                    )}
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${pill}`}>
                      {d.sessionStatus === 'active' && !expired ? 'Active' : (d.sessionStatus ?? 'ended')}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(d.signedUpAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
