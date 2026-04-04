import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { TakeoffPage } from './TakeoffPage';
import { notFound } from 'next/navigation';

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

  // Load roof plan
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

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('QUOTE-DOCUMENTS')
    .getPublicUrl(planFile.storage_path);

  return (
    <TakeoffPage
      workspaceSlug={workspaceSlug}
      quoteId={quoteId}
      quote={quote}
      planUrl={urlData.publicUrl}
    />
  );
}
