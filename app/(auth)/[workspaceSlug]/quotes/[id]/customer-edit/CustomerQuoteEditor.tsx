'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { QuoteRow, QuoteRoofAreaRow, QuoteComponentRow, CustomerQuoteTemplateRow } from '@/app/lib/types';
import { QuotePreview } from './QuotePreview';
import { AddCustomLineModal } from './AddCustomLineModal';
import { EditHeaderModal } from './EditHeaderModal';
import { EditFooterModal } from './EditFooterModal';
import { saveCustomerQuoteLines, saveCustomerQuoteBranding } from '../../actions';
import { formatCurrency } from '@/app/lib/currency/currencies';
import { createCustomerQuoteTemplate } from '../../../customer-quote-templates/create/build/actions';

interface Props {
  quote: QuoteRow;
  roofAreas: QuoteRoofAreaRow[];
  components: QuoteComponentRow[];
  savedLines: any[];
  templates: CustomerQuoteTemplateRow[];
  workspaceSlug: string;
  currency: string;
  defaultLogoUrl: string | null;
  disableAutoSave?: boolean; // For labor sheet - no persistence
  editorTitle?: string; // Custom title (default: "Customer Quote Editor")
  previewTitle?: string; // Custom preview title (default: "Customer Quote Preview")
  includeMargins?: boolean; // Whether to include margins in line amounts (default: true)
  customSaveAction?: (quoteId: string, lines: any[]) => Promise<void>; // Custom save function (for labor sheet)
}

interface QuoteLine {
  id: string;
  type: 'component' | 'custom';
  componentId?: string;
  roofAreaId?: string;
  text: string;
  amount: number;
  showPrice: boolean;
  showUnits: boolean;
  isVisible: boolean;
  includeInTotal: boolean;
  sortOrder: number;
}

