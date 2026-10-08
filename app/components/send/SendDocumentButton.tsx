'use client';

/**
 * SendDocumentButton - the unified trigger button + modal mount.
 *
 * Replaces SendQuoteButton / SendOrderButton / SendInvoiceButton with
 * a single component parameterised by entityKind.
 *
 * The modal shell, mode chooser, copy-URL, generate-email, and compose
 * form are all shared. Entity-specific behaviour is driven by ENTITY_CONFIG.
 */

import { QcJourney, QcJourneyDialog } from '@/app/components/ui/v2/QcJourney';
import { useSendDocument } from './useSendDocument';
import { usePathname } from 'next/navigation';
import { SendTestTipModal } from './SendTestTipModal';
import { SendDocumentModal } from './SendDocumentModal';
import type { SendDocumentProps } from './types';

export function SendDocumentButton(props: SendDocumentProps) {
  const hook = useSendDocument(props);
  // Owner 2026-10-08: one-time "test it on yourself first" tip is main-app guidance; never show it inside a demo workspace.
  const demoWorkspace = (usePathname() ?? '').startsWith('/demo-');

  if (props.hidden) return null;

  const { config, handleOpen, showTestTip, setShowTestTip, testTip, openSendModal, showNoCustomerQuote, setShowNoCustomerQuote } = hook;

  return (
    <QcJourney><>
      <button data-qc-variant="primary"
        onClick={handleOpen}
        data-copilot={config.sendButtonDataCopilot}
        className="qc-flow-control qc-button inline-flex items-center gap-1.5 rounded-full bg-[#FF6B35] px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7Z" />
        </svg>
        {config.sendButtonLabel}
      </button>

      {showTestTip && !demoWorkspace && (
        <SendTestTipModal
          docType={props.entityKind}
          canEmail={props.canEmail}
          onContinue={() => { testTip.markSeen(); setShowTestTip(false); openSendModal(); }}
          onClose={() => { testTip.markSeen(); setShowTestTip(false); }}
        />
      )}

      {showNoCustomerQuote && (
        <QcJourneyDialog label="Send document" size="sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900">Build your customer quote first</h3>
            <p className="text-sm text-slate-500 mt-2">
              You need to create a customer quote before sending it. Click the Customer Quote tab then click create.
            </p>
            <div className="flex justify-end mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowNoCustomerQuote(false);
                  // Tell SummaryTabs to switch to the Customer Quote tab.
                  window.dispatchEvent(new CustomEvent('switch-to-customer-tab'));
                }}
                data-qc-variant="primary" className="qc-flow-control qc-button px-4 py-2 text-sm font-medium rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
              >
                Open customer quote
              </button>
            </div>
          </div>
        </QcJourneyDialog>
      )}

      <SendDocumentModal {...props} hook={hook} />
    </></QcJourney>
  );
}
