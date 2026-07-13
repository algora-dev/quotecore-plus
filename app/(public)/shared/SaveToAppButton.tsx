'use client';

import { useState, useCallback } from 'react';
import { useFreeToolsAuth } from '../_components/FreeToolsAuthProvider';

/**
 * Shared "Save to App" button for free tools.
 * Flow:
 * 1. Check if user is logged into free tools (free tools Supabase)
 * 2. If not -> show login/signup prompt modal
 * 3. If yes -> call /api/app/check-save-eligibility with email + doc type + number
 * 4. If no app account -> show signup prompt modal
 * 5. If quota exceeded -> show quota modal
 * 6. If duplicate number -> show duplicate modal
 * 7. If eligible -> save draft to localStorage, redirect to app import endpoint
 */

export type DocumentType = 'quote' | 'order' | 'invoice';

export interface FreeDocumentData {
  // Header
  companyName: string;
  fromName?: string;
  fromPhone?: string;
  fromEmail?: string;
  clientName: string;
  clientEmail?: string;
  clientAddress?: string;
  documentNumber: string;
  documentDate: string;
  validDays?: string;
  notes?: string;
  footer?: string;
  logo?: string | null;
  currency: string;
  taxRate?: number;
  taxName?: string;
  // Lines
  lines: Array<{
    description: string;
    qty: number;
    unit: string;
    rate: number;
  }>;
}

interface SaveToAppButtonProps {
  documentType: DocumentType;
  documentData: FreeDocumentData;
  /** User's email from the free tools form (if entered). */
  userEmail?: string;
}

type ModalState =
  | { type: 'none' }
  | { type: 'loading' }
  | { type: 'need_email' }
  | { type: 'no_app_account'; email: string }
  | { type: 'quota_exceeded'; planCode?: string; used?: number; limit?: number }
  | { type: 'subscription_inactive'; planCode?: string }
  | { type: 'duplicate_number'; number: string }
  | { type: 'error'; message: string };

