import { redirect } from 'next/navigation';
import { requireCompanyContext } from '@/app/lib/supabase/server';
import { readActiveDemoContext } from '@/app/lib/demo/context';
import { canEnterChapter, DEMO_GUIDE_CHAPTERS } from '@/app/lib/demo/guide';
import { chapterOutcome } from '@/app/lib/demo/presentation';
import { DemoChapterButton } from '@/app/components/demo/DemoChapterButton';

export const dynamic = 'force-dynamic';

export default async function DemoGuidePage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params; const profile = await requireCompanyContext();
  const demo = await readActiveDemoContext(profile.company_id, profile.id); if (!demo) redirect('/demo');
  const recommended = DEMO_GUIDE_CHAPTERS.find(chapter => canEnterChapter(demo.tutorialState, chapter.id) && !chapterOutcome(demo.tutorialState, chapter).finished)?.id;
  return <main data-qc-ui="v2" className="mx-auto max-w-4xl space-y-7 p-4 sm:p-8">
    <header className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-widest text-[var(--qc-color-orange-ink)]">YOUR GUIDED DEMO</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--qc-text-primary)]">Four chapters. One real workflow.</h1><p className="mt-3 text-sm leading-6 text-[#596273]">Create reusable pricing, put it on a prepared roof, turn the measured job into a customer quote, then control the workspace with Smart Assistant. Your saved actions carry from one chapter into the next.</p></header>
    <div className="grid gap-4 sm:grid-cols-2">{DEMO_GUIDE_CHAPTERS.map((chapter, index) => {
      const { done, skipped, finished: completed } = chapterOutcome(demo.tutorialState, chapter); const available = canEnterChapter(demo.tutorialState, chapter.id);
      return <section key={chapter.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${available ? 'border-slate-200' : 'border-slate-200 opacity-70'}`}>
        <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold text-[var(--qc-color-orange-ink)]">CHAPTER {index + 1}</p><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${completed ? 'bg-[var(--qc-color-success-bg)] text-[var(--qc-color-success-ink)]' : available ? 'bg-[var(--qc-color-orange-wash)] text-[var(--qc-color-orange-ink)]' : 'bg-slate-100 text-slate-500'}`}>{completed ? skipped ? 'Finished · lessons skipped' : 'Complete' : available ? `${done}/${chapter.steps.length} completed` : 'Locked'}</span></div>
        <h2 className="mt-3 text-lg font-semibold text-slate-900">{chapter.title}</h2><p className="mt-2 min-h-10 text-sm leading-5 text-slate-600">{chapter.summary}</p>
        <div className="mt-5"><DemoChapterButton workspaceSlug={workspaceSlug} primary={chapter.id === recommended} chapter={chapter.id} disabled={!available} completed={completed} /></div>
      </section>;
    })}</div>
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600"><strong className="text-slate-900">Good to know:</strong> the prepared Takeoff scan is precomputed for a reliable demo, but the canvas edits, pricing and saved quote are real. Smart Assistant is the real account-control feature and is separate from Q.</div>
    <a className="inline-flex min-h-11 items-center font-semibold text-[var(--qc-color-orange-ink)] underline underline-offset-4" href={`/${workspaceSlug}`}>Back to the workspace</a>
  </main>;
}
