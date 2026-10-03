'use client';

import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcDialog } from '@/app/components/ui/v2/QcDialog';
import { QcJourney } from '@/app/components/ui/v2/QcJourney';
import { useQcActionNotice } from '@/app/components/ui/v2/QcActionNotice';
import { useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { MaterialOrderRow, MaterialOrderLineRow, FlashingLibraryRow } from '@/app/lib/types';
import { markOrderAsOrdered, resetOrder } from '../../order-list-actions';
import { SendDocumentButton } from '@/app/components/send/SendDocumentButton';
import { ResetButton } from '@/app/components/ResetButton';
import { OrderBody } from '@/app/orders/[token]/OrderBody';
import type { PickerFile } from '@/app/components/attachments/AttachmentSendPicker';
import { elementToPdf } from '@/app/lib/pdf/renderPreviewToPdf';


interface Props {
  order: MaterialOrderRow;
  lines: MaterialOrderLineRow[];
  flashings: FlashingLibraryRow[];
  workspaceSlug: string;
  /** Attachment-library files for the send picker (orders = library only). */
  libraryFiles: PickerFile[];
  /** True when the attachment library isn't in the company's plan. */
  libraryLocked: boolean;
  /** Company currency code for line-by-line price rendering. */
  currency?: string;
  /** Email templates for the send modal + follow-up builder. */
  emailTemplates?: OrderEmailTemplate[];
  /** Whether this company's plan includes scheduled follow-up messages. */
  canFollowups?: boolean;
  /** Whether this company can send via QCP email (drives the test-tip copy). */
  canEmail?: boolean;
  /** Whether THIS user has already seen the one-time "test it first" send tip. */
  sendTestTipSeen?: boolean;
  /** Activity card (server-rendered) shown ABOVE the order body, inside
   *  the grey shell - mirrors the Quotes summary layout where Activity
   *  sits above the document. */
  activitySlot?: ReactNode;
}

export interface OrderEmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  is_default: boolean | null;
  attachment_id?: string | null;
}

/**
 * Internal order preview screen.
 *
 * Renders the SAME `OrderBody` the public /orders/[token] page uses, so
 * the on-screen preview, the in-app Print/PDF flow, AND the public
 * supplier-facing print output are byte-identical (modulo the chrome
 * around the body). This was a deliberate consolidation on 2026-05-13:
 *
 *   - Before: a custom-rolled A4-fixed double box with naive
 *     pagination (`slice(0,3)` then 5/page). That layout split orders
 *     across many half-empty pages, ignored `layout_mode`, and
 *     dropped flashing images in the print version.
 *   - After: one canonical layout. Print is handled by OrderBody's
 *     own `@media print` stylesheet (visibility-scoped to
 *     [data-print-root]; cards are page-break-inside: avoid; layout
 *     mode is honoured in print via [data-layout-mode='double']).
 *
 * The header bar (Back / Mark / Edit / Print / Send) carries
 * `data-exclude-pdf` so OrderBody's print stylesheet hides it.
 */
