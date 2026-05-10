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

  // Load quote data (same as v1)
  const supabase = await createSupabaseServerClient();
  const [quote, roofAreas, roofAreaEntries, components, entries, libraryComponents] = await Promise.all([
    loadQuote(id),
    loadQuoteRoofAreas(id),
    loadAllRoofAreaEntriesForQuote(id),
    loadQuoteComponents(id),
    loadAllEntriesForQuote(id),
    loadComponentLibrary(),
  ]);

  // Validate entry mode
  if (quote.entry_mode !== 'digital') {
    redirect(`/${workspaceSlug}/quotes/${id}`);
  }

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
      initialStep={step}
    />
  );
}
