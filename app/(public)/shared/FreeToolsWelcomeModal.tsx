'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

/**
 * Welcome modal shown on the /signup page when the user arrives from a
 * free tool (detected via `ref=free-*` URL param).
 *
 * Reassures the user that:
 * - Sign up is free, no card needed
 * - 14-day trial with full features
 * - Their document is saved and waiting for them
 * - It only takes 1 minute
 * - No strings attached
 */

interface FreeToolsWelcomeModalProps {
  /** The ref slug from the URL, e.g. "free-quote-generator" */
  refSlug: string;
  /** Whether a draft was saved (draft param present) */
  hasDraft: boolean;
}

export function FreeToolsWelcomeModal({ refSlug, hasDraft }: FreeToolsWelcomeModalProps) {
  const [visible, setVisible] = useState(false);
  const storageKey = `qcp:signup-welcome:${refSlug}`;

  // Map ref slug to friendly document name
  const docLabel = refSlug === 'free-quote-generator' ? 'quote'
    : refSlug === 'free-order-generator' ? 'purchase order'
    : refSlug === 'free-purchase-order-generator' ? 'purchase order'
    : refSlug === 'free-invoice-generator' ? 'invoice'
    : 'document';

  useEffect(() => {
    // Only show if coming from a free tool
    if (!refSlug || !refSlug.startsWith('free-')) return;
    // Only show once per session per ref
    try {
      if (sessionStorage.getItem(storageKey)) return;
    } catch {}
    // Small delay so the page loads first, then modal appears
    const timer = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(timer);
  }, [refSlug, storageKey]);

  const dismiss = () => {
    setVisible(false);
    try { sessionStorage.setItem(storageKey, '1'); } catch {}
  };

  if (!visible) return null;

  const features = [
    'No card needed — sign up in 1 minute',
    'Free 14-day trial with full features',
    'Save, edit, and send your documents',
    'Use all AI features inside the app',
    'Create unlimited quotes, orders, and invoices',
    'No strings attached — cancel anytime',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 md:p-8 animate-[fadeInUp_0.3s_ease-out]">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-50 border border-orange-100 mb-4">
            <svg className="w-6 h-6 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Sign up for free</h2>
          <p className="text-sm text-slate-500 mt-1">Your {docLabel} is saved and ready for you</p>
        </div>

        {/* Document saved reassurance */}
        {hasDraft && (
          <div className="mb-5 rounded-xl bg-orange-50/60 border border-orange-100 p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-[#FF6B35] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              <div>
                <p className="text-sm font-medium text-slate-900">We&apos;ve saved your {docLabel}</p>
                <p className="text-xs text-slate-600 mt-1">
                  After you create your account, your {docLabel} will be loaded right into your workspace — ready to edit, send, or convert.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Feature list */}
        <ul className="space-y-2.5 mb-6">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-slate-700">{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          type="button"
          onClick={dismiss}
          className="w-full text-center px-5 py-3 bg-black text-white font-semibold rounded-full hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] transition-all"
        >
          Continue to sign up
        </button>

        <p className="mt-3 text-center text-xs text-slate-400">
          Takes 1 minute · No payment required
        </p>
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
