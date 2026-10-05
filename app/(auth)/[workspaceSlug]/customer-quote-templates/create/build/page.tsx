import { requireCompanyContext } from '@/app/lib/supabase/server';
import { TemplateBuilder } from './TemplateBuilder';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';
import { loadCustomerQuoteTemplates } from '@/app/(auth)/[workspaceSlug]/quotes/actions';
import type { CustomerQuoteTemplateRow } from '@/app/lib/types';

export default async function TemplateBuildPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ name?: string; copy?: string }>;
}) {
  const { workspaceSlug } = await params;
  const { name, copy } = await searchParams;
  const profile = await requireCompanyContext();

  const ent = await loadCompanyEntitlements(profile.company_id);

  // Optional copy source: hydrate the builder from an existing template's fields.
  let sourceTemplate: CustomerQuoteTemplateRow | null = null;
  if (copy) {
    const templates = await loadCustomerQuoteTemplates();
    sourceTemplate = templates.find((t) => t.id === copy) ?? null;
  }

  return (
    <TemplateBuilder
      workspaceSlug={workspaceSlug}
      templateName={name || ''}
      isOverStorage={ent.isOverStorage}
      sourceTemplate={sourceTemplate}
    />
  );
}
