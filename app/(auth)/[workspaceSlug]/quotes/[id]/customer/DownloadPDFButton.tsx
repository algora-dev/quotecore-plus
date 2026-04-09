'use client';

import { useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Props {
  quoteNumber: string | number | null;
  customerName: string;
}

export function DownloadPDFButton({ quoteNumber, customerName }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      // Find the quote document container
      const element = document.querySelector('[data-pdf-content]') as HTMLElement;
      if (!element) {
        console.error('[PDF] Could not find element with data-pdf-content attribute');
        alert('Could not find quote content to export. Please refresh and try again.');
        setIsGenerating(false);
        return;
      }

      console.log('[PDF] Found element, generating canvas...');

      // Convert HTML to canvas
      const canvas = await html2canvas(element, {
        scale: 2, // Higher quality
        useCORS: true, // Allow cross-origin images
        logging: true,
        backgroundColor: '#ffffff',
        allowTaint: false,
      });

      console.log('[PDF] Canvas generated, creating PDF...');

      // Calculate PDF dimensions
      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Create PDF
      const pdf = new jsPDF({
        orientation: imgHeight > imgWidth ? 'portrait' : 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

      // Generate filename
      const filename = `Quote-${quoteNumber || 'DRAFT'}-${customerName.replace(/[^a-z0-9]/gi, '_')}.pdf`;
      
      // Download
      console.log('[PDF] Downloading:', filename);
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
