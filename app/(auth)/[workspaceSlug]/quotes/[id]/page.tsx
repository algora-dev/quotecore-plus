import { loadQuote, loadQuoteRoofAreas, loadQuoteComponents, loadAllEntriesForQuote, loadAllRoofAreaEntriesForQuote } from '../actions';
import { loadComponentLibrary } from '../../components/actions';
import { QuoteBuilder } from './quote-builder';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { loadTakeoffMeasurements } from './takeoff/actions';

export default async function QuoteBuilderPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const { workspaceSlug, id } = await params;
  const [quote, roofAreas, roofAreaEntries, components, libraryComponents, entries, takeoffData] = await Promise.all([
    loadQuote(id),
    loadQuoteRoofAreas(id),
    loadAllRoofAreaEntriesForQuote(id),
    loadQuoteComponents(id),
    loadComponentLibrary(),
    loadAllEntriesForQuote(id),
    loadTakeoffMeasurements(id),
  ]);
  
  const supabase = await createSupabaseServerClient();
  
  // Load company default currency
  const { data: company } = await supabase
    .from('companies')
    .select('default_currency')
    .eq('id', quote.company_id)
    .single();
  const companyDefaultCurrency = company?.default_currency || 'NZD';
  
  // Load roof plan (if exists)
  const { data: planFile } = await supabase
    .from('quote_files')
    .select('storage_path, file_name')
    .eq('quote_id', id)
    .eq('file_type', 'plan')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  let planUrl: string | null = null;
  let planName: string | null = null;
  if (planFile) {
    const { data: urlData } = supabase.storage
      .from('QUOTE-DOCUMENTS')
      .getPublicUrl(planFile.storage_path);
    planUrl = urlData.publicUrl;
    planName = planFile.file_name;
  }
  
  // Load supporting files
  const { data: supportingFilesData } = await supabase
    .from('quote_files')
    .select('id, file_name, file_size, storage_path, uploaded_at')
    .eq('quote_id', id)
    .eq('file_type', 'supporting')
    .order('uploaded_at', { ascending: false });
  
  const supportingFiles = (supportingFilesData || []).map(file => {
    const { data: urlData } = supabase.storage
      .from('QUOTE-DOCUMENTS')
      .getPublicUrl(file.storage_path);
    return {
      id: file.id,
      fileName: file.file_name,
      fileSize: file.file_size,
      url: urlData.publicUrl,
      uploadedAt: file.uploaded_at,
    };
  });

  return (
    <QuoteBuilder
      quote={quote}
      initialRoofAreas={roofAreas}
      initialRoofAreaEntries={roofAreaEntries}
      initialComponents={components}
      initialEntries={entries}
      libraryComponents={libraryComponents}
      workspaceSlug={workspaceSlug}
      companyDefaultCurrency={companyDefaultCurrency}
      planUrl={planUrl}
      planName={planName}
      supportingFiles={supportingFiles}
      takeoffData={takeoffData}
    />
  );
}
