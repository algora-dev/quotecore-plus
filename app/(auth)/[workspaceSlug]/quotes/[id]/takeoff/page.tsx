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
  const { data: planFile } = await supabase
    .from('quote_files')
    .select('file_path')
    .eq('quote_id', quoteId)
    .eq('file_type', 'roof_plan')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .single();

  if (!planFile) {
    notFound();
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('quote-documents')
    .getPublicUrl(planFile.file_path);

  return (
    <TakeoffPage
      workspaceSlug={workspaceSlug}
      quoteId={quoteId}
      quote={quote}
      planUrl={urlData.publicUrl}
    />
  );
}
