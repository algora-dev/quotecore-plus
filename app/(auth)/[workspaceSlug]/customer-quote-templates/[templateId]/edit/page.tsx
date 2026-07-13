import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';
import { TemplateEditor } from './TemplateEditor';
import { notFound } from 'next/navigation';

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; templateId: string }>;
}) {
  const { workspaceSlug, templateId } = await params;
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: template } = await supabase
    .from('customer_quote_templates')
    .select('*')
    .eq('id', templateId)
    .eq('company_id', profile.company_id)
    .single();

  if (!template) notFound();

  const ent = await loadCompanyEntitlements(profile.company_id);

  return (
    <TemplateEditor
      workspaceSlug={workspaceSlug}
      template={template}
      isOverStorage={ent.isOverStorage}
    />
  );
}
