import Link from 'next/link';
import { getDemoControl } from '@/app/lib/demo/control';
import { DemoLauncher } from './DemoLauncher';

export const dynamic = 'force-dynamic';

/**
 * Public demo entry (Architecture V2): quote-core.com/demo → demo host.
 * While iterating on testing this is path-based on the shared host; the
 * production demo.quote-core.com host arrives at controlled launch.
 * The page itself is switch-aware: demo off = coming soon, on = launcher.
 */
export default async function DemoEntryPage() {
  const control = await getDemoControl();

  if (!control.demoEnabled) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Live demo coming soon</h1>
          <p className="mt-3 text-sm text-slate-600">
            The interactive QuoteCore+ demo is being prepared. Everything you can see on the rest of this site works today.
          </p>
          <Link href="/" className="mt-6 inline-flex rounded-full bg-slate-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-slate-800">
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Try QuoteCore+ free</h1>
        <p className="mt-3 text-sm text-slate-600">
          Explore the real app in your own private workspace. No signup, no card, nothing to install.
          You keep the workspace for 24 hours and can reset it any time.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          <li>Build a quote with live pricing</li>
          <li>Measure from a plan with digital takeoff</li>
          <li>Ask the Smart Assistant about your work</li>
          <li>Turn quotes into orders and invoices</li>
        </ul>
        <DemoLauncher />
        <p className="mt-4 text-xs text-slate-400">
          Demo workspace, fictional data. Nothing you do here can email, bill or contact anyone.
        </p>
      </div>
    </main>
  );
}