export function SaveToAppButton({ documentType, documentData, userEmail }: SaveToAppButtonProps) {
  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const { user: authUser } = useFreeToolsAuth();

  const handleSaveToApp = useCallback(async () => {
    setModal({ type: 'loading' });

    try {
      // 1. Resolve email: auth user email > prop > localStorage
      let email = authUser?.email || userEmail || '';
      if (!email) {
        // Try localStorage (free tools store email there)
        try {
          email = localStorage.getItem('free-tools-email') || '';
        } catch {}
      }

      if (!email) {
        setModal({ type: 'need_email' });
        return;
      }

      // 2. Check eligibility against app
      const res = await fetch('/api/app/check-save-eligibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          documentType,
          documentNumber: documentData.documentNumber,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to check eligibility');
      }

      const result = await res.json();

      if (!result.eligible) {
        if (result.reason === 'no_app_account') {
          setModal({ type: 'no_app_account', email });
        } else if (result.reason === 'quota_exceeded') {
          setModal({
            type: 'quota_exceeded',
            planCode: result.details?.planCode,
            used: result.details?.used,
            limit: result.details?.limit,
          });
        } else if (result.reason === 'subscription_inactive') {
          setModal({ type: 'subscription_inactive', planCode: result.details?.planCode });
        } else if (result.reason === 'duplicate_number') {
          setModal({
            type: 'duplicate_number',
            number: result.details?.duplicateNumber || documentData.documentNumber,
          });
        } else {
          setModal({ type: 'error', message: 'Unable to save to app. Please try again.' });
        }
        return;
      }

      // 3. Eligible - save draft to localStorage and redirect
      const draftId = `doc-draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const draftData = {
        documentType,
        documentData,
        email,
        workspaceSlug: result.workspaceSlug,
        savedAt: new Date().toISOString(),
      };

      try {
        localStorage.setItem(`qcp:doc-draft:${draftId}`, JSON.stringify(draftData));
      } catch {
        // localStorage may be full
      }

      // Redirect to app import endpoint - user will need to be logged in
      const importUrl = `/api/app/import-free-document?draft=${draftId}`;
      window.location.href = importUrl;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setModal({ type: 'error', message });
    }
  }, [documentType, documentData, userEmail, authUser]);

  const closeModal = () => setModal({ type: 'none' });

  const handleSaveToAppWithEmail = useCallback(async (email: string) => {
    setModal({ type: 'loading' });
    try {
      const res = await fetch('/api/app/check-save-eligibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          documentType,
          documentNumber: documentData.documentNumber,
        }),
      });

      if (!res.ok) throw new Error('Failed to check eligibility');
      const result = await res.json();

      if (!result.eligible) {
        if (result.reason === 'no_app_account') {
          setModal({ type: 'no_app_account', email });
        } else if (result.reason === 'quota_exceeded') {
          setModal({ type: 'quota_exceeded', planCode: result.details?.planCode, used: result.details?.used, limit: result.details?.limit });
        } else if (result.reason === 'subscription_inactive') {
          setModal({ type: 'subscription_inactive', planCode: result.details?.planCode });
        } else if (result.reason === 'duplicate_number') {
          setModal({ type: 'duplicate_number', number: result.details?.duplicateNumber || documentData.documentNumber });
        } else {
          setModal({ type: 'error', message: 'Unable to save to app. Please try again.' });
        }
        return;
      }

      // Eligible - save draft and redirect
      const draftId = `doc-draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const draftData = { documentType, documentData, email, workspaceSlug: result.workspaceSlug, savedAt: new Date().toISOString() };
      try { localStorage.setItem(`qcp:doc-draft:${draftId}`, JSON.stringify(draftData)); } catch {}
      window.location.href = `/api/app/import-free-document?draft=${draftId}`;
    } catch (err: unknown) {
      setModal({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, [documentType, documentData]);

  return (
    <>
      <button
        type="button"
        onClick={handleSaveToApp}
        className="inline-flex items-center gap-1.5 rounded-full bg-[#FF6B35] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#ff5722] hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
        </svg>
        Save to App
      </button>

      {/* Loading modal */}
      {modal.type === 'loading' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex flex-col items-center gap-3">
              <svg className="w-8 h-8 animate-spin text-[#FF6B35]" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm font-medium text-slate-700">Checking your account...</p>
            </div>
          </div>
        </div>
      )}

      {/* Need email modal */}
      {modal.type === 'need_email' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Enter your email</h2>
              <button onClick={closeModal} className="p-1 text-slate-400 hover:text-slate-600 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-slate-600">
              Enter your email to save this {documentType} to your QuoteCore+ account.
              If you don't have an account yet, we'll help you sign up.
            </p>
            <input
              type="email"
              placeholder="your@email.com"
              id="save-to-app-email-input"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
            />
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById('save-to-app-email-input') as HTMLInputElement;
                  if (input?.value) {
                    closeModal();
                    // Re-trigger with email
                    handleSaveToAppWithEmail(input.value);
                  }
                }}
                className="w-full text-center px-5 py-2.5 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800 transition-all"
              >
                Continue
              </button>
              <button
                onClick={closeModal}
                className="w-full text-center px-5 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No app account modal */}
      {modal.type === 'no_app_account' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Get QuoteCore+</h2>
              <button onClick={closeModal} className="p-1 text-slate-400 hover:text-slate-600 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-slate-600">
              Your email <strong>{modal.email}</strong> doesn't have a QuoteCore+ account yet.
              Sign up to save this {documentType} to your account, where you can edit it, send it
              to customers, and manage your business.
            </p>
            <div className="flex flex-col gap-2">
              <a
                href={`/signup?ref=free-${documentType}-generator`}
                className="w-full text-center px-5 py-2.5 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800 transition-all"
              >
                Start free trial
              </a>
              <button
                onClick={closeModal}
                className="w-full text-center px-5 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quota exceeded modal */}
      {modal.type === 'quota_exceeded' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Monthly limit reached</h2>
              <button onClick={closeModal} className="p-1 text-slate-400 hover:text-slate-600 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-slate-600">
              You've used all {modal.limit} {documentType}s on your {modal.planCode || 'current'} plan this month.
              {modal.used !== undefined && ` (${modal.used}/${modal.limit} used)`}
              Upgrade your subscription to create more {documentType}s, or wait until your quota resets next month.
            </p>
            <div className="flex flex-col gap-2">
              <a
                href="/account/billing"
                className="w-full text-center px-5 py-2.5 text-sm font-semibold rounded-full bg-[#FF6B35] text-white hover:bg-[#ff5722] transition-all"
              >
                Upgrade plan
              </a>
              <button
                onClick={closeModal}
                className="w-full text-center px-5 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate number modal */}
      {modal.type === 'duplicate_number' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Number already exists</h2>
              <button onClick={closeModal} className="p-1 text-slate-400 hover:text-slate-600 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-slate-600">
              The number <strong>{modal.number}</strong> already exists in your account.
              Change the {documentType} number on your free document and try again.
            </p>
            <button
              onClick={closeModal}
              className="w-full text-center px-5 py-2.5 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800 transition-all"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Subscription inactive modal */}
      {modal.type === 'subscription_inactive' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Subscription inactive</h2>
              <button onClick={closeModal} className="p-1 text-slate-400 hover:text-slate-600 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-slate-600">
              Your QuoteCore+ subscription{modal.planCode ? ` (${modal.planCode})` : ''} is no longer active.
              Reactivate your subscription to save this {documentType} to your account and access all features.
            </p>
            <div className="flex flex-col gap-2">
              <a
                href="/account/billing"
                className="w-full text-center px-5 py-2.5 text-sm font-semibold rounded-full bg-[#FF6B35] text-white hover:bg-[#ff5722] transition-all"
              >
                Reactivate subscription
              </a>
              <button
                onClick={closeModal}
                className="w-full text-center px-5 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error modal */}
      {modal.type === 'error' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Something went wrong</h2>
              <button onClick={closeModal} className="p-1 text-slate-400 hover:text-slate-600 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-slate-600">{modal.message}</p>
            <button
              onClick={closeModal}
              className="w-full text-center px-5 py-2.5 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
