import { TemplatesPageClient } from './TemplatesPageClient';
import { loadResourcesData } from './load-resources-data';

type SectionTab = 'quote' | 'customer' | 'email' | 'order' | 'catalogs' | 'attachments';

/**
 * Renders a single Resource Library section as a standalone sub-route page
 * (no tab bar). Reuses the existing TemplatesPageClient + shared loader so the
 * section internals and entitlement wiring are untouched.
 */
export async function ResourcesSection({
  workspaceSlug,
  tab,
}: {
  workspaceSlug: string;
  tab: SectionTab;
}) {
  const data = await loadResourcesData();

  return (
    <TemplatesPageClient
      workspaceSlug={workspaceSlug}
      companyId={data.companyId}
      quoteTemplates={data.quoteTemplates}
      customerQuoteTemplates={data.customerQuoteTemplates}
      emailTemplates={data.emailTemplates}
      attachments={data.attachments}
      attachmentEntitlements={data.attachmentEntitlements}
      orderTemplates={data.orderTemplates}
      catalogs={data.catalogs}
      catalogsEnabled={data.catalogEntitlements.catalogsEnabled}
      catalogLimit={data.catalogEntitlements.catalogLimit}
      catalogCount={data.catalogEntitlements.catalogCount}
      catalogEffectivePlanCode={data.catalogEntitlements.effectivePlanCode}
      catalogSubscriptionActive={data.catalogEntitlements.isActive}
      initialTab={tab}
      hideTabBar
    />
  );
}
