'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { QuoteRow, QuoteRoofAreaRow, QuoteComponentRow } from '@/app/lib/types';
import { formatCurrency } from '@/app/lib/currency/currencies';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Props {
  quote: QuoteRow;
  roofAreas: QuoteRoofAreaRow[];
  components: QuoteComponentRow[];
  savedLines: any[];
  workspaceSlug: string;
}

export function LaborSheetPreview({ quote, roofAreas, components, savedLines, workspaceSlug }: Props) {
  const currency = quote.currency || 'NZD';
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Display: only visible lines
  const visibleLines = savedLines.filter(l => l.is_visible);
  
  // Group components by roof area (for fallback display)
  const componentsByArea = components.reduce((acc, comp) => {
    const areaId = comp.quote_roof_area_id || 'extras';
    if (!acc[areaId]) acc[areaId] = [];
    acc[areaId].push(comp);
    return acc;
  }, {} as Record<string, QuoteComponentRow[]>);

  // Total: ALL lines where "Add $" is checked (regardless of visibility)
  const subtotal = savedLines.length > 0
    ? savedLines.filter(l => l.include_in_total).reduce((sum, l) => sum + (l.custom_amount || 0), 0)
    : components.reduce((sum, c) => sum + (c.labour_cost || 0), 0);
  const tax = subtotal * (quote.tax_rate / 100);
  const total = subtotal + tax;
  
  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    try {
      const element = document.querySelector('[data-pdf-content]') as HTMLElement;
      if (!element) {
        console.error('[PDF] Could not find element with data-pdf-content attribute');
        alert('Could not find labor sheet content to export. Please refresh and try again.');
        setIsGenerating(false);
        return;
      }

      console.log('[PDF] Found element, preparing for conversion...');
      
      try {
        const canvas = await html2canvas(element, {
          scale: 1,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          allowTaint: true,
          foreignObjectRendering: false,
          onclone: (clonedDoc) => {
            // Force RGB colors to prevent lab() errors - but DON'T force backgrounds
            const allElements = clonedDoc.querySelectorAll('*');
            allElements.forEach((el: any) => {
              const computed = window.getComputedStyle(el);
              // Only override if current color uses lab/lch
              if (computed.color && (computed.color.includes('lab') || computed.color.includes('lch'))) {
                el.style.color = 'rgb(0, 0, 0)';
              }
              if (computed.borderColor && (computed.borderColor.includes('lab') || computed.borderColor.includes('lch'))) {
                el.style.borderColor = 'rgb(0, 0, 0)';
              }
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
        const pageWidth = 210;
        const pageHeight = 297;
        const printableWidth = pageWidth - (margin * 2);
        const printableHeight = pageHeight - (margin * 2);
        
        // Calculate scaled dimensions
        const imgWidth = printableWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        // Handle multi-page content
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

        const filename = `Labor-Sheet-${quote.quote_number || 'DRAFT'}-${quote.customer_name.replace(/[^a-z0-9]/gi, '_')}.pdf`;
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
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={`/${workspaceSlug}/quotes/${quote.id}/summary`}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>Back
          </Link>
          <button
            onClick={handleDownloadPDF}
            disabled={isGenerating}
            className="px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-black transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? 'Generating PDF...' : 'Download PDF'}
          </button>
        </div>

        {/* Document */}
        <div data-pdf-content className="bg-white rounded-xl border border-black p-12">
          {/* Title */}
          <div className="border-b-2 border-black pb-6 mb-8">
            <h1 className="text-3xl font-bold text-black mb-4">LABOR SHEET</h1>
            <p className="text-lg text-black mb-2">
              Quote #{quote.quote_number || 'DRAFT'}
            </p>
            <p className="text-base text-black mb-2">
              <span className="font-semibold">Client:</span> {quote.customer_name}
            </p>
            {quote.job_name && (
              <p className="text-base text-black">
                <span className="font-semibold">Job:</span> {quote.job_name}
              </p>
            )}
          </div>

          {/* Line Items */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-black mb-3 border-b border-black pb-2">
              Labor Items
            </h2>
            <div className="space-y-2">
              {visibleLines.length > 0 ? (
                visibleLines.map(line => (
                  <div key={line.id} className="flex justify-between py-2 border-b border-black">
                    <div className="flex-1">
                      <p className="text-sm text-black">
                        {line.show_units ? line.custom_text : line.custom_text.split('—')[0].trim()}
                      </p>
                    </div>
                    {line.show_price && (
                      <p className="text-sm font-medium text-black">
                        {formatCurrency(line.custom_amount || 0, currency)}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                // Fallback to components if no saved lines
                components.map(comp => (
                  <div key={comp.id} className="flex justify-between py-2 border-b border-black">
                    <div className="flex-1">
                      <p className="text-sm text-black">
                        {comp.name} (Labor)
                      </p>
                    </div>
                    <p className="text-sm font-medium text-black">
                      {formatCurrency(comp.labour_cost || 0, currency)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t border-black pt-6 mt-8">
            <div className="space-y-2">
              <div className="flex justify-between text-base">
                <span className="text-black">Subtotal (Labor)</span>
                <span className="font-medium text-black">{formatCurrency(subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-base">
                <span className="text-black">Tax ({quote.tax_rate}%)</span>
                <span className="font-medium text-black">{formatCurrency(tax, currency)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold border-t border-black pt-3 mt-3">
                <span className="text-black">Total</span>
                <span className="text-black">{formatCurrency(total, currency)}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
