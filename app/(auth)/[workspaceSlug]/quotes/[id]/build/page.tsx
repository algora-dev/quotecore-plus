import { redirect } from 'next/navigation';
import { loadQuote, loadQuoteRoofAreas, loadQuoteComponents, loadAllEntriesForQuote, loadAllRoofAreaEntriesForQuote } from '../../actions';
import { loadComponentLibrary, loadComponentCollections } from '../../../components/actions';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { getSignedUrl, getSignedUrls } from '@/app/lib/storage/helpers';
import { BUCKETS } from '@/app/lib/storage/buckets';
import { QuoteBuilderV2Wrapper } from './QuoteBuilderV2Wrapper';

export default async function QuoteBuilderV2Page({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { workspaceSlug, id } = await params;
  const { step = 'roof-areas' } = await searchParams;

  // Load quote first so we can use its collection_id to filter the library.
  const supabase = await createSupabaseServerClient();
  const quote = await loadQuote(id);

  // Validate entry mode
  if (quote.entry_mode !== 'digital') {
    redirect(`/${workspaceSlug}/quotes/${id}`);
  }

  // Load remaining data in parallel, now that we have the quote's collection_id.
  const collectionId = (quote as unknown as { component_collection_id?: string | null }).component_collection_id;
  const [roofAreas, roofAreaEntries, components, entries, libraryComponents, collections] = await Promise.all([
    loadQuoteRoofAreas(id),
    loadAllRoofAreaEntriesForQuote(id),
    loadQuoteComponents(id),
    loadAllEntriesForQuote(id),
    loadComponentLibrary(collectionId),
    loadComponentCollections(),
  ]);

  // Load files (same as v1)
  const { data: planFile } = await supabase
    .from('quote_files')
    .select('storage_path, file_name')
    .eq('quote_id', id)
    .eq('file_type', 'plan')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // QUOTE-DOCUMENTS is private; mint short-lived signed URLs at render time.
  const planUrl = planFile
    ? await getSignedUrl(BUCKETS.QUOTE_DOCUMENTS, planFile.storage_path)
    : null;

  // P1-1b: Check if this quote has existing takeoff measurements.
  const { count: takeoffMeasurementCount } = await supabase
    .from('quote_takeoff_measurements')
    .select('id', { count: 'exact', head: true })
    .eq('quote_id', id);
  const hasExistingTakeoff = (takeoffMeasurementCount ?? 0) > 0;

  // All uploaded plans for thumbnail strip (2026-07-06):
  // Fetch takeoff_pages with their images + which roof areas have entries on each page.
  const { data: takeoffPagesRaw } = await supabase
    .from('takeoff_pages')
    .select('id, page_order, page_name, image_storage_path')
    .eq('quote_id', id)
    .order('page_order', { ascending: true });

  // Fetch area-to-page mappings via entries.
  const { data: areaEntriesRaw } = await supabase
    .from('quote_roof_area_entries')
    .select('page_id, quote_roof_area_id')
    .in('quote_roof_area_id', roofAreas.map(ra => ra.id));

  // Also need area labels.
  const areaLabelMap = new Map(roofAreas.map(ra => [ra.id, ra.label]));

  // Build page_id -> [area labels] map.
  const pageAreaMap = new Map<string, string[]>();
  for (const e of areaEntriesRaw ?? []) {
    const pid = (e as { page_id: string }).page_id;
    const aid = (e as { quote_roof_area_id: string }).quote_roof_area_id;
    const label = areaLabelMap.get(aid);
    if (pid && label) {
      if (!pageAreaMap.has(pid)) pageAreaMap.set(pid, []);
      const arr = pageAreaMap.get(pid)!;
      if (!arr.includes(label)) arr.push(label);
    }
  }

  // Build the allPlans array: Page 1 uses the original quote_files plan image,
  // subsequent pages use takeoff_pages.image_storage_path.
  const allPlans = await Promise.all((takeoffPagesRaw ?? []).map(async (tp) => {
    const imgPath = (tp as { image_storage_path: string | null }).image_storage_path;
    // Page 1 has no image_storage_path (uses the original uploaded plan file).
    const signedUrl = imgPath
      ? await getSignedUrl(BUCKETS.QUOTE_DOCUMENTS, imgPath)
      : planUrl;
    return {
      pageId: (tp as { id: string }).id,
      pageOrder: (tp as { page_order: number }).page_order,
      pageName: (tp as { page_name: string }).page_name,
      thumbnailUrl: signedUrl,
      areas: pageAreaMap.get((tp as { id: string }).id) ?? [],
    };
  }));

  // P1-1b: Sign the full canvas image (plan + coloured measurements) if it exists.
  // takeoff_canvas_path holds the composite image; takeoff_lines_path is lines-only.
  const canvasPath = (quote as unknown as { takeoff_canvas_path?: string | null }).takeoff_canvas_path;
  const linesImageUrl = canvasPath
    ? await getSignedUrl(BUCKETS.QUOTE_DOCUMENTS, canvasPath)
    : null;

  const { data: supportingFilesData } = await supabase
    .from('quote_files')
    .select('id, storage_path, file_name, file_size, uploaded_at')
    .eq('quote_id', id)
    .eq('file_type', 'supporting')
    .order('uploaded_at', { ascending: false });

  // Batch-sign every supporting file in one round trip.
  const supportingPaths = (supportingFilesData || []).map((f) => f.storage_path);
  const supportingSigned = await getSignedUrls(BUCKETS.QUOTE_DOCUMENTS, supportingPaths);
  const signedByPath = new Map(supportingSigned.map((s) => [s.path, s.signedUrl]));
  const supportingFiles = (supportingFilesData || []).map((f) => ({
    id: f.id,
    storagePath: f.storage_path,
    fileName: f.file_name,
    fileSize: f.file_size,
    url: signedByPath.get(f.storage_path) ?? '',
    uploadedAt: f.uploaded_at,
  }));

  // Get company defaults (currency, measurement system, trade)
  const { data: company } = await supabase
    .from('companies')
    .select('default_currency, default_measurement_system, default_trade')
    .eq('id', quote.company_id)
    .single();

  return (
    <QuoteBuilderV2Wrapper
      quote={quote}
      initialRoofAreas={roofAreas}
      initialRoofAreaEntries={roofAreaEntries}
      initialComponents={components}
      initialEntries={entries}
      libraryComponents={libraryComponents}
      workspaceSlug={workspaceSlug}
      companyDefaultCurrency={company?.default_currency || 'GBP'}
      companyMeasurementSystem={(company as { default_measurement_system?: string })?.default_measurement_system as any || 'metric'}
      companyDefaultTrade={(company as { default_trade?: string })?.default_trade || 'roofing'}
      collections={collections}
      planUrl={planUrl}
      planName={planFile?.file_name || null}
      supportingFiles={supportingFiles}
      hasExistingTakeoff={hasExistingTakeoff}
      linesImageUrl={linesImageUrl}
      planStoragePath={planFile?.storage_path || null}
      allPlans={allPlans}
      initialStep={step}
    />
  );
}
