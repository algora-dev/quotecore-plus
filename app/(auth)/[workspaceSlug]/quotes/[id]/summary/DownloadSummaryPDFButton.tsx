'use client';

import { useState } from 'react';
import { elementToPdf } from '@/app/lib/pdf/renderPreviewToPdf';

interface Props {
  quoteNumber: string | number | null;
  customerName: string;
}

export function DownloadSummaryPDFButton({ quoteNumber, customerName }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      const element = document.querySelector('[data-pdf-content]') as HTMLElement | null;
      if (!element) {
        console.error('[PDF] Could not find element with data-pdf-content attribute');
        alert('Could not find summary content to export. Please refresh and try again.');
        return;
      }

      // Shared helper: oklch/lab color fix, font + image readiness, multi-page
      // A4 slicing. Single download == bulk == on-screen preview.
      const pdf = await elementToPdf(element);

      const filename = `Master-Quote-${quoteNumber || 'DRAFT'}-${customerName.replace(/[^a-z0-9]/gi, '_')}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error('[PDF] Generation failed:', error);
      alert(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isGenerating}
      title="Download PDF"
      className="icon-btn border-slate-300 bg-white"
    >
      {isGenerating ? (
        <svg className="w-4 h-4 text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
      ) : (
        <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      )}
    </button>
  );
}
