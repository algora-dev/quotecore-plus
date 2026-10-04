import { redirect } from 'next/navigation';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { readActiveDemoContext } from '@/app/lib/demo/context';
export const dynamic = 'force-dynamic';
/** Finish & Save has ALREADY run save_takeoff_atomic + recalcAllQuoteComponents.
 * This bridge skips only the Builder screen. It never writes canned lines. */
export default async function DemoFinishPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params; const profile = await requireCompanyContext();
  const demo = await readActiveDemoContext(profile.company_id, profile.id);
  if (!demo?.tutorialState.seed.guided_roof_job) redirect(`/${workspaceSlug}/demo-guide`);
  const quoteId = demo.tutorialState.seed.guided_roof_job;
  const client = await createSupabaseServerClient();
  const session = await client.from('takeoff_sessions').select('version').eq('quote_id', quoteId).maybeSingle();
  if (session.error || !demo.tutorialState.acknowledgements['takeoff.saved'] || (session.data?.version ?? 0) <= 1) {
    return <div className="mx-auto max-w-xl space-y-4 p-6"><h1 className="text-xl font-semibold">Save your prepared Takeoff first</h1><p>The customer quote will use the measurements you actually save, including additions and deletions.</p><a className="underline" href={`/${workspaceSlug}/quotes/${quoteId}/takeoff`}>Return to the prepared plan</a></div>;
  }
  redirect(`/${workspaceSlug}/quotes/${quoteId}/customer-edit`);
}
