'use client';

import { useState, useEffect } from 'react';
import type { ParsedDocumentResult } from './types';

interface AiTextPromptModalProps {
  documentType: 'quote' | 'order' | 'invoice';
  onParsed: (data: ParsedDocumentResult) => void;
  onClose: () => void;
}

interface QuotaInfo {
  limit: number | null;
  used: number;
  remaining: number;
  unlimited: boolean;
}

export function AiTextPromptModal({ documentType, onParsed, onClose }: AiTextPromptModalProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  // Fetch quota on mount
  useEffect(() => {
    fetch('/api/app/ai-quota')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setQuota(d); })
      .catch(() => {});
  }, []);

  async function handleParse() {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/app/parse-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: documentType,
          mode: 'text',
          content: text,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || 'Failed to parse text');
      }

      const data: ParsedDocumentResult = await res.json();
      setSuccess(true);
      onParsed(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePaste() {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (clipboardText) {
        setText(clipboardText);
      }
    } catch {
      // Clipboard API may not be available in all contexts
      // Fall back to focusing the textarea so user can Ctrl+V manually
      const textarea = document.getElementById('ai-text-prompt-textarea');
      textarea?.focus();
    }
  }

  const examples: Record<string, string> = {
    quote:
      'e.g. "New roof for Mr Smith, 123 Oak Street. Strip existing tiles, install new underlay, 120m² of concrete tiles at £35/m², ridge tiles 15m at £25/m, labour 3 days at £200/day. Valid 30 days."',
    order:
      'e.g. "From ABC Supplies: 200 concrete tiles, 4 rolls underlay, 15m ridge, 5kg nails, delivery Tuesday"',
    invoice:
      'e.g. "Invoice for Jones roofing job. Labour £1200, materials £850, skip hire £150. Total £2200. Payment due 30 days."',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40 p-4">
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Paste {documentType === 'quote' ? 'Quote' : documentType === 'order' ? 'Order' : 'Invoice'} Details</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Info banner */}
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
          <p className="text-xs text-blue-700 leading-relaxed">
            Write or copy and paste your {documentType} details here. AI will structure the text
            into professional line items with quantities, units, and rates — ready for your {documentType}.
          </p>
        </div>

        {/* Quota indicator */}
        {quota && !quota.unlimited && (
          <div className={`rounded-lg border px-3 py-2 text-xs ${
            quota.remaining === 0
              ? 'bg-red-50 border-red-200 text-red-700'
              : quota.remaining <= 5
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            {quota.remaining === 0
              ? `AI parse limit reached (${quota.limit}/mo). Resets next billing period.`
              : `${quota.remaining} of ${quota.limit} AI parses remaining this month.`}
          </div>
        )}
        {quota && quota.unlimited && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Unlimited AI parses included in your plan.
          </div>
        )}

        {/* Success state */}
        {success ? (
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50/50 p-4">
            <svg className="w-5 h-5 text-green-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="text-sm font-medium text-slate-900">Lines added to your {documentType}</p>
              <p className="text-xs text-slate-500 mt-1">Review and edit the lines in your {documentType} editor.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Textarea + paste button */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-600">Enter your {documentType} details</label>
                <button
                  onClick={handlePaste}
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#FF6B35] hover:text-orange-600 transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Paste
                </button>
              </div>
              <textarea
                id="ai-text-prompt-textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none resize-none"
                placeholder={examples[documentType]}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Privacy note */}
            <p className="text-xs text-slate-400">
              Your text is sent to our server for AI processing and is <strong>not stored</strong> after parsing.
            </p>
          </>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          {success ? (
            <button
              onClick={onClose}
              className="px-5 py-2 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800 transition-all"
            >
              Done
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-5 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleParse}
                disabled={loading || !text.trim()}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-full bg-black text-white transition-all hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Parsing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    Parse & Add Lines
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
