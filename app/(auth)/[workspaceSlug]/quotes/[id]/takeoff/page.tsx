import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { getSignedUrl } from '@/app/lib/storage/helpers';
import { BUCKETS } from '@/app/lib/storage/buckets';
import { TakeoffPage } from './TakeoffPage';
import { loadTakeoffHydrationData } from './actions';
import { notFound } from 'next/navigation';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';

export default async function Page({
  params,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const { workspaceSlug, id: quoteId } = await params;
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Load quote
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .eq('company_id', profile.company_id)
    .single();

  if (quoteError || !quote) {
    notFound();
  }

  const ent = await loadCompanyEntitlements(profile.company_id);
  const isOverStorage = ent.isOverStorage;

  // AI Takeoff: load company trade + kill switch for the AI Assist button.
  const { data: companyRow } = await supabase
    .from('companies')
    .select('default_trade')
    .eq('id', profile.company_id)
    .single();
  const aiTakeoffEnabled = process.env.AI_TAKEOFF_ENABLED === 'true';
  const isRoofingCompany = companyRow?.default_trade === 'roofing';
  const aiTakeoffAvailable = aiTakeoffEnabled && isRoofingCompany;

  // AI Takeoff: lazily seed the 6 system placeholder components (Hip, Valley,
  // Ridge, Barge, Spouting, Roof Area) before the component fetch. Idempotent —
  // early-returns if already seeded. Awaited so the rows are guaranteed present.
  if (aiTakeoffAvailable) {
    await supabase.rpc('ensure_ai_system_components', { p_company_id: profile.company_id });
  }

  // Load roof plan file (FIRST uploaded plan). planUrl is only the fallback
  // for takeoff_pages rows without image_storage_path — those are always the
  // FIRST plan upload (its image lives in quote_files), so ordering by most
  // recent showed the newest plan's image on Page 1 (multi-plan bug 2026-07-05).
  const { data: planFile } = await supabase
    .from('quote_files')
    .select('storage_path')
    .eq('quote_id', quoteId)
    .eq('file_type', 'plan')
    .order('uploaded_at', { ascending: true })
    .limit(1)
    .single();

  if (!planFile) {
    notFound();
  }

  // Load components from component library (includes is_system rows so
  // TakeoffWorkstation can render AI placeholder groups; the manual
  // add-component selector filters them out client-side).
  const { data: components } = await supabase
    .from('component_library')
    .select('id, name, measurement_type, collection_id, is_system')
    .eq('company_id', profile.company_id)
    .order('name');

  // Named component libraries
  const { data: collectionsRaw } = await supabase
    .from('component_collections')
    .select('id, name')
    .eq('company_id', profile.company_id)
    .order('name');
  const collections = collectionsRaw ?? [];

  // Batch 4: unified entry — always load everything, no mode branching.
  const planUrl = await getSignedUrl(BUCKETS.QUOTE_DOCUMENTS, planFile.storage_path);
  const hydrationData = await loadTakeoffHydrationData(quoteId);

  // Load ALL roof areas for the area switcher
  const { data: allAreasRaw } = await supabase
    .from('quote_roof_areas')
    .select('id, label, calc_pitch_degrees, final_value_sqm')
    .eq('quote_id', quoteId)
    .order('sort_order', { ascending: true });
  const allRoofAreas = (allAreasRaw ?? []).map(a => ({
    id: a.id,
    label: a.label,
    pitch: a.calc_pitch_degrees ?? 0,
    area: a.final_value_sqm ?? 0,
  }));

  // For backward compat: pass existingRoofAreas so the hydration logic
  // (isExistingAreaMode etc.) still works for saved quotes.
  const existingRoofAreas = allRoofAreas.map(a => ({ id: a.id, label: a.label }));

  return (
    <TakeoffPage
      workspaceSlug={workspaceSlug}
      quoteId={quoteId}
      quote={quote}
      planUrl={planUrl}
      components={components || []}
      collections={collections}
      hydrationData={hydrationData}
      existingRoofAreas={existingRoofAreas}
      isOverStorage={isOverStorage}
      allRoofAreas={allRoofAreas}
      aiTakeoffAvailable={aiTakeoffAvailable}
    />
  );
}
