'use client';

import { useState } from 'react';
import { elementToPdf } from '@/app/lib/pdf/renderPreviewToPdf';

interface Props {
  quoteNumber: string | number | null;
  customerName: string;
}

export function DownloadPDFButton({ quoteNumber, customerName }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      // Capture the SAME on-screen customer-quote preview the customer sees.
      const element = document.querySelector('[data-pdf-content]') as HTMLElement | null;
      if (!element) {
        console.error('[PDF] Could not find element with data-pdf-content attribute');
        alert('Could not find quote content to export. Please refresh and try again.');
        return;
      }

      // Shared helper: oklch/lab color fix, font + image readiness, multi-page
      // A4 slicing. Single download == bulk == on-screen preview.
      const pdf = await elementToPdf(element);

      const filename = `Quote-${quoteNumber || 'DRAFT'}-${customerName.replace(/[^a-z0-9]/gi, '_')}.pdf`;
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
      className="px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isGenerating ? 'Generating PDF...' : 'Download PDF'}
    </button>
  );
}
