import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TakeoffWorkstation } from './TakeoffWorkstation';

export default async function TakeoffPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const { workspaceSlug, id: quoteId } = await params;
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Load quote
  const { data: quote } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .eq('company_id', profile.company_id)
    .single();

  if (!quote) {
    redirect(`/${workspaceSlug}/quotes`);
  }

  // Load roof plan from quote_files
  const { data: planFile } = await supabase
    .from('quote_files')
    .select('file_path')
    .eq('quote_id', quoteId)
    .eq('file_type', 'roof_plan')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .single();

  if (!planFile) {
    // No plan uploaded, redirect back to quote builder
    redirect(`/${workspaceSlug}/quotes/${quoteId}`);
  }

  // Get public URL for the plan
  const { data: urlData } = supabase.storage
    .from('QUOTE-DOCUMENTS')
    .getPublicUrl(planFile.file_path);

  return (
    <TakeoffWorkstation
      workspaceSlug={workspaceSlug}
      quote={quote}
      planUrl={urlData.publicUrl}
    />
  );
}
