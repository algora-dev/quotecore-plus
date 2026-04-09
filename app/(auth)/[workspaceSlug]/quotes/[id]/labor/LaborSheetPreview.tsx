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
  workspaceSlug: string;
}

export function LaborSheetPreview({ quote, roofAreas, components, workspaceSlug }: Props) {
  const currency = quote.currency || 'NZD';
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Group components by roof area
  const componentsByArea = components.reduce((acc, comp) => {
    const areaId = comp.quote_roof_area_id || 'extras';
    if (!acc[areaId]) acc[areaId] = [];
    acc[areaId].push(comp);
    return acc;
  }, {} as Record<string, QuoteComponentRow[]>);

  // Calculate totals (labor only)
  const subtotal = components.reduce((sum, c) => sum + (c.labour_cost || 0), 0);
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

      // Inject temporary CSS to override any lab() colors
      const styleId = 'pdf-color-override';
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        [data-pdf-content] * {
          color: rgb(0, 0, 0) !important;
          background-color: rgb(255, 255, 255) !important;
          border-color: rgb(203, 213, 225) !important;
        }
      `;
      document.head.appendChild(style);
      
      try {
        // Wait for styles to apply
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const canvas = await html2canvas(element, {
          scale: 2, // High quality for clear text
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          allowTaint: true,
          foreignObjectRendering: false,
        });
        
        // Remove temporary styles
        document.getElementById(styleId)?.remove();

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
        // Clean up styles even if conversion fails
        document.getElementById(styleId)?.remove();
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
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={`/${workspaceSlug}/quotes/${quote.id}/summary`}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            ← Back to Summary
          </Link>
          <button
            onClick={handleDownloadPDF}
            disabled={isGenerating}
            className="px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? 'Generating PDF...' : 'Download PDF'}
          </button>
        </div>

        {/* Document */}
        <div data-pdf-content className="bg-white rounded-xl border border-slate-200 p-12 shadow-sm">
          {/* Title */}
          <div className="border-b-2 pb-6 mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-4">LABOR SHEET</h1>
            <p className="text-lg text-slate-700 mb-2">
              Quote #{quote.quote_number || 'DRAFT'}
            </p>
            <p className="text-base text-slate-900 mb-2">
              <span className="font-semibold">Client:</span> {quote.customer_name}
            </p>
            {quote.job_name && (
              <p className="text-base text-slate-900">
                <span className="font-semibold">Job:</span> {quote.job_name}
              </p>
            )}
          </div>

          {/* Roof Areas */}
          {roofAreas.map(area => {
            const areaComps = componentsByArea[area.id] || [];
            if (areaComps.length === 0) return null;

            return (
              <div key={area.id} className="mb-8">
                <h2 className="text-lg font-semibold text-slate-900 mb-3 border-b pb-2">
                  {area.label}
                </h2>
                <div className="space-y-2">
                  {areaComps.map(comp => (
                    <div key={comp.id} className="flex justify-between py-2 border-b border-slate-100">
                      <div className="flex-1">
                        <p className="text-sm text-slate-900">
                          {comp.name} (Labor)
                        </p>
                      </div>
                      <p className="text-sm font-medium text-slate-900">
                        {formatCurrency(comp.labour_cost || 0, currency)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Extras */}
          {componentsByArea['extras'] && componentsByArea['extras'].length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-slate-900 mb-3 border-b pb-2">
                Additional Items
              </h2>
              <div className="space-y-2">
                {componentsByArea['extras'].map(comp => (
                  <div key={comp.id} className="flex justify-between py-2 border-b border-slate-100">
                    <div className="flex-1">
                      <p className="text-sm text-slate-900">
                        {comp.name} (Labor)
                      </p>
                    </div>
                    <p className="text-sm font-medium text-slate-900">
                      {formatCurrency(comp.labour_cost || 0, currency)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="border-t pt-6 mt-8">
            <div className="space-y-2">
              <div className="flex justify-between text-base">
                <span className="text-slate-600">Subtotal (Labor)</span>
                <span className="font-medium text-slate-900">{formatCurrency(subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-base">
                <span className="text-slate-600">Tax ({quote.tax_rate}%)</span>
                <span className="font-medium text-slate-900">{formatCurrency(tax, currency)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold border-t pt-3 mt-3">
                <span className="text-slate-900">Total</span>
                <span className="text-slate-900">{formatCurrency(total, currency)}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
