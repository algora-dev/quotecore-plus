import { redirect } from 'next/navigation';
import Link from 'next/link';
import { loadQuote, loadQuoteRoofAreas, loadQuoteComponents, loadAllEntriesForQuote, confirmQuote } from '../../actions';
import { loadComponentLibrary } from '../../../components/actions';
import { computeQuoteTotals } from '@/app/lib/pricing/engine';
import { unitForMeasurement } from '@/app/lib/types';
import { ConvertSystemButton } from './ConvertSystemButton';
import { CurrencySelector } from './CurrencySelector';
import { DownloadSummaryPDFButton } from './DownloadSummaryPDFButton';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { formatCurrency, getEffectiveCurrency } from '@/app/lib/currency/currencies';

export default async function QuoteSummaryPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const { workspaceSlug, id } = await params;
  const [quote, roofAreas, components, entries] = await Promise.all([
    loadQuote(id),
    loadQuoteRoofAreas(id),
    loadQuoteComponents(id),
    loadAllEntriesForQuote(id),
  ]);
  
  const supabase = await createSupabaseServerClient();
  
  // Load ALL customer quote lines (for overrides + custom lines)
  const { data: allCustomerLines } = await supabase
    .from('customer_quote_lines')
    .select('*')
    .eq('quote_id', id)
    .order('sort_order', { ascending: true });
  
  // Separate custom lines
  const customLines = (allCustomerLines || []).filter(
    line => line.line_type === 'custom' && line.is_visible && line.include_in_total
  );
  
  // Build component override map (componentId -> custom_amount)
  const componentOverrides = new Map<string, number>();
  (allCustomerLines || []).forEach(line => {
    if (line.line_type === 'component' && line.quote_component_id && line.custom_amount != null) {
      componentOverrides.set(line.quote_component_id, line.custom_amount);
    }
  });
  
  // Load company default currency
  const { data: company } = await supabase
    .from('companies')
    .select('default_currency')
    .eq('id', quote.company_id)
    .single();
  const companyDefaultCurrency = company?.default_currency || 'NZD';
  const effectiveCurrency = getEffectiveCurrency(quote.currency, companyDefaultCurrency);
  
  // Load all files (plan + supporting)
  const { data: filesData } = await supabase
    .from('quote_files')
    .select('id, file_type, file_name, file_size, storage_path, uploaded_at')
    .eq('quote_id', id)
    .order('uploaded_at', { ascending: false });
  
  const planFile = filesData?.find(f => f.file_type === 'plan');
  const supportingFiles = filesData?.filter(f => f.file_type === 'supporting') || [];
  
  const allFiles = filesData?.map(file => {
    const { data: urlData } = supabase.storage
      .from('QUOTE-DOCUMENTS')
      .getPublicUrl(file.storage_path);
    return {
      ...file,
      url: urlData.publicUrl,
    };
  }) || [];
  
  // Add canvas image if it exists
  if (quote.takeoff_canvas_url) {
    allFiles.push({
      id: 'canvas-image',
      file_type: 'canvas' as any,
      file_name: 'Digital Takeoff Canvas',
      file_size: 0, // Unknown size
      storage_path: '',
      uploaded_at: quote.updated_at,
      url: quote.takeoff_canvas_url,
    });
  }



  const totalRoofSqm = roofAreas.reduce((sum, a) => sum + (a.computed_sqm ?? 0), 0);
  
  // Apply customer quote line overrides to component costs
  const componentsWithOverrides = components.map(c => {
    const override = componentOverrides.get(c.id);
    if (override !== undefined) {
      // Override exists - recalculate material/labour split while preserving total
      const totalCost = c.material_cost + c.labour_cost;
      const ratio = totalCost > 0 ? c.material_cost / totalCost : 0.5;
      return {
        ...c,
        material_cost: override * ratio,
        labour_cost: override * (1 - ratio),
      };
    }
    return c;
  });
  
  const mainComps = componentsWithOverrides.filter(c => c.quote_roof_area_id);
  const extraComps = componentsWithOverrides.filter(c => !c.quote_roof_area_id);
  
  const engineComps = componentsWithOverrides.map(c => ({
    id: c.id, name: c.name, componentType: c.component_type as 'main' | 'extra',
    measurementType: c.measurement_type as 'area' | 'linear' | 'quantity' | 'fixed', inputMode: c.input_mode as 'final' | 'calculated',
    finalValue: c.final_value ?? undefined, calcRawValue: c.calc_raw_value ?? undefined,
    calcPitchDegrees: c.calc_pitch_degrees ?? undefined, calcPitchFactor: c.calc_pitch_factor ?? undefined,
    wasteType: c.waste_type as 'percent' | 'fixed' | 'none', wastePercent: c.waste_percent, wasteFixed: c.waste_fixed,
    finalQuantity: c.final_quantity ?? undefined, materialRate: c.material_rate, labourRate: c.labour_rate,
    materialCost: c.material_cost, labourCost: c.labour_cost, isRateOverridden: c.is_rate_overridden, isQuantityOverridden: c.is_quantity_overridden,
    isWasteOverridden: c.is_waste_overridden, isPitchOverridden: c.is_pitch_overridden, isCustomerVisible: c.is_customer_visible, pricingUnit: c.pricing_unit ?? undefined,
  }));
  const totals = computeQuoteTotals(engineComps, { materialMarginPct: quote.material_margin_percent ?? 0, labourMarginPct: quote.labor_margin_percent ?? 0, taxRate: quote.tax_rate });
  
  // Calculate custom lines total
  const customLinesTotal = (customLines || []).reduce((sum, line) => sum + (line.custom_amount || 0), 0);
  
  // Adjust totals to include custom lines
  const adjustedSubtotal = totals.subtotalWithMargins + customLinesTotal;
  const adjustedTax = adjustedSubtotal * (quote.tax_rate / 100);
  const adjustedGrandTotal = adjustedSubtotal + adjustedTax;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href={`/${workspaceSlug}/quotes`} className="text-sm text-slate-500 hover:text-slate-700">← Back to Quotes</Link>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">{quote.customer_name}</h1>
          {quote.job_name && <p className="text-sm text-slate-500 mt-1">{quote.job_name}</p>}
        </div>
        <div className="flex items-center gap-3">
          <DownloadSummaryPDFButton 
            quoteNumber={quote.quote_number}
            customerName={quote.customer_name}
          />
          <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700">
            {quote.status}
          </span>
        </div>
      </div>

      <div className="flex gap-3 p-4 bg-slate-50 rounded-full flex-wrap data-exclude-pdf">
        {quote.status === 'draft' && (
          <>
            <ConvertSystemButton quoteId={id} currentSystem={quote.measurement_system} workspaceSlug={workspaceSlug} />
            <CurrencySelector 
              quoteId={id} 
              currentCurrency={quote.currency} 
              companyDefaultCurrency={companyDefaultCurrency}
              workspaceSlug={workspaceSlug} 
            />
          </>
        )}
        <Link href={`/${workspaceSlug}/quotes/${id}`} className="px-4 py-2 text-sm font-medium rounded-full border-2 border-slate-300 bg-white pill-shimmer">
          Edit Quote
        </Link>
        <form action={async () => {
          'use server';
          const { cloneQuote } = await import('../../actions');
          const newId = await cloneQuote(id, quote.customer_name + ' (Copy)');
          redirect(`/${workspaceSlug}/quotes/${newId}`);
        }}>
          <button type="submit" className="px-4 py-2 text-sm font-medium rounded-full border-2 border-slate-300 bg-white pill-shimmer">
            Clone Quote
          </button>
        </form>
        <Link href={`/${workspaceSlug}/quotes/${id}/customer-edit`} className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 bg-white pill-shimmer">
          Edit Customer Quote
        </Link>
        <Link href={`/${workspaceSlug}/quotes/${id}/customer`} className="px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]">
          Customer Quote
        </Link>
        <Link href={`/${workspaceSlug}/quotes/${id}/labor-sheet`} className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 bg-white pill-shimmer">
          Edit Labor Sheet
        </Link>
        <Link href={`/${workspaceSlug}/quotes/${id}/labor`} className="px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]">
          Labor Sheet
        </Link>
      </div>

      <div data-pdf-content className="p-12 bg-white">
        {/* PDF Header */}
        <div className="mb-8 pb-4 border-b border-slate-200">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">
            Quote #{quote.quote_number || 'DRAFT'} — Summary
          </h1>
          <p className="text-base text-slate-700 mb-2">{quote.customer_name}</p>
          {quote.job_name && <p className="text-sm text-slate-500 mb-2">{quote.job_name}</p>}
        </div>

      <div className="space-y-10">
        {roofAreas.map(area => {
          const areaComps = mainComps.filter(c => c.quote_roof_area_id === area.id);
          return (
            <div key={area.id}>
              <h3 className="font-semibold text-slate-900 mb-4">{area.label} — {(area.computed_sqm ?? 0).toFixed(1)} m²</h3>
              {areaComps.length > 0 ? (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-300">
                    <th className="pb-2 font-medium">Component</th><th className="pb-2 text-right font-medium">Entries</th><th className="pb-2 text-right font-medium">Total Qty</th>
                    <th className="pb-2 text-right font-medium">Material</th><th className="pb-2 text-right font-medium">Labour</th><th className="pb-2 text-right font-medium">Total</th>
                  </tr></thead>
                  <tbody>{areaComps.map(c => (
                    <tr key={c.id} className="border-b border-slate-100">
                      <td className="py-3">{c.name}</td>
                      <td className="py-3 text-right">{(entries[c.id] ?? []).length}</td>
                      <td className="py-3 text-right">{(c.final_quantity ?? 0).toFixed(1)} {unitForMeasurement(c.measurement_type)}</td>
                      <td className="py-3 text-right">{formatCurrency(c.material_cost ?? 0, effectiveCurrency)}</td>
                      <td className="py-3 text-right">{formatCurrency(c.labour_cost ?? 0, effectiveCurrency)}</td>
                      <td className="py-3 text-right font-medium">{formatCurrency((c.material_cost ?? 0) + (c.labour_cost ?? 0), effectiveCurrency)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : <p className="text-xs text-slate-400">No components</p>}
            </div>
          );
        })}

        {extraComps.length > 0 && (
          <div>
            <h3 className="font-semibold text-slate-900 mb-4">Extras</h3>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-300">
                <th className="pb-2 font-medium">Extra</th><th className="pb-2 text-right font-medium">Entries</th><th className="pb-2 text-right font-medium">Total Qty</th>
                <th className="pb-2 text-right font-medium">Material</th><th className="pb-2 text-right font-medium">Labour</th><th className="pb-2 text-right font-medium">Total</th>
              </tr></thead>
              <tbody>{extraComps.map(c => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="py-3">{c.name}</td>
                  <td className="py-3 text-right">{(entries[c.id] ?? []).length}</td>
                  <td className="py-3 text-right">{(c.final_quantity ?? 0).toFixed(1)}</td>
                  <td className="py-3 text-right">{formatCurrency(c.material_cost ?? 0, effectiveCurrency)}</td>
                  <td className="py-3 text-right">{formatCurrency(c.labour_cost ?? 0, effectiveCurrency)}</td>
                  <td className="py-3 text-right font-medium">{formatCurrency((c.material_cost ?? 0) + (c.labour_cost ?? 0), effectiveCurrency)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {/* Custom Extra Items */}
        {customLines && customLines.length > 0 && (
          <div>
            <h3 className="font-semibold text-slate-900 mb-4">Custom Extra Items</h3>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-300">
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 text-right font-medium">Amount</th>
              </tr></thead>
              <tbody>{customLines.map(line => (
                <tr key={line.id} className="border-b border-slate-100">
                  <td className="py-3">{line.custom_text}</td>
                  <td className="py-3 text-right font-medium">{formatCurrency(line.custom_amount || 0, effectiveCurrency)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        <div className="pt-6 border-t border-slate-300 space-y-4">
          <div className="flex justify-between text-base"><span className="text-slate-900">Total Materials</span><span className="text-slate-900 text-right">{formatCurrency(totals.totalMaterials, effectiveCurrency)}</span></div>
          <div className="flex justify-between text-base"><span className="text-slate-900">Total Labour</span><span className="text-slate-900 text-right">{formatCurrency(totals.totalLabour, effectiveCurrency)}</span></div>
          {(totals.materialMargin > 0 || totals.labourMargin > 0) && <div className="flex justify-between text-base text-slate-500"><span>Margins</span><span className="text-right">+{formatCurrency(totals.materialMargin + totals.labourMargin, effectiveCurrency)}</span></div>}
          {customLinesTotal > 0 && <div className="flex justify-between text-base"><span className="text-slate-900">Custom Items</span><span className="text-slate-900 text-right">{formatCurrency(customLinesTotal, effectiveCurrency)}</span></div>}
          <div className="flex justify-between text-base border-t border-slate-300 pt-4"><span className="text-slate-900">Subtotal</span><span className="text-slate-900 text-right">{formatCurrency(adjustedSubtotal, effectiveCurrency)}</span></div>
          {adjustedTax > 0 && <div className="flex justify-between text-base"><span className="text-slate-900">Tax ({quote.tax_rate}%)</span><span className="text-slate-900 text-right">{formatCurrency(adjustedTax, effectiveCurrency)}</span></div>}
          <div className="flex justify-between text-xl font-bold border-t border-slate-300 pt-4"><span className="text-slate-900">Grand Total</span><span className="text-slate-900 text-right">{formatCurrency(adjustedGrandTotal, effectiveCurrency)}</span></div>
        </div>

        {/* Files & Documents */}
        {allFiles.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 data-exclude-pdf">
            <h3 className="font-semibold text-slate-900 mb-3">Files & Documents</h3>
            <div className="space-y-2">
              {allFiles.map(file => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-full"
                >
                  <div className="flex-shrink-0">
                    {file.file_name.toLowerCase().endsWith('.pdf') ? (
                      <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                      </svg>
                    ) : (
                      <img
                        src={file.url}
                        alt={file.file_name}
                        className="w-8 h-8 object-cover rounded border border-slate-300"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{file.file_name}</p>
                    <p className="text-xs text-slate-500">
                      {file.file_type === 'plan' ? 'Roof Plan' : file.file_type === 'canvas' ? 'Digital Takeoff' : 'Supporting File'}
                      {file.file_size > 0 && ` • ${(file.file_size / 1024 / 1024).toFixed(2)} MB`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-orange-600 hover:text-orange-800 font-medium"
                    >
                      View →
                    </a>
                    <a
                      href={file.url}
                      download={file.file_name}
                      className="px-3 py-1.5 text-xs font-medium bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
                    >
                      Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
