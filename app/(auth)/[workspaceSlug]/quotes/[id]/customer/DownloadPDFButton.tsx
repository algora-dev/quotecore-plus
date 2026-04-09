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

      console.log('[PDF] Found element, preparing for conversion...');

      // Clone element to avoid modifying the original
      const clone = element.cloneNode(true) as HTMLElement;
      
      // Recursively force RGB colors on all elements to avoid lab() errors
      function forceRGBColors(el: HTMLElement) {
        el.style.color = 'rgb(0, 0, 0)';
        el.style.backgroundColor = 'rgb(255, 255, 255)';
        el.style.borderColor = 'rgb(0, 0, 0)';
        
        // Process all children
        Array.from(el.children).forEach(child => {
          if (child instanceof HTMLElement) {
            forceRGBColors(child);
          }
        });
      }
      
      forceRGBColors(clone);
      
      // Temporarily append clone off-screen
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      document.body.appendChild(clone);

      try {
        // Convert HTML to canvas
        const canvas = await html2canvas(clone, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          allowTaint: false,
        });

        // Remove clone
        document.body.removeChild(clone);

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
      } catch (conversionError) {
        // Remove clone if conversion failed
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
      {isGenerating ? 'Generating PDF...' : 'Download PDF'}
    </button>
  );
}
