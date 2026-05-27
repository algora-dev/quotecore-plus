import { redirect } from 'next/navigation';
import { loadQuote, loadQuoteRoofAreas, loadQuoteComponents, loadAllEntriesForQuote, loadAllRoofAreaEntriesForQuote } from '../../actions';
import { loadComponentLibrary } from '../../../components/actions';
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
  const [roofAreas, roofAreaEntries, components, entries, libraryComponents] = await Promise.all([
    loadQuoteRoofAreas(id),
    loadAllRoofAreaEntriesForQuote(id),
    loadQuoteComponents(id),
    loadAllEntriesForQuote(id),
    loadComponentLibrary(collectionId),
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

  // P1-1b: Sign the lines-overlay image if it exists.
  const linesPath = (quote as unknown as { takeoff_lines_path?: string | null }).takeoff_lines_path;
  const linesImageUrl = linesPath
    ? await getSignedUrl(BUCKETS.QUOTE_DOCUMENTS, linesPath)
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

  // Get company default currency
  const { data: company } = await supabase
    .from('companies')
    .select('default_currency')
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
      planUrl={planUrl}
      planName={planFile?.file_name || null}
      supportingFiles={supportingFiles}
      hasExistingTakeoff={hasExistingTakeoff}
      linesImageUrl={linesImageUrl}
      planStoragePath={planFile?.storage_path || null}
      initialStep={step}
    />
  );
}
