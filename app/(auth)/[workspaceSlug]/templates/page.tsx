import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { loadCustomerQuoteTemplates } from '../quotes/actions';
import { loadEmailTemplates } from './email-actions';
import { TemplatesPageClient } from './TemplatesPageClient';
import { BackButton } from '@/app/components/BackButton';

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

  const [customerQuoteTemplates, emailTemplates] = await Promise.all([
    loadCustomerQuoteTemplates(),
    loadEmailTemplates(),
  ]);

  return (
    <section className="space-y-5">
    <BackButton />
    <TemplatesPageClient
      workspaceSlug={workspaceSlug}
      companyId={profile.company_id}
      quoteTemplates={quoteTemplates || []}
      customerQuoteTemplates={customerQuoteTemplates}
      emailTemplates={emailTemplates}
      initialTab={tab || 'quote'}
    />
    </section>
  );
}
