import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { loadCustomerQuoteTemplates } from '../quotes/actions';
import { loadEmailTemplates } from './email-actions';
import { loadAttachments, loadAttachmentEntitlements } from '../attachments/actions';
import { loadOrderTemplates } from '../material-orders/template-actions';
import { loadCatalogs, loadCatalogEntitlements } from '../catalogs/actions';

/**
 * Shared loader for the Resource Library data set. Used by the legacy
 * `/resources?tab=` page and by each `/resources/<section>` sub-route so the
 * data-loading + entitlement wiring lives in exactly one place.
 *
 * Loads everything (the section panels expect the full prop set). Sub-routes
 * still load the whole set so the shared TemplatesPageClient renders with all
 * props present; only the active section is shown.
 */
export async function loadResourcesData() {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

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

  return {
    companyId: profile.company_id,
    quoteTemplates: quoteTemplates || [],
    customerQuoteTemplates,
    emailTemplates,
    attachments,
    attachmentEntitlements,
    orderTemplates,
    catalogs,
    catalogEntitlements,
  };
}
