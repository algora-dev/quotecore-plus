import { requireCompanyContext } from '@/app/lib/supabase/server';
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
  await requireCompanyContext();

  const customerQuoteTemplates = await loadCustomerQuoteTemplates();

  return (
    <TemplatesPageClient
      workspaceSlug={workspaceSlug}
      customerQuoteTemplates={customerQuoteTemplates}
      initialTab={tab || 'quote'}
    />
  );
}
