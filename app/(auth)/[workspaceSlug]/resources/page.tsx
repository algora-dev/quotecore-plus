import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { loadCustomerQuoteTemplates } from '../quotes/actions';
import { loadEmailTemplates } from './email-actions';
import { loadAttachments, loadAttachmentEntitlements } from '../attachments/actions';
import { loadOrderTemplates } from '../material-orders/template-actions';
import { loadCatalogs, loadCatalogEntitlements } from '../catalogs/actions';
import { TemplatesPageClient } from './TemplatesPageClient';
import { BackButton } from '@/app/components/BackButton';

export default async function ResourcesPage({
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

  const [
    customerQuoteTemplates,
    emailTemplates,
    attachments,
    attachmentEntitlements,
    orderTemplates,
    catalogs,
    catalogEntitlements,
  ] = await Promise.all([
    loadCustomerQuoteTemplates(),
    loadEmailTemplates(),
    loadAttachments(),
    loadAttachmentEntitlements(),
    loadOrderTemplates(),
    loadCatalogs(),
    loadCatalogEntitlements(),
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
        attachments={attachments}
        attachmentEntitlements={attachmentEntitlements}
        orderTemplates={orderTemplates}
        catalogs={catalogs}
        catalogsEnabled={catalogEntitlements.catalogsEnabled}
        catalogLimit={catalogEntitlements.catalogLimit}
        catalogCount={catalogEntitlements.catalogCount}
        catalogEffectivePlanCode={catalogEntitlements.effectivePlanCode}
        catalogSubscriptionActive={catalogEntitlements.isActive}
        initialTab={tab || 'quote'}
      />
    </section>
  );
}
