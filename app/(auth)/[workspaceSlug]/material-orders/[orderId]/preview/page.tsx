import { loadOrderForEdit } from '../../create/order-loader';
import { loadFlashingLibrary } from '../../../flashings/actions';
import { OrderPreview } from './order-preview';
import { SupplierResponsePanel } from './SupplierResponsePanel';
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
  const attachmentsEnabled = entitlements.features.attachment_library;
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

  return (
    <>
      <OrderPreview
        order={orderData.order}
        lines={orderData.lines}
        flashings={flashings}
        workspaceSlug={workspaceSlug}
        libraryFiles={libraryFiles}
        libraryLocked={!attachmentsEnabled}
      />
      {/*
        Supplier responses live OUTSIDE the A4-sized print container so
        they never end up on the printable order PDF; the panel itself
        carries the `data-exclude-pdf` marker for the in-app PDF flow.
        Wrapping div restores the page's max-width + padding because
        OrderPreview's wrapper sits inside its own min-h-screen shell.
      */}
      <div className="max-w-[210mm] mx-auto px-8 pb-8 -mt-4">
        <SupplierResponsePanel orderId={orderId} />
      </div>
    </>
  );
}
