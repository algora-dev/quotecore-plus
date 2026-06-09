'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { MaterialOrderRow, MaterialOrderLineRow, FlashingLibraryRow } from '@/app/lib/types';
import { markOrderAsOrdered } from '../../order-list-actions';
import { SendOrderButton } from './SendOrderButton';
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
export function OrderPreview({ order, lines, flashings, workspaceSlug, libraryFiles, libraryLocked, currency = 'GBP', emailTemplates = [], canFollowups = false }: Props) {
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
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const isOrdered = order.status === 'ordered';

  // Owner single download: capture the SAME on-screen OrderBody the user sees
  // (under [data-print-root]) into a PDF via the shared helper, so the
  // download is a pixel match of this preview — identical to the bulk ZIP path
  // (which renders the same OrderBody off-screen). The existing
  // "Print / Save PDF" window.print() button is kept as-is for users who
  // prefer the browser dialog.
  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    try {
      const el = document.querySelector('[data-print-root]') as HTMLElement | null;
      if (!el) {
        alert('Could not find the order content to export. Please refresh and try again.');
        return;
      }
      const pdf = await elementToPdf(el);
      const safe = (order.order_number || 'Order').replace(/[^a-z0-9]/gi, '_');
      pdf.save(`Order-${safe}.pdf`);
    } catch (err) {
      console.error('[OrderPreview] PDF download failed:', err);
      alert(`Failed to generate PDF: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
      alert('Failed to update status');
    } finally {
      setMarkingOrdered(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Top Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm data-exclude-pdf">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            title={fromInbox ? 'Back to Message Center' : 'Back'}
            className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Order Preview</h1>
            <p className="text-sm text-slate-500">{order.order_number}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isOrdered && (
            <button
              onClick={() => setShowMarkModal(true)}
              disabled={markingOrdered}
              className="px-4 py-2 text-sm font-medium border border-slate-300 bg-white text-slate-700 rounded-full hover:bg-slate-50 transition pill-shimmer disabled:opacity-50"
            >
              Mark as Ordered
            </button>
          )}
          <Link
            href={`/${workspaceSlug}/material-orders/create?orderId=${order.id}`}
            className="px-4 py-2 text-sm font-medium border border-slate-300 bg-white text-slate-700 rounded-full hover:bg-slate-50 transition pill-shimmer"
          >
            Edit Order
          </Link>
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="px-4 py-2 text-sm font-medium border border-slate-300 bg-white text-slate-700 rounded-full hover:bg-slate-50 transition pill-shimmer disabled:opacity-50"
          >
            {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
          >
            Print / Save PDF
          </button>
          <SendOrderButton
            orderId={order.id}
            orderNumber={order.order_number}
            workspaceSlug={workspaceSlug}
            existingToken={order.acceptance_token ?? null}
            defaultRecipientName={order.to_supplier}
            companyName={order.from_company}
            libraryFiles={libraryFiles}
            libraryLocked={libraryLocked}
            emailTemplates={emailTemplates}
            canFollowups={canFollowups}
          />
        </div>
      </div>

      {/* Body \u2014 same renderer as the public order page. */}
      <div className="max-w-[210mm] mx-auto px-6 sm:px-8 py-6">
        <OrderBody order={order} lines={lines} flashings={flashings} currency={currency} />
      </div>

      {/* Mark as Ordered Modal */}
      {showMarkModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50 data-exclude-pdf">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Mark as Ordered</h3>
            <p className="text-sm text-slate-500 mt-2">Confirm this order has been sent to the supplier.</p>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowMarkModal(false)} className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50" disabled={markingOrdered}>Cancel</button>
              <button onClick={handleMarkAsOrdered} className="px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 disabled:opacity-50 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]" disabled={markingOrdered}>{markingOrdered ? 'Updating...' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
