'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Post-generation modal for free document tools.
 * Replaces CalcResultPopup on the 3 doc generators (quote, order, invoice).
 *
 * Shows context-aware conversion + save-to-app buttons with hover tooltips.
 * One popup per session per tool (sessionStorage dismissal).
 * 1.5s delay after generation so user reads the document first.
 */

export type DocToolType = 'quote' | 'order' | 'invoice';

interface PostGenerationModalProps {
  /** Which free tool this modal is on */
  toolType: DocToolType;
  /** Trigger - when true, starts the delay timer to show the popup */
  trigger: boolean;
  /** Result headline, e.g. "£425.00 quote" */
  resultLabel: string;
  /** Optional breakdown line, e.g. "3 line items for John Smith" */
  resultDetails?: string;
  /** Convert URL params - pre-built by parent */
  convertToOrderUrl?: string;
  convertToInvoiceUrl?: string;
  /** Save to app handler - invoked when user clicks Save to App */
  onSaveToApp: () => void;
}

interface TooltipButtonProps {
  label: string;
  tooltip: string;
  onClick?: () => void;
  href?: string;
  variant: 'primary' | 'accent' | 'ghost';
  icon?: React.ReactNode;
}

function TooltipButton({ label, tooltip, onClick, href, variant, icon }: TooltipButtonProps) {
  const [showTip, setShowTip] = useState(false);
  const [tipAbove, setTipAbove] = useState(true);

  const baseClass = 'group relative w-full flex items-center justify-center gap-1.5 px-5 py-3 text-sm font-semibold rounded-full transition-all';

  const variantClass =
    variant === 'primary'
      ? 'bg-black text-white hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]'
      : variant === 'accent'
      ? 'bg-[#FF6B35] text-white hover:bg-[#ff5722] hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]'
      : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50';

  const tipPosition = tipAbove
    ? 'bottom-full left-1/2 -translate-x-1/2 mb-2'
    : 'top-full left-1/2 -translate-x-1/2 mt-2';

  const content = (
    <>
      {icon}
      <span>{label}</span>
      {showTip && (
        <div
          className={`absolute ${tipPosition} z-10 w-56 rounded-lg bg-slate-900 px-3 py-2 text-xs font-normal text-white shadow-lg pointer-events-none`}
          role="tooltip"
        >
          {tooltip}
        </div>
      )}
    </>
  );

  const sharedProps = {
    className: `${baseClass} ${variantClass}`,
    onMouseEnter: () => {
      // Check if there's room above; if not, show below
      if (typeof window !== 'undefined') {
        // Simple heuristic: if we're in the top half of the viewport, show below
        setTipAbove(true);
      }
      setShowTip(true);
    },
    onMouseLeave: () => setShowTip(false),
    onFocus: () => setShowTip(true),
    onBlur: () => setShowTip(false),
  };

  if (href) {
    return (
      <a href={href} {...sharedProps}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} {...sharedProps}>
      {content}
    </button>
  );
}

export function PostGenerationModal({
  toolType,
  trigger,
  resultLabel,
  resultDetails,
  convertToOrderUrl,
  convertToInvoiceUrl,
  onSaveToApp,
}: PostGenerationModalProps) {
  const [visible, setVisible] = useState(false);
  const storageKey = `qcp:postgen:${toolType}`;

  const dismiss = useCallback(() => {
    setVisible(false);
    try { sessionStorage.setItem(storageKey, '1'); } catch {}
  }, [storageKey]);

  useEffect(() => {
    if (!trigger) return;
    try {
      if (sessionStorage.getItem(storageKey)) return;
    } catch {}
    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, [trigger, storageKey]);

  if (!visible) return null;

  const convertIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );

  const saveIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
    </svg>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-[fadeInUp_0.3s_ease-out]">
        {/* Result headline */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 border border-orange-100 px-3 py-1 mb-3">
            <svg className="w-3.5 h-3.5 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            <span className="text-xs font-medium text-[#FF6B35]">Your {toolType} is ready</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{resultLabel}</p>
          {resultDetails && (
            <p className="mt-1.5 text-sm text-slate-500">{resultDetails}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="space-y-2.5">
          {/* Convert to Order (quote only) */}
          {toolType === 'quote' && convertToOrderUrl && (
            <TooltipButton
              label="Convert to Order"
              tooltip="One click - populates your quote details into an order form"
              href={convertToOrderUrl}
              variant="primary"
              icon={convertIcon}
            />
          )}

          {/* Convert to Invoice (quote + order) */}
          {(toolType === 'quote' || toolType === 'order') && convertToInvoiceUrl && (
            <TooltipButton
              label="Convert to Invoice"
              tooltip="One click - populates your details into an invoice form"
              href={convertToInvoiceUrl}
              variant="primary"
              icon={convertIcon}
            />
          )}

          {/* Save to App */}
          <TooltipButton
            label="Save to App"
            tooltip="Sign up for a free 14-day trial. Save, edit, send quotes and use all features of the app"
            onClick={onSaveToApp}
            variant="accent"
            icon={saveIcon}
          />

          {/* Maybe Later */}
          <button
            type="button"
            onClick={dismiss}
            className="w-full text-center px-5 py-2 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors"
            title="You can also do this in the next step - convert or save your document anytime from the buttons below."
          >
            Maybe later
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
