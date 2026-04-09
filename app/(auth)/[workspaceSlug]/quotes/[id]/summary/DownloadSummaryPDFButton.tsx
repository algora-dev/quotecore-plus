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

      console.log('[PDF] Found element, preparing for conversion...');

      // Clone element to avoid modifying the original
      const clone = element.cloneNode(true) as HTMLElement;
      
      // Remove elements marked for exclusion
      const excludeElements = clone.querySelectorAll('.data-exclude-pdf');
      excludeElements.forEach(el => el.remove());
      
      // Recursively force RGB colors on all elements
      function forceRGBColors(el: HTMLElement) {
        el.style.color = 'rgb(0, 0, 0)';
        el.style.backgroundColor = 'rgb(248, 250, 252)'; // slate-50
        el.style.borderColor = 'rgb(0, 0, 0)';
        
        Array.from(el.children).forEach(child => {
          if (child instanceof HTMLElement) {
            forceRGBColors(child);
          }
        });
      }
      
      forceRGBColors(clone);
      
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      document.body.appendChild(clone);

      try {
        // Convert HTML to canvas (reduced quality for smaller file size)
        const canvas = await html2canvas(clone, {
          scale: 1, // Reduced from 2 to 1 for smaller file size
          useCORS: true,
          logging: false,
          backgroundColor: '#f8fafc',
          allowTaint: false,
        });

        document.body.removeChild(clone);

        console.log('[PDF] Canvas generated, creating PDF...');

        // Calculate PDF dimensions
        const imgWidth = 210; // A4 width in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        // Create PDF
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });

        const imgData = canvas.toDataURL('image/png');
        
        // If content is taller than one page, add multiple pages
        let heightLeft = imgHeight;
        let position = 0;
        const pageHeight = 297; // A4 height in mm

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        // Generate filename
        const filename = `Master-Quote-${quoteNumber || 'DRAFT'}-${customerName.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        
        // Download
        console.log('[PDF] Downloading:', filename);
        pdf.save(filename);
      } catch (conversionError) {
        if (document.body.contains(clone)) {
          document.body.removeChild(clone);
        }
        throw conversionError;
      }
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
      {isGenerating ? 'Generating PDF...' : 'Download Master Quote PDF'}
    </button>
  );
}
