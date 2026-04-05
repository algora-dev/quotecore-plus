import Link from 'next/link';

import { loadCompanyContext } from '@/app/lib/data/company-context';

export default async function WorkspaceHome({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const { company } = await loadCompanyContext();

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Workspace overview</h1>
        <p className="text-slate-600">
          Welcome back. Jump into templates or quotes, or finish your outstanding tasks.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Templates</h2>
          <p className="mt-1 text-sm text-slate-600">
            Build reusable logic for quotes, manual measurement, and future AI takeoff.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/${workspaceSlug}/templates`}
              prefetch={false}
              className="inline-flex items-center rounded-full border-2 border-transparent bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
            >
              Manage templates
            </Link>
            <Link
              href={`/${workspaceSlug}/templates/new`}
              prefetch={false}
              className="inline-flex items-center rounded-full border-2 border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 pill-shimmer"
            >
              + New template
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Quotes</h2>
          <p className="mt-1 text-sm text-slate-600">
            Track in-progress quotes, upload supporting files, and send business-ready outputs.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/${workspaceSlug}/quotes`}
              prefetch={false}
              className="inline-flex items-center rounded-full border-2 border-transparent bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
            >
              Open quotes workspace
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6">
        <p className="text-sm text-slate-500">
          Workspace slug: <span className="font-mono text-slate-700">{company.slug}</span>
        </p>
      </div>
    </section>
  );
}
