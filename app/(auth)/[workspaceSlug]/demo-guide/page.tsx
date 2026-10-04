import { redirect } from 'next/navigation';
import { requireCompanyContext } from '@/app/lib/supabase/server';
import { readActiveDemoContext } from '@/app/lib/demo/context';
import { DEMO_GUIDE_CHAPTERS } from '@/app/lib/demo/guide';
import { DemoChapterButton } from '@/app/components/demo/DemoChapterButton';
export const dynamic = 'force-dynamic';
export default async function DemoGuidePage({params}:{params:Promise<{workspaceSlug:string}>}) {
  const {workspaceSlug} = await params; const profile = await requireCompanyContext();
  const demo = await readActiveDemoContext(profile.company_id,profile.id); if (!demo) redirect('/demo');
  return <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8"><header><p className="text-xs font-semibold uppercase tracking-widest text-orange-700">QCP Roofing & Construction</p><h1 className="mt-2 text-2xl font-bold">Your business, in miniature</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Build a reusable price, measure the prepared roof, present a customer quote and try real Smart Assistant. Explore at your own pace. All data and prices are examples; no real work or payment is involved.</p></header><div className="grid gap-4 sm:grid-cols-2">{DEMO_GUIDE_CHAPTERS.map((chapter,index) => <section key={chapter.id} className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold text-orange-700">CHAPTER {index+1}</p><h2 className="mt-2 text-lg font-semibold">{chapter.title}</h2><p className="my-3 text-sm text-slate-600">{chapter.summary}</p><p className="mb-4 text-xs text-slate-500">{chapter.steps.filter(step=>demo.tutorialState.acknowledgements[step.event]).length} / {chapter.steps.length} saved actions</p><DemoChapterButton chapter={chapter.id}/></section>)}</div><p className="text-sm leading-6 text-slate-500">Takeoff uses a disclosed precomputed scan, not a live AI scan. Smart Assistant is the real account-control feature, distinct from Q. Its allowance and optional self-send do not replenish on Reset.</p><a className="text-sm font-semibold underline" href={`/${workspaceSlug}`}>Continue exploring the workspace</a></main>;
}