export function OrderPreview({ order, lines, flashings, workspaceSlug, libraryFiles, libraryLocked, currency = 'GBP', emailTemplates = [], canFollowups = false, canEmail = false, sendTestTipSeen = false, activitySlot }: Props) {
  const router = useRouter();
  // When opened from the Message Center (?from=inbox) "Back" returns to the
  // inbox; otherwise keep the existing history-back behaviour.
  const searchParams = useSearchParams();
  const fromInbox = searchParams.get('from') === 'inbox';
  const handleBack = () => {
    if (fromInbox) router.push(`/${workspaceSlug}/inbox`);
    else router.back();
  };
  const [markingOrdered, setMarkingOrdered] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);
  const { showNotice, notice } = useQcActionNotice();
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const isOrdered = order.status === 'ordered';

  // Owner single download: capture the SAME on-screen OrderBody the user sees
  // (under [data-print-root]) into a PDF via the shared helper, so the
  // download is a pixel match of this preview - identical to the bulk ZIP path
  // (which renders the same OrderBody off-screen). The existing
  // "Print / Save PDF" window.print() button is kept as-is for users who
  // prefer the browser dialog.
  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    try {
      const el = document.querySelector('[data-print-root]') as HTMLElement | null;
      if (!el) {
        showNotice({ title: 'PDF not created', description: 'Could not find the order content to export. Please refresh and try again.', tone: 'danger', focus: true });
        return;
      }
      const pdf = await elementToPdf(el);
      const safe = (order.order_number || 'Order').replace(/[^a-z0-9]/gi, '_');
      pdf.save(`Order-${safe}.pdf`);
    } catch (err) {
      console.error('[OrderPreview] PDF download failed:', err);
      showNotice({ title: 'PDF not created', description: `Failed to generate PDF: ${err instanceof Error ? err.message : 'Unknown error'}`, tone: 'danger', focus: true });
    } finally {
      setDownloadingPdf(false);
    }
  }

  const [showMarkModal, setShowMarkModal] = useState(false);

  async function handleMarkAsOrdered() {
    setMarkingOrdered(true);
    try {
      await markOrderAsOrdered(order.id);
      setShowMarkModal(false);
      router.refresh();
    } catch {
      setMarkError('The order status could not be updated. Please try again.');
    } finally {
      setMarkingOrdered(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Bar - rounded floating card on the page's grey background,
          matching the Quotes summary style and the activity card chrome
          below it. Non-sticky (scrolls with the page like Quotes). app
          chrome only: data-exclude-pdf keeps it off the printed order. */}
      <div className="max-w-7xl mx-auto px-2 sm:px-6 pt-4 md:pt-6 data-exclude-pdf">
      <QcJourney className="bg-white border border-slate-200 rounded-2xl px-3 md:px-6 py-3 md:py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between shadow-sm">
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <QcButton variant="ghost"
            onClick={handleBack}
            title={fromInbox ? 'Back to Message Center' : 'Back'}
            className="flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </QcButton>
          <div className="min-w-0">
            <h1 className="text-base md:text-lg font-semibold text-slate-900">Order Preview</h1>
            <p className="text-xs md:text-sm text-slate-500 truncate">{order.order_number}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isOrdered && (
            <QcButton
              onClick={() => { setMarkError(null); setShowMarkModal(true); }}
              disabled={markingOrdered}
            >
              Mark as ordered
            </QcButton>
          )}
          <Link
            href={`/${workspaceSlug}/material-orders/create?orderId=${order.id}`}
            className="qc-button" data-qc-variant="secondary"
          >
            Edit Order
          </Link>
          {/* Reset: void link + roll back to pre-send so the user can re-send
              a fresh order with a new URL. Only meaningful once the order has
              actually been sent (has a live token). */}
          {order.acceptance_token ? (
            <ResetButton action={resetOrder} id={order.id} entityLabel="Order" />
          ) : null}
          <QcButton
            onClick={handleDownloadPdf}
            disabled={downloadingPdf} aria-busy={downloadingPdf}
          >
            {downloadingPdf ? 'Generating PDF…' : 'Download PDF'}
          </QcButton>
          <QcButton variant="ghost"
            onClick={() => window.print()}
          >
            Print / Save PDF
          </QcButton>
          <SendDocumentButton
            entityKind="order"
            entityId={order.id}
            workspaceSlug={workspaceSlug}
            emailTemplates={emailTemplates ?? []}
            mergeData={{
              order_number: order.order_number,
              order_reference: order.reference ?? '',
              order_supplier: order.to_supplier ?? '',
              company_name: order.from_company ?? '',
            }}
            defaultRecipientName={order.to_supplier}
            canFollowups={canFollowups}
            canEmail={canEmail}
            sendTestTipSeen={sendTestTipSeen}
            libraryFiles={libraryFiles}
            entityFiles={[]}
            libraryLocked={libraryLocked}
            existingToken={order.acceptance_token ?? null}
          />
        </div>
      </QcJourney>
      {notice}
      </div>

      {/* Activity card sits completely above the body, at the same
          content width as the Quotes summary page (max-w-5xl). It's app
          chrome, not part of the printed document, so it does NOT inherit
          the A4 (210mm) paper constraint the order body uses. */}
      {activitySlot ? (
        <div className="max-w-7xl mx-auto px-2 sm:px-6 pt-4 md:pt-6">{activitySlot}</div>
      ) : null}

      {/* Body \u2014 same renderer as the public order page. Matched to the
          Quotes content width (max-w-5xl). OrderBody handles its own A4
          print sizing via [data-print-root] @page rules, so widening this
          screen wrapper does not affect the generated PDF. */}
      <div className="max-w-7xl mx-auto px-2 sm:px-6 py-4 md:py-6 pb-20 md:pb-6">
        <OrderBody order={order} lines={lines} flashings={flashings} currency={currency} />
      </div>

      {/* Confirmation is application chrome, never part of OrderBody/PDF. */}
      <QcDialog open={showMarkModal} pending onRequestClose={() => setShowMarkModal(false)}
        title="Mark as ordered" description="Confirm this order has been sent to the supplier."
        className="data-exclude-pdf"
        footer={<>
          <QcButton onClick={() => setShowMarkModal(false)} disabled={markingOrdered}>Cancel</QcButton>
          <QcButton variant="primary" onClick={handleMarkAsOrdered} disabled={markingOrdered} aria-busy={markingOrdered}>
            {markingOrdered ? 'Updating…' : 'Confirm'}
          </QcButton>
        </>}>
        {markError && <p role="alert" className="text-sm text-red-700">{markError}</p>}
      </QcDialog>
    </div>
  );
}
