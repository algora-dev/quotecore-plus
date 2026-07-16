'use client';

import { useState } from 'react';
import { useFreeToolsAuth } from '../_components/FreeToolsAuthProvider';

interface PromptBoxProps {
  onParsed: (data: ParsedPromptResult) => void;
  onError: (message: string) => void;
  documentType: 'quote' | 'order' | 'invoice';
}

export interface ParsedPromptResult {
  companyName: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  quoteDate: string;
  validDays: string;
  notes: string;
  lines: { description: string; qty: number; unit: string; rate: number }[];
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
  remaining: number;
}

export function PromptBox({ onParsed, onError, documentType }: PromptBoxProps) {
  const { accessToken } = useFreeToolsAuth();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  async function handleParse() {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/free-tools/parse-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
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

      const data: ParsedPromptResult = await res.json();
      onParsed(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      onError(message);
    } finally {
      setLoading(false);
    }
  }

  const examples: Record<string, string> = {
    quote: 'e.g. "New roof for Mr Smith, 123 Oak Street. Strip existing tiles, install new underlay, 120m² of concrete tiles at £35/m², ridge tiles 15m at £25/m, labour 3 days at £200/day. Valid 30 days."',
    order: 'e.g. "From ABC Supplies: 200 concrete tiles, 4 rolls underlay, 15m ridge, 5kg nails, delivery Tuesday"',
    invoice: 'e.g. "Invoice for Jones roofing job. Labour £1200, materials £850, skip hire £150. Total £2200. Payment due 30 days."',
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-900">Or paste your text</h2>
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="text-xs font-medium text-slate-500 hover:text-[#FF6B35] transition"
          >
            Show
          </button>
        )}
      </div>

      {!collapsed && (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            placeholder={examples[documentType]}
          />
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Paste your {documentType} details - AI will structure it into line items. Your text is sent to our server for processing and is not stored.
            </p>
            <button
              onClick={handleParse}
              disabled={loading || !text.trim()}
              className="inline-flex items-center gap-1.5 rounded-full bg-black px-4 py-2 text-xs font-semibold text-white transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
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
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Parse text
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
