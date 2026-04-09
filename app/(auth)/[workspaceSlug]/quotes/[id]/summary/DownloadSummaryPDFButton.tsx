'use client';

import { useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Props {
  quoteNumber: string | number | null;
  customerName: string;
}

export function DownloadSummaryPDFButton({ quoteNumber, customerName }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      // Find the summary content container
      const element = document.querySelector('[data-pdf-content]') as HTMLElement;
      if (!element) {
        console.error('[PDF] Could not find element with data-pdf-content attribute');
        alert('Could not find summary content to export. Please refresh and try again.');
        setIsGenerating(false);
        return;
      }

      console.log('[PDF] Found element, preparing conversion...');

      try {
        const canvas = await html2canvas(element, {
          scale: 1, // Reduced for smaller file size
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          allowTaint: true,
          foreignObjectRendering: false,
          ignoreElements: (el) => {
            return el.classList?.contains('data-exclude-pdf');
          },
          onclone: (clonedDoc) => {
            const allElements = clonedDoc.querySelectorAll('*');
            allElements.forEach((el: any) => {
              el.style.color = 'rgb(0, 0, 0)';
              el.style.backgroundColor = 'rgb(255, 255, 255)';
              el.style.borderColor = 'rgb(203, 213, 225)';
            });
          },
        });

        console.log('[PDF] Canvas generated, creating PDF...');

        // Create PDF with proper margins
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });

        const imgData = canvas.toDataURL('image/png');
        
        // Add margins (15mm on all sides)
        const margin = 15;
        const pageWidth = 210; // A4 width
        const pageHeight = 297; // A4 height
        const printableWidth = pageWidth - (margin * 2);
        const printableHeight = pageHeight - (margin * 2);
        
        // Calculate scaled dimensions to fit within printable area
        const imgWidth = printableWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        // If content is taller than one page, add multiple pages
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', margin, margin + position, imgWidth, imgHeight);
        heightLeft -= printableHeight;

        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', margin, margin + position, imgWidth, imgHeight);
          heightLeft -= printableHeight;
        }

        // Generate filename
        const filename = `Master-Quote-${quoteNumber || 'DRAFT'}-${customerName.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        
        // Download
        console.log('[PDF] Downloading:', filename);
        pdf.save(filename);
      } catch (error) {
        console.error('[PDF] Generation failed:', error);
        alert(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsGenerating(false);
      }
    } catch (error) {
      console.error('[PDF] Setup failed:', error);
      alert('Failed to prepare PDF. Please try again.');
      setIsGenerating(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isGenerating}
      className="px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isGenerating ? 'Generating PDF...' : 'Download Master Quote PDF'}
    </button>
  );
}
