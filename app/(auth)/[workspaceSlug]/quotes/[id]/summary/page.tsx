import { redirect } from 'next/navigation';
import Link from 'next/link';
import { loadQuote, loadQuoteRoofAreas, loadQuoteComponents, loadAllEntriesForQuote, confirmQuote } from '../../actions';
import { loadComponentLibrary } from '../../../components/actions';
import { computeQuoteTotals } from '@/app/lib/pricing/engine';
import { unitForMeasurement } from '@/app/lib/types';
import { ConvertSystemButton } from './ConvertSystemButton';
import { CurrencySelector } from './CurrencySelector';
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



  const mainComps = components.filter(c => c.quote_roof_area_id);
  const extraComps = components.filter(c => !c.quote_roof_area_id);
  const totalRoofSqm = roofAreas.reduce((sum, a) => sum + (a.computed_sqm ?? 0), 0);
  const engineComps = components.map(c => ({
    id: c.id, name: c.name, componentType: c.component_type as 'main' | 'extra',
    measurementType: c.measurement_type as 'area' | 'linear' | 'quantity' | 'fixed', inputMode: c.input_mode as 'final' | 'calculated',
    finalValue: c.final_value ?? undefined, calcRawValue: c.calc_raw_value ?? undefined,
    calcPitchDegrees: c.calc_pitch_degrees ?? undefined, calcPitchFactor: c.calc_pitch_factor ?? undefined,
    wasteType: c.waste_type as 'percent' | 'fixed' | 'none', wastePercent: c.waste_percent, wasteFixed: c.waste_fixed,
    finalQuantity: c.final_quantity ?? undefined, materialRate: c.material_rate, labourRate: c.labour_rate,
    materialCost: c.material_cost, labourCost: c.labour_cost, isRateOverridden: c.is_rate_overridden, isQuantityOverridden: c.is_quantity_overridden,
    isWasteOverridden: c.is_waste_overridden, isPitchOverridden: c.is_pitch_overridden, isCustomerVisible: c.is_customer_visible, pricingUnit: c.pricing_unit ?? undefined,
  }));
  const totals = computeQuoteTotals(engineComps, { materialMarginPct: quote.material_margin_pct, labourMarginPct: quote.labour_margin_pct, taxRate: quote.tax_rate });

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href={`/${workspaceSlug}/quotes`} className="text-sm text-slate-500 hover:text-slate-700">← Back to Quotes</Link>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">{quote.customer_name}</h1>
          {quote.job_name && <p className="text-sm text-slate-500 mt-1">{quote.job_name}</p>}
        </div>
        <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700">
          {quote.status}
        </span>
      </div>

      <div className="flex gap-3 p-4 bg-slate-50 rounded-lg flex-wrap">
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
        <Link href={`/${workspaceSlug}/quotes/${id}/customer-edit`} className="px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]">
          Edit Customer Quote
        </Link>
        <Link href={`/${workspaceSlug}/quotes/${id}/customer`} className="px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]">
          Customer Quote
        </Link>
        <Link href={`/${workspaceSlug}/quotes/${id}/labour`} className="px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]">
          Labour Sheet
        </Link>
      </div>

      <div className="space-y-6">
        {roofAreas.map(area => {
          const areaComps = mainComps.filter(c => c.quote_roof_area_id === area.id);
          return (
            <div key={area.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900 mb-2">{area.label} — {(area.computed_sqm ?? 0).toFixed(1)} m²</h3>
              {areaComps.length > 0 ? (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-slate-500 border-b">
                    <th className="py-1">Component</th><th className="py-1 text-right">Entries</th><th className="py-1 text-right">Total Qty</th>
                    <th className="py-1 text-right">Material</th><th className="py-1 text-right">Labour</th><th className="py-1 text-right">Total</th>
                  </tr></thead>
                  <tbody>{areaComps.map(c => (
                    <tr key={c.id} className="border-b border-slate-100">
                      <td className="py-1.5">{c.name}</td>
                      <td className="py-1.5 text-right">{(entries[c.id] ?? []).length}</td>
                      <td className="py-1.5 text-right">{(c.final_quantity ?? 0).toFixed(1)} {unitForMeasurement(c.measurement_type)}</td>
                      <td className="py-1.5 text-right">{formatCurrency(c.material_cost ?? 0, effectiveCurrency)}</td>
                      <td className="py-1.5 text-right">{formatCurrency(c.labour_cost ?? 0, effectiveCurrency)}</td>
                      <td className="py-1.5 text-right font-medium">{formatCurrency((c.material_cost ?? 0) + (c.labour_cost ?? 0), effectiveCurrency)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : <p className="text-xs text-slate-400">No components</p>}
            </div>
          );
        })}

        {extraComps.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="font-semibold text-slate-900 mb-2">Extras</h3>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 border-b">
                <th className="py-1">Extra</th><th className="py-1 text-right">Entries</th><th className="py-1 text-right">Total Qty</th>
                <th className="py-1 text-right">Material</th><th className="py-1 text-right">Labour</th><th className="py-1 text-right">Total</th>
              </tr></thead>
              <tbody>{extraComps.map(c => (
                <tr key={c.id} className="border-b border-amber-100">
                  <td className="py-1.5">{c.name}</td>
                  <td className="py-1.5 text-right">{(entries[c.id] ?? []).length}</td>
                  <td className="py-1.5 text-right">{(c.final_quantity ?? 0).toFixed(1)}</td>
                  <td className="py-1.5 text-right">{formatCurrency(c.material_cost ?? 0, effectiveCurrency)}</td>
                  <td className="py-1.5 text-right">{formatCurrency(c.labour_cost ?? 0, effectiveCurrency)}</td>
                  <td className="py-1.5 text-right font-medium">{formatCurrency((c.material_cost ?? 0) + (c.labour_cost ?? 0), effectiveCurrency)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        <div className="rounded-xl border border-slate-300 bg-white p-4 space-y-2">
          <div className="flex justify-between text-sm"><span>Total Materials</span><span>{formatCurrency(totals.totalMaterials, effectiveCurrency)}</span></div>
          <div className="flex justify-between text-sm"><span>Total Labour</span><span>{formatCurrency(totals.totalLabour, effectiveCurrency)}</span></div>
          {(totals.materialMargin > 0 || totals.labourMargin > 0) && <div className="flex justify-between text-sm text-slate-500"><span>Margins</span><span>+{formatCurrency(totals.materialMargin + totals.labourMargin, effectiveCurrency)}</span></div>}
          <div className="flex justify-between text-sm border-t pt-2"><span>Subtotal</span><span>{formatCurrency(totals.subtotalWithMargins, effectiveCurrency)}</span></div>
          {totals.tax > 0 && <div className="flex justify-between text-sm"><span>Tax ({quote.tax_rate}%)</span><span>{formatCurrency(totals.tax, effectiveCurrency)}</span></div>}
          <div className="flex justify-between text-lg font-bold border-t pt-2"><span>Grand Total</span><span>{formatCurrency(totals.grandTotal, effectiveCurrency)}</span></div>
        </div>

        {/* Files & Documents */}
        {allFiles.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-900 mb-3">Files & Documents</h3>
            <div className="space-y-2">
              {allFiles.map(file => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg"
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
                      {file.file_type === 'plan' ? 'Roof Plan' : 'Supporting File'} • {(file.file_size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-orange-600 hover:text-blue-800 font-medium"
                  >
                    View →
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
