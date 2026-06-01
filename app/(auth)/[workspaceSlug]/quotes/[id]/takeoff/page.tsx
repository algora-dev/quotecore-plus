import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { getSignedUrl } from '@/app/lib/storage/helpers';
import { BUCKETS } from '@/app/lib/storage/buckets';
import { TakeoffPage } from './TakeoffPage';
import { loadTakeoffHydrationData, createTakeoffPageForArea } from './actions';
import { notFound } from 'next/navigation';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
  searchParams: Promise<{ mode?: string; areaName?: string; planMode?: string; pageId?: string; roofAreaId?: string }>;
}) {
  const { workspaceSlug, id: quoteId } = await params;
  const { mode, areaName, planMode, pageId, roofAreaId: urlRoofAreaId } = await searchParams;
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

  // Load roof plan file
  const { data: planFile, error: planError } = await supabase
    .from('quote_files')
    .select('storage_path')
    .eq('quote_id', quoteId)
    .eq('file_type', 'plan')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .single();

  console.log('[Takeoff] Plan file query result:', { planFile, planError, quoteId });

  if (!planFile) {
    console.log('[Takeoff] No plan file found, returning 404');
    notFound();
  }

  // Load components from component library
  const { data: components, error: componentsError } = await supabase
    .from('component_library')
    .select('id, name, measurement_type')
    .eq('company_id', profile.company_id)
    .order('name');

  console.log('[Takeoff] Component query result:', {
    count: components?.length || 0,
    error: componentsError,
    companyId: profile.company_id,
    sample: components?.[0],
    allComponents: components,
  });

  if (components && components.length > 0) {
    console.log('[Takeoff] ✅ Successfully loaded', components.length, 'components');
  } else {
    console.warn('[Takeoff] ⚠️ NO COMPONENTS FOUND - Check component_library table for company:', profile.company_id);
  }

  // -----------------------------------------------------------------------
  // P1-1b: Handle re-entry modes.
  //
  // mode=add         → continue measuring on existing page 1.
  //                    hydrationData loaded; plan image may switch to lines overlay.
  // mode=new-page    → fresh takeoff on a new page.
  //   + pageId       → page already created (Option C). Load its image.
  //   + areaName only → server creates a new page (Option B). Clone page-1 image.
  // (no mode)        → first-ever entry. Standard path.
  // -----------------------------------------------------------------------

  if (mode === 'add') {
    // Determine the plan image: clean plan or lines overlay.
    let planUrl: string;
    // takeoff_canvas_path = full composite (original plan + coloured shapes).
    // takeoff_lines_path  = lines only (no background). We use the canvas version
    // so "Show measurements on plan" shows the plan WITH its coloured overlays.
    const canvasPath = (quote as unknown as { takeoff_canvas_path?: string | null }).takeoff_canvas_path;
    if (planMode === 'lines' && canvasPath) {
      planUrl = await getSignedUrl(BUCKETS.QUOTE_DOCUMENTS, canvasPath);
    } else {
      planUrl = await getSignedUrl(BUCKETS.QUOTE_DOCUMENTS, planFile.storage_path);
    }

    // Load existing measurements so the panel hydrates.
    const hydrationData = await loadTakeoffHydrationData(quoteId);

    // Load existing roof areas so the left panel can display them (no canvas reconstruction).
    const { data: existingAreas } = await supabase
      .from('quote_roof_areas')
      .select('id, label')
      .eq('quote_id', quoteId)
      .order('sort_order', { ascending: true });

    return (
      <TakeoffPage
        workspaceSlug={workspaceSlug}
        quoteId={quoteId}
        quote={quote}
        planUrl={planUrl}
        components={components || []}
        hydrationData={hydrationData}
        takeoffMode="add"
        existingRoofAreas={(existingAreas || []).map(a => ({ id: a.id, label: a.label }))}
        isOverStorage={isOverStorage}
      />
    );
  }

  if (mode === 'new-page') {
    let resolvedPageId: string;
    let planUrl: string;

    let resolvedRoofAreaId: string | undefined;

    if (pageId) {
      // Option C: page was already created by the client. Load its image.
      // roofAreaId comes from the URL (set by FilesManager before navigating).
      const { data: page } = await supabase
        .from('takeoff_pages')
        .select('image_storage_path')
        .eq('id', pageId)
        .eq('quote_id', quoteId) // ownership scope
        .single();

      if (!page) {
        console.warn('[Takeoff] new-page: pageId not found:', pageId);
        notFound();
      }

      resolvedPageId = pageId;
      resolvedRoofAreaId = urlRoofAreaId ?? undefined;
      planUrl = page.image_storage_path
        ? await getSignedUrl(BUCKETS.QUOTE_DOCUMENTS, page.image_storage_path)
        : await getSignedUrl(BUCKETS.QUOTE_DOCUMENTS, planFile.storage_path);
    } else {
      // Option B: server creates the new page + roof area, cloning page-1's image.
      const name = areaName ? decodeURIComponent(areaName) : 'New Area';
      const result = await createTakeoffPageForArea(quoteId, name, planFile.storage_path);
      if (!result.ok || !result.pageId) {
        console.error('[Takeoff] createTakeoffPageForArea failed:', result.error);
        notFound();
      }
      resolvedPageId = result.pageId;
      resolvedRoofAreaId = result.roofAreaId;
      planUrl = await getSignedUrl(BUCKETS.QUOTE_DOCUMENTS, planFile.storage_path);
    }

    const decodedAreaName = areaName ? decodeURIComponent(areaName) : undefined;

    return (
      <TakeoffPage
        workspaceSlug={workspaceSlug}
        quoteId={quoteId}
        quote={quote}
        planUrl={planUrl}
        components={components || []}
        hydrationData={null}
        takeoffMode="new-page"
        initialPageId={resolvedPageId}
        initialPageName={decodedAreaName}
        initialRoofAreaId={resolvedRoofAreaId}
        isOverStorage={isOverStorage}
      />
    );
  }

  // --- Default: first-ever entry (no mode param) ---
  const planUrl = await getSignedUrl(BUCKETS.QUOTE_DOCUMENTS, planFile.storage_path);
  const hydrationData = await loadTakeoffHydrationData(quoteId);

  return (
    <TakeoffPage
      workspaceSlug={workspaceSlug}
      quoteId={quoteId}
      quote={quote}
      planUrl={planUrl}
      components={components || []}
      hydrationData={hydrationData}
      isOverStorage={isOverStorage}
    />
  );
}
