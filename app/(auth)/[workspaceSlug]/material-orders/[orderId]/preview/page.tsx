import { loadOrderForEdit } from '../../create/order-loader';
import { loadFlashingLibrary } from '../../../flashings/actions';
import { OrderPreview } from './order-preview';
import { OrderActivityCard } from '@/app/components/activity/OrderActivityCard';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';

interface Props {
  params: Promise<{ workspaceSlug: string; orderId: string }>;
}

export default async function OrderPreviewPage(props: Props) {
  const { workspaceSlug, orderId } = await props.params;
  
  const [orderData, flashings] = await Promise.all([
    loadOrderForEdit(orderId),
    loadFlashingLibrary(),
  ]);
  
  if (!orderData) {
    notFound();
  }

  // Attachment library for the send picker (orders attach library files only,
  // Pro+ gated). IDS + name + size only - never storage_path on client props.
  const companyId = orderData.order.company_id;
  const entitlements = await loadCompanyEntitlements(companyId);
  const { data: companyRow } = await createAdminClient()
    .from('companies')
    .select('default_currency')
    .eq('id', companyId)
    .maybeSingle();
  const currency = companyRow?.default_currency ?? 'GBP';
  const attachmentsEnabled = entitlements.features.attachment_library;
  const canFollowups = entitlements.features.followups;

  // Email templates for the order send modal + follow-up builder. Mirrors
  // the quote summary page; attachment_id baked default included.
  const { data: emailTemplates } = await createAdminClient()
    .from('email_templates')
    .select('id, name, subject, body, is_default, attachment_id')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  let libraryFiles: Array<{ id: string; name: string; fileSize: number }> = [];
  if (attachmentsEnabled) {
    const admin = createAdminClient();
    const { data: libRows } = await admin
      .from('company_attachments')
      .select('id, name, file_size')
      .eq('company_id', companyId)
      .is('archived_at', null)
      .order('name', { ascending: true });
    libraryFiles = (libRows ?? []).map((r) => ({ id: r.id, name: r.name, fileSize: r.file_size }));
  }

  // Activity card is rendered ABOVE the order body (inside OrderPreview's
  // grey shell) to mirror the Quotes summary layout. It carries
  // data-exclude-pdf so it never lands on the printable order. Replaces
  // the old standalone SupplierResponsePanel - supplier responses now
  // live in the Activity card's Unresolved tab.
  const activityCard = (
    <OrderActivityCard
      orderId={orderId}
      companyId={companyId}
      supplierName={orderData.order.supplier_name ?? orderData.order.to_supplier ?? null}
      acceptedAt={(orderData.order as { confirmed_at?: string | null }).confirmed_at ?? null}
      declinedAt={orderData.order.declined_at ?? null}
      emailTemplates={(emailTemplates ?? []).map((t) => ({ id: t.id, name: t.name, subject: t.subject, is_default: t.is_default }))}
      canFollowups={canFollowups}
    />
  );

  return (
    <OrderPreview
      order={orderData.order}
      lines={orderData.lines}
      flashings={flashings}
      workspaceSlug={workspaceSlug}
      libraryFiles={libraryFiles}
      libraryLocked={!attachmentsEnabled}
      currency={currency}
      emailTemplates={emailTemplates ?? []}
      canFollowups={canFollowups}
      activitySlot={activityCard}
    />
  );
}
