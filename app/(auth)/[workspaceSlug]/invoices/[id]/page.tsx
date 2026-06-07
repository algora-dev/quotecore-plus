import { notFound } from 'next/navigation';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { InvoiceEditor, type InvoiceRow, type InvoiceLineRow } from './InvoiceEditor';

interface Props {
  params: Promise<{ workspaceSlug: string; id: string }>;
}

export default async function InvoicePage({ params }: Props) {
  const { workspaceSlug, id } = await params;
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  const admin = createAdminClient();

  // Load invoice (must belong to this company)
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .maybeSingle();

  if (!invoice) notFound();

  // Load invoice lines
  const { data: lines } = await supabase
    .from('invoice_lines')
    .select('*')
    .eq('invoice_id', id)
    .order('sort_order');

  // Load company defaults (currency only — no default_logo_url column)
  const { data: company } = await admin
    .from('companies')
    .select('name, default_currency')
    .eq('id', profile.company_id)
    .maybeSingle();

  // Load company logo (same pattern as CustomerQuoteEditor: from quote_files)
  let defaultLogoUrl: string | null = null;
  if (!invoice.cq_company_logo_url) {
    const { data: logoFile } = await supabase
      .from('quote_files')
      .select('storage_path')
      .eq('company_id', profile.company_id)
      .eq('file_type', 'logo')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (logoFile) {
      const { data: urlData } = supabase.storage
        .from('company-logos')
        .getPublicUrl(logoFile.storage_path);
      defaultLogoUrl = urlData.publicUrl;
    }
  }

  // Load company taxes for quick-add
  const { data: companyTaxes } = await admin
    .from('company_taxes')
    .select('id, name, rate_percent')
    .eq('company_id', profile.company_id)
    .order('name');

  // Load catalogs for line picker
  const { data: catalogs } = await admin
    .from('catalogs')
    .select('id, name')
    .eq('company_id', profile.company_id)
    .order('name');

  // Load component collections + library for line picker
  const { data: collections } = await admin
    .from('component_collections')
    .select('id, name')
    .eq('company_id', profile.company_id)
    .order('name');

  const { data: componentLibrary } = await admin
    .from('component_library')
    .select('id, name, collection_id')
    .eq('company_id', profile.company_id)
    .order('name');

  // Load invoice activity
  const { data: activity } = await admin
    .from('invoice_activity')
    .select('id, event_type, metadata, created_at')
    .eq('invoice_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  // Load email templates for the send-invoice flow.
  // Include both invoice_send and custom kinds so users can reuse generic templates.
  const { data: emailTemplates } = await admin
    .from('email_templates')
    .select('id, name, subject, body, is_default')
    .eq('company_id', profile.company_id)
    .in('kind', ['invoice_send', 'custom'])
    .order('name');

  return (
    <InvoiceEditor
      invoice={invoice as unknown as InvoiceRow}
      savedLines={(lines ?? []) as unknown as InvoiceLineRow[]}
      workspaceSlug={workspaceSlug}
      defaultLogoUrl={defaultLogoUrl}
      currency={invoice.currency ?? company?.default_currency ?? 'GBP'}
      companyTaxes={companyTaxes ?? []}
      catalogs={catalogs ?? []}
      collections={collections ?? []}
      componentLibrary={componentLibrary ?? []}
      activity={(activity ?? []) as unknown as { id: string; event_type: string; metadata: Record<string, unknown> | null; created_at: string }[]}
      emailTemplates={(emailTemplates ?? []) as { id: string; name: string; subject: string; body: string; is_default: boolean | null }[]}
    />
  );
}