export function CustomerQuoteEditor({ quote, roofAreas, components, savedLines, templates, workspaceSlug, currency, defaultLogoUrl, disableAutoSave = false, editorTitle = "Customer Quote Editor", previewTitle = "Customer Quote Preview", includeMargins = true, customSaveAction }: Props) {
  const router = useRouter();
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showAddCustomLine, setShowAddCustomLine] = useState(false);
  const [showEditHeader, setShowEditHeader] = useState(false);
  const [showEditFooter, setShowEditFooter] = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  
  // Branding state - use uploaded logo if quote doesn't have one yet
  const [companyName, setCompanyName] = useState(quote.cq_company_name || '');
  const [companyAddress, setCompanyAddress] = useState(quote.cq_company_address || '');
  const [companyPhone, setCompanyPhone] = useState(quote.cq_company_phone || '');
  const [companyEmail, setCompanyEmail] = useState(quote.cq_company_email || '');
  const [companyLogoUrl, setCompanyLogoUrl] = useState(quote.cq_company_logo_url || defaultLogoUrl || '');
  const [footerText, setFooterText] = useState(quote.cq_footer_text || '');

  // Initialize lines: use saved lines if available, otherwise from components
  useEffect(() => {
    if (savedLines.length > 0) {
      // Load from saved lines, but ALWAYS rebuild component data from current components
      const loadedLines: QuoteLine[] = savedLines.map(saved => {
        if (saved.line_type === 'component') {
          // Component line: rebuild everything from component data
          const component = components.find(c => c.id === saved.quote_component_id);
          if (!component) return null; // Component was deleted
          
          // Calculate default amount WITH margins applied (if enabled)
          const baseMaterialCost = component.material_cost || 0;
          const baseLabourCost = component.labour_cost || 0;
          const materialMargin = includeMargins && quote.material_margin_enabled && quote.material_margin_percent 
            ? baseMaterialCost * (quote.material_margin_percent / 100) 
            : 0;
          const labourMargin = includeMargins && quote.labor_margin_enabled && quote.labor_margin_percent 
            ? baseLabourCost * (quote.labor_margin_percent / 100) 
            : 0;
          const calculatedAmount = baseMaterialCost + baseLabourCost + materialMargin + labourMargin;
          
          // Use saved custom_amount if it exists AND differs from calculated (user override)
          // Otherwise use calculated amount
          const hasCustomAmount = saved.custom_amount != null && saved.custom_amount !== calculatedAmount;
          const finalAmount = hasCustomAmount ? saved.custom_amount : calculatedAmount;

          return {
            id: component.id,
            type: 'component' as const,
            componentId: component.id,
            roofAreaId: component.quote_roof_area_id || undefined,
            text: generateDefaultText(component),
            amount: finalAmount,
            showPrice: saved.show_price ?? true,
            showUnits: saved.show_units ?? true,
            isVisible: saved.is_visible ?? true,
            includeInTotal: saved.include_in_total ?? true,
            sortOrder: saved.sort_order,
          };
        } else {
          // Custom line: use saved data
          return {
            id: saved.id,
            type: 'custom' as const,
            componentId: undefined,
            roofAreaId: undefined,
            text: saved.custom_text || '',
            amount: saved.custom_amount || 0,
            showPrice: saved.show_price ?? true,
            showUnits: saved.show_units ?? true,
            isVisible: saved.is_visible ?? true,
            includeInTotal: saved.include_in_total ?? true,
            sortOrder: saved.sort_order,
          };
        }
      }).filter(Boolean) as QuoteLine[];
      setLines(loadedLines);
    } else {
      // Initialize from components (first time) - include margins if enabled
      const initialLines: QuoteLine[] = components
        .filter(c => c.is_customer_visible)
        .map((c, idx) => {
          const baseMaterialCost = c.material_cost || 0;
          const baseLabourCost = c.labour_cost || 0;
          const materialMargin = includeMargins && quote.material_margin_enabled && quote.material_margin_percent 
            ? baseMaterialCost * (quote.material_margin_percent / 100) 
            : 0;
          const labourMargin = includeMargins && quote.labor_margin_enabled && quote.labor_margin_percent 
            ? baseLabourCost * (quote.labor_margin_percent / 100) 
            : 0;
          const amountWithMargins = baseMaterialCost + baseLabourCost + materialMargin + labourMargin;

          return {
            id: c.id,
            type: 'component' as const,
            componentId: c.id,
            roofAreaId: c.quote_roof_area_id || undefined,
            text: generateDefaultText(c),
            amount: amountWithMargins,
            showPrice: true,
            showUnits: true,
            isVisible: true,
            includeInTotal: true,
            sortOrder: idx,
          };
        });
      setLines(initialLines);
    }
  }, [savedLines, components]);

  function generateDefaultText(component: QuoteComponentRow): string {
    const qty = component.final_quantity?.toFixed(1) || '0.0';
    const unit = component.measurement_type === 'area' ? 'm²' : 
                 component.measurement_type === 'lineal' ? 'm' : 'units';
    return `${component.name} — ${qty} ${unit}`;
  }

  function toggleVisibility(lineId: string) {
    setLines(prev => prev.map(l => 
      l.id === lineId ? { ...l, isVisible: !l.isVisible } : l
    ));
    setIsDirty(true);
  }

  function toggleShowPrice(lineId: string) {
    setLines(prev => prev.map(l => 
      l.id === lineId ? { ...l, showPrice: !l.showPrice } : l
    ));
    setIsDirty(true);
  }

  function toggleIncludeInTotal(lineId: string) {
    setLines(prev => prev.map(l => 
      l.id === lineId ? { ...l, includeInTotal: !l.includeInTotal } : l
    ));
    setIsDirty(true);
  }

  function toggleShowUnits(lineId: string) {
    setLines(prev => prev.map(l => 
      l.id === lineId ? { ...l, showUnits: !l.showUnits } : l
    ));
    setIsDirty(true);
  }

  function moveUp(lineId: string) {
    setLines(prev => {
      const idx = prev.findIndex(l => l.id === lineId);
      if (idx <= 0) return prev;
      const newLines = [...prev];
      [newLines[idx - 1], newLines[idx]] = [newLines[idx], newLines[idx - 1]];
      return newLines.map((l, i) => ({ ...l, sortOrder: i }));
    });
    setIsDirty(true);
  }

  function moveDown(lineId: string) {
    setLines(prev => {
      const idx = prev.findIndex(l => l.id === lineId);
      if (idx === -1 || idx >= prev.length - 1) return prev;
      const newLines = [...prev];
      [newLines[idx], newLines[idx + 1]] = [newLines[idx + 1], newLines[idx]];
      return newLines.map((l, i) => ({ ...l, sortOrder: i }));
    });
    setIsDirty(true);
  }

  function addCustomLine(text: string, amount: number, showPrice: boolean) {
    const newLine: QuoteLine = {
      id: `custom-${Date.now()}`,
      type: 'custom',
      text,
      amount,
      showPrice,
      showUnits: true,
      isVisible: true,
      includeInTotal: true,
      sortOrder: lines.length,
    };
    setLines(prev => [...prev, newLine]);
    setIsDirty(true);
  }

  function updateLine(lineId: string, text: string, amount: number, showPrice: boolean) {
    setLines(prev => prev.map(l => 
      l.id === lineId ? { ...l, text, amount, showPrice } : l
    ));
    setEditingLineId(null);
    setIsDirty(true);
  }

  function applyTemplate(templateId: string) {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    // Apply branding from template
    setCompanyName(template.company_name || '');
    setCompanyAddress(template.company_address || '');
    setCompanyPhone(template.company_phone || '');
    setCompanyEmail(template.company_email || '');
    setCompanyLogoUrl(template.company_logo_url || defaultLogoUrl || '');
    setFooterText(template.footer_text || '');
    
    setIsDirty(true);
  }

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const lineData = lines.map(line => ({
        id: line.id,
        lineType: line.type,
        componentId: line.componentId,
        text: line.text,
        amount: line.amount,
        showPrice: line.showPrice,
        showUnits: line.showUnits,
        sortOrder: line.sortOrder,
        isVisible: line.isVisible,
        includeInTotal: line.includeInTotal,
      }));

      // Use custom save action if provided (for labor sheet), otherwise use default
      const saveLineAction = customSaveAction || saveCustomerQuoteLines;

      await Promise.all([
        saveLineAction(quote.id, lineData),
        saveCustomerQuoteBranding(quote.id, {
          companyName,
          companyAddress,
          companyPhone,
          companyEmail,
          companyLogoUrl,
          footerText,
        }),
      ]);
      setLastSaved(new Date());
      setIsDirty(false);
    } catch (err) {
      console.error('Failed to save:', err);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [quote.id, lines, companyName, companyAddress, companyPhone, companyEmail, companyLogoUrl, footerText, customSaveAction]);

  // Auto-save removed per user request

  // Group lines by roof area
  const linesByArea = lines.reduce((acc, line) => {
    const areaId = line.roofAreaId || 'extras';
    if (!acc[areaId]) acc[areaId] = [];
    acc[areaId].push(line);
    return acc;
  }, {} as Record<string, QuoteLine[]>);

  const visibleLines = lines.filter(l => l.isVisible);
  const subtotal = lines.filter(l => l.includeInTotal).reduce((sum, l) => sum + l.amount, 0); // Only include items with "Add $" checked
  const tax = subtotal * (quote.tax_rate / 100);
  const total = subtotal + tax;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link
              href={`/${workspaceSlug}/quotes/${quote.id}/summary`}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>Back
            </Link>
            <h1 className="text-2xl font-semibold text-slate-900 mt-1">
              {editorTitle} — Quote #{quote.quote_number || 'Draft'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {templates.length > 0 && (
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    applyTemplate(e.target.value);
                    e.target.value = '';
                  }
                }}
                data-copilot="cl-template-dropdown"
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Load Template...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            )}
            <div className="text-sm text-slate-500">
              {saving ? 'Saving...' : lastSaved ? `Last saved ${lastSaved.toLocaleTimeString()}` : 'Not saved yet'}
              {isDirty && !saving && ' (unsaved changes)'}
            </div>
          </div>
        </div>

        {/* Two-panel layout */}
        <div className="grid grid-cols-2 gap-6">
          {/* Left Panel: Component Selection */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4" data-copilot="cl-left-panel">
            <h2 className="text-lg font-semibold text-slate-900">Components & Items</h2>
            
            <div className="space-y-4">
              {/* Grouped by roof areas */}
              {roofAreas.map(area => {
                const areaLines = linesByArea[area.id] || [];
                if (areaLines.length === 0) return null;
                return (
                  <div key={area.id} className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-700 px-2">{area.label}</h3>
                    {areaLines.map(line => (
                      <div
                        key={line.id}
                        className={`px-2 py-1.5 rounded-lg border ${
                          line.isVisible ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className={`text-sm ${line.isVisible ? 'text-slate-900' : 'text-slate-400'}`}>
                                {line.text}
                              </p>
                              <p className={`text-sm font-medium ${line.isVisible ? 'text-slate-700' : 'text-slate-400'}`}>
                                {formatCurrency(line.amount, currency)}
                              </p>
                            </div>
                            {/* Horizontal checkbox row - directly below component details */}
                            <div className="flex items-center gap-4 mt-1">
                              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={line.isVisible}
                                  onChange={() => toggleVisibility(line.id)}
                                  className="toggle-dot"
                                />
                                Show
                              </label>
                              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={line.showPrice}
                                  onChange={() => toggleShowPrice(line.id)}
                                  disabled={!line.isVisible}
                                  className="toggle-dot"
                                />
                                Price
                              </label>
                              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={line.showUnits}
                                  onChange={() => toggleShowUnits(line.id)}
                                  disabled={!line.isVisible}
                                  className="toggle-dot"
                                />
                                Units
                              </label>
                              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={line.includeInTotal}
                                  onChange={() => toggleIncludeInTotal(line.id)}
                                  className="toggle-dot"
                                />
                                Add $
                              </label>
                            </div>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => moveUp(line.id)}
                              className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                              disabled={line.sortOrder === 0}
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => moveDown(line.id)}
                              className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                              disabled={line.sortOrder === lines.length - 1}
                            >
                              ↓
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Extras / ungrouped */}
              {linesByArea['extras'] && linesByArea['extras'].length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-700 px-2">Extras & Custom</h3>
                  {linesByArea['extras'].map(line => (
                    <div
                      key={line.id}
                      className={`px-2 py-1.5 rounded-lg border ${
                        line.isVisible ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className={`text-sm ${line.isVisible ? 'text-slate-900' : 'text-slate-400'}`}>
                              {line.text}
                            </p>
                            <p className={`text-sm font-medium ${line.isVisible ? 'text-slate-700' : 'text-slate-400'}`}>
                              {formatCurrency(line.amount, currency)}
                            </p>
                          </div>
                          {/* Horizontal checkbox row - directly below component details */}
                          <div className="flex items-center gap-4 mt-1">
                            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={line.isVisible}
                                onChange={() => toggleVisibility(line.id)}
                                className="toggle-dot"
                              />
                              Show
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={line.showPrice}
                                onChange={() => toggleShowPrice(line.id)}
                                disabled={!line.isVisible}
                                className="toggle-dot"
                              />
                              Price
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={line.showUnits}
                                onChange={() => toggleShowUnits(line.id)}
                                disabled={!line.isVisible}
                                className="toggle-dot"
                              />
                              Units
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={line.includeInTotal}
                                onChange={() => toggleIncludeInTotal(line.id)}
                                className="toggle-dot"
                              />
                              Add $
                            </label>
                          </div>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => moveUp(line.id)}
                            className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                            disabled={line.sortOrder === 0}
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveDown(line.id)}
                            className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                            disabled={line.sortOrder === lines.length - 1}
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button 
              onClick={() => setShowAddCustomLine(true)}
              className="w-full py-2 text-sm text-orange-600 border border-blue-200 rounded-full hover:bg-blue-50"
            >
              + Add Custom Line
            </button>

            <div className="pt-4 border-t space-y-2">
              <p className="text-xs text-slate-500">
                {saving ? 'Saving...' : lastSaved ? `Auto-saved ${Math.floor((Date.now() - lastSaved.getTime()) / 1000)}s ago` : 'Not saved yet'}
              </p>
              <button 
                onClick={async () => {
                  await handleSave();
                  router.push(`/${workspaceSlug}/quotes/${quote.id}/summary`);
                }}
                disabled={saving}
                data-copilot="cl-save-return"
                className="w-full py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 disabled:opacity-50 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
              >
                {saving ? 'Saving...' : 'Save & Return to Summary'}
              </button>
              <button 
                onClick={async () => {
                  const name = prompt('Template name:', `${quote.customer_name} - Branding Template`);
                  if (!name) return;
                  
                  try {
                    await createCustomerQuoteTemplate({
                      name,
                      companyName,
                      companyAddress,
                      companyPhone,
                      companyEmail,
                      footerText,
                      companyLogoUrl: companyLogoUrl || null,
                    });
                    alert(`Template "${name}" saved successfully!`);
                  } catch (error) {
                    alert('Failed to save template: ' + (error as Error).message);
                  }
                }}
                className="w-full py-2 text-sm font-medium border border-slate-300 text-slate-700 rounded-full hover:bg-slate-50"
              >
                Save Branding as Template
              </button>
            </div>
          </div>

          {/* Right Panel: Live Preview */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4" data-copilot="cl-right-panel">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">{previewTitle}</h2>
              <button
                onClick={() => setShowPreviewModal(true)}
                className="px-3 py-1.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-full hover:bg-slate-50"
              >
                Preview Full Size
              </button>
            </div>
            
            <div className="border-t pt-4">
              <QuotePreview
                quote={quote}
                lines={visibleLines}
                subtotal={subtotal}
                tax={tax}
                total={total}
                companyName={companyName}
                companyAddress={companyAddress}
                companyPhone={companyPhone}
                companyEmail={companyEmail}
                companyLogoUrl={companyLogoUrl}
                footerText={footerText}
                editingLineId={editingLineId}
                onEditLine={setEditingLineId}
                onSaveLine={updateLine}
                onCancelEdit={() => setEditingLineId(null)}
                onEditHeader={() => setShowEditHeader(true)}
                onEditFooter={() => setShowEditFooter(true)}
                currency={currency}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Full-size Preview Modal */}
      {showPreviewModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
          onClick={() => setShowPreviewModal(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Full Size Preview</h2>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-8 pt-12">
              <QuotePreview
                quote={quote}
                lines={visibleLines}
                subtotal={subtotal}
                tax={tax}
                total={total}
                companyName={companyName}
                companyAddress={companyAddress}
                companyPhone={companyPhone}
                companyEmail={companyEmail}
                companyLogoUrl={companyLogoUrl}
                footerText={footerText}
                showEditButtons={false}
                currency={currency}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Header Modal */}
      {showEditHeader && (
        <EditHeaderModal
          companyName={companyName}
          companyAddress={companyAddress}
          companyPhone={companyPhone}
          companyEmail={companyEmail}
          companyLogoUrl={companyLogoUrl}
          onSave={(data) => {
            setCompanyName(data.companyName);
            setCompanyAddress(data.companyAddress);
            setCompanyPhone(data.companyPhone);
            setCompanyEmail(data.companyEmail);
            setCompanyLogoUrl(data.companyLogoUrl);
            setIsDirty(true);
            setShowEditHeader(false);
          }}
          onCancel={() => setShowEditHeader(false)}
        />
      )}

      {/* Edit Footer Modal */}
      {showEditFooter && (
        <EditFooterModal
          footerText={footerText}
          onSave={(text) => {
            setFooterText(text);
            setIsDirty(true);
            setShowEditFooter(false);
          }}
          onCancel={() => setShowEditFooter(false)}
        />
      )}

      {/* Add Custom Line Modal */}
      {showAddCustomLine && (
        <AddCustomLineModal
          onAdd={addCustomLine}
          onClose={() => setShowAddCustomLine(false)}
        />
      )}
    </div>
  );
}
