import { notFound } from 'next/navigation';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { InvoiceEditor, type InvoiceRow, type InvoiceLineRow } from './InvoiceEditor';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';
import { InvoiceActivityCard } from '@/app/components/activity/InvoiceActivityCard';

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

  // Load message templates for the send-invoice + follow-up flow.
  // Message templates are SHARED across quotes / orders / invoices (the quote
  // and order send surfaces load ALL of a company's email_templates with no
  // kind filter). Invoice follow-ups likewise reuse any message template the
  // user has written - they do NOT require a kind='invoice_send' template (and
  // never an invoice_template doc, which is just header/payment details). The
  // old `.in('kind', ['invoice_send','custom'])` filter hid the user's
  // existing quote_send templates, producing the false "no templates" state.
  const { data: emailTemplates } = await admin
    .from('email_templates')
    .select('id, name, subject, body, is_default')
    .eq('company_id', profile.company_id)
    .order('name');

  // Whether this company's plan includes scheduled follow-ups (mirrors
  // the quote/order send surfaces).
  const entitlements = await loadCompanyEntitlements(profile.company_id);
  const canFollowups = entitlements.features.followups;

  // Activity card only makes sense once the invoice has left draft
  // (nothing sent / no disputes / no schedules on a fresh draft). It
  // renders ABOVE the invoice document in the right preview pane, on the
  // same grey background, mirroring the Quotes summary layout.
  const showActivity = invoice.status && invoice.status !== 'draft';
  const activityCard = showActivity ? (
    <InvoiceActivityCard
      invoiceId={id}
      companyId={profile.company_id}
      customerName={invoice.customer_name ?? null}
      customerEmail={invoice.customer_email ?? null}
      emailTemplates={(emailTemplates ?? []).map((t) => ({ id: t.id, name: t.name, subject: t.subject, is_default: t.is_default }))}
      canFollowups={canFollowups}
    />
  ) : null;

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
      canFollowups={canFollowups}
      activitySlot={activityCard}
    />
  );
}
