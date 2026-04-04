import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { loadCustomerQuoteTemplates } from '../quotes/actions';
import { TemplatesPageClient } from './TemplatesPageClient';

export default async function TemplatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { workspaceSlug } = await params;
  const { tab } = await searchParams;
  const profile = await requireCompanyContext();

  const supabase = await createSupabaseServerClient();
  
  // Load roof quote templates
  const { data: quoteTemplates } = await supabase
    .from('templates')
    .select('*')
    .eq('company_id', profile.company_id)
    .order('name');

  const customerQuoteTemplates = await loadCustomerQuoteTemplates();

  return (
    <TemplatesPageClient
      workspaceSlug={workspaceSlug}
      companyId={profile.company_id}
      quoteTemplates={quoteTemplates || []}
      customerQuoteTemplates={customerQuoteTemplates}
      initialTab={tab || 'quote'}
    />
  );
}
