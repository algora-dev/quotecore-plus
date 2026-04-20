'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { MaterialOrderTemplateRow, FlashingLibraryRow } from '@/app/lib/types';
import { saveDraftOrder } from './order-actions';
import type { QuoteData } from './quote-loader';
import type { ExistingOrderData } from './order-loader';
import { BackButton } from '@/app/components/BackButton';

interface OrderCreateFormProps {
  templates: MaterialOrderTemplateRow[];
  flashings: FlashingLibraryRow[];
  quoteData?: QuoteData | null;
  existingOrder?: ExistingOrderData | null;
}

interface Variable {
  name: string;
  value: number;
  unit: string;
}

interface LengthEntry {
  length: number;
  multiplier: number;
  variables?: Variable[];
}

interface OrderLineItem {
  id: string;
  componentName: string;
  flashingId?: string;
  flashingImageUrl?: string;
  entryMode: 'single' | 'multiple';
  // Single mode
  quantity: number;
  unit: string;
  // Multiple mode
  lengths?: LengthEntry[];
  lengthUnit?: string;
  // Common
  notes?: string;
  showComponentName: boolean;
  showFlashingImage: boolean;
  showMeasurements: boolean;
}

export function OrderCreateForm({ templates, flashings, quoteData, existingOrder }: OrderCreateFormProps) {
  const router = useRouter();
  
  // Layout state
  const [layoutMode, setLayoutMode] = useState<'single' | 'double'>('single');
  const [headerExpanded, setHeaderExpanded] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Template selection
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  
  // Add item modal
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  
  // Header form state - LEFT
  const [toSupplier, setToSupplier] = useState('');
  const [reference, setReference] = useState('');
  const [orderType, setOrderType] = useState('');
  const [colours, setColours] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  
  // Header form state - RIGHT
  const [logoUrl, setLogoUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [fromCompany, setFromCompany] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactDetails, setContactDetails] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Order line items
  const [orderLines, setOrderLines] = useState<OrderLineItem[]>([]);
  
  // Auto-populate from quote data
  useEffect(() => {
    console.log('[OrderCreateForm] useEffect triggered - quoteData:', quoteData);
    
    if (!quoteData) {
      console.log('[OrderCreateForm] No quoteData - skipping auto-populate');
      return;
    }
    
    if (quoteData.components.length === 0) {
      console.log('[OrderCreateForm] Quote has no components - skipping');
      return;
    }
    
    console.log('[OrderCreateForm] Mapping', quoteData.components.length, 'components');
    
    // Map quote components to order line items
    const mappedLines: OrderLineItem[] = quoteData.components.map((comp) => {
      // Get first flashing_id from component_library join (flashing_ids is array)
      const flashingId = comp.component_library?.flashing_ids?.[0] || undefined;
      const flashing = flashingId ? flashings.find(f => f.id === flashingId) : undefined;
      
      // Derive unit from measurement_type
      const unit = comp.measurement_type === 'linear' ? 'm' : comp.measurement_type === 'area' ? 'm²' : 'pcs';
      
      // Check if we have individual measurements for this component
      const hasMeasurements = comp.measurements && comp.measurements.length > 0;
      
      if (hasMeasurements) {
        // Multiple lengths mode - use individual cut lengths (rounded to 2 decimals)
        const lengths: LengthEntry[] = comp.measurements!.map(m => ({
          length: Math.round(m.measurement_value * 100) / 100,
          multiplier: 1,
        }));
        
        return {
          id: `quote-${comp.id}`,
          componentName: comp.name,
          flashingId,
          flashingImageUrl: flashing?.image_url,
          entryMode: 'multiple',
          quantity: 0,
          unit: 'pcs',
          lengths,
          lengthUnit: 'm',
          showComponentName: false,
          showFlashingImage: false,
          showMeasurements: false,
        };
      } else {
        // Single mode - use total quantity
        return {
          id: `quote-${comp.id}`,
          componentName: comp.name,
          flashingId,
          flashingImageUrl: flashing?.image_url,
          entryMode: 'single',
          quantity: comp.final_quantity || 0,
          unit,
          showComponentName: false,
          showFlashingImage: false,
          showMeasurements: false,
        };
      }
    });
    
    console.log('[OrderCreateForm] Setting', mappedLines.length, 'order lines');
    setOrderLines(mappedLines);
    
    // Pre-fill reference if available
    if (quoteData.quote_number) {
      console.log('[OrderCreateForm] Pre-filling reference:', quoteData.quote_number);
      setReference(`Order for ${quoteData.quote_number}`);
    }
  }, [quoteData, flashings]);
  
  // Load existing order for edit
  useEffect(() => {
    if (!existingOrder) return;
    
    console.log('[OrderCreateForm] Loading existing order:', existingOrder.order.order_number);
    
    const { order, lines } = existingOrder;
    
    // Load header fields
    setSelectedTemplateId(order.template_id || '');
    setReference(order.reference || order.job_name || '');
    setToSupplier(order.to_supplier || order.supplier_name || '');
    setFromCompany(order.from_company || '');
    setContactPerson(order.contact_person || order.supplier_contact || '');
    setContactDetails(order.contact_details || '');
    setOrderType(order.order_type || '');
    setColours(order.colours || (order.job_colours || []).join(', '));
    setDeliveryDate(order.delivery_date || '');
    setDeliveryAddress(order.delivery_address || '');
    setOrderNotes(order.header_notes || '');
    setLogoUrl(order.logo_url || '');
    setOrderDate(order.order_date || new Date().toISOString().split('T')[0]);
    setLayoutMode(order.layout_mode || 'single');
    
    // Map line items
    const mappedLines: OrderLineItem[] = lines.map(line => ({
      id: line.id,
      componentName: line.item_name,
      flashingId: line.flashing_id || undefined,
      flashingImageUrl: line.flashing_image_url || undefined,
      entryMode: line.entry_mode,
      quantity: line.quantity || 0,
      unit: line.unit || 'pcs',
      lengths: line.lengths || undefined,
      lengthUnit: line.length_unit || undefined,
      notes: line.item_notes || undefined,
      showComponentName: line.show_component_name,
      showFlashingImage: line.show_flashing_image,
      showMeasurements: line.show_measurements,
    }));
    
    console.log('[OrderCreateForm] Loaded', mappedLines.length, 'line items');
    setOrderLines(mappedLines);
  }, [existingOrder]);
  
  // Template auto-fill
  function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId);
    
    if (!templateId) {
      setToSupplier('');
      setFromCompany('');
      setContactPerson('');
      setContactDetails('');
      setDeliveryAddress('');
      setOrderNotes('');
      setLogoUrl('');
      setReference('');
      setOrderType('');
      setColours('');
      return;
    }
    
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    
    if (template.default_supplier_name) setToSupplier(template.default_supplier_name);
    if (template.default_from_company) setFromCompany(template.default_from_company);
    if (template.default_contact_person) setContactPerson(template.default_contact_person);
    if (template.default_contact_details) setContactDetails(template.default_contact_details);
    if (template.default_delivery_address) setDeliveryAddress(template.default_delivery_address);
    if (template.default_header_notes) setOrderNotes(template.default_header_notes);
    if (template.default_logo_url) setLogoUrl(template.default_logo_url);
    if (template.default_reference) setReference(template.default_reference);
    if (template.default_order_type) setOrderType(template.default_order_type);
    if (template.default_colours) setColours(template.default_colours.join(', '));
  }
  
  
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }
    
    setUploadingLogo(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload-logo', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      const { url } = await response.json();
      setLogoUrl(url);
    } catch (error) {
      console.error('Logo upload error:', error);
      alert('Failed to upload logo. Please try again.');
    } finally {
      setUploadingLogo(false);
    }
  }
  
  function openAddItemModal() {
    setEditingLineId(null);
    setShowAddItemModal(true);
  }
  
  function openEditModal(lineId: string) {
    setEditingLineId(lineId);
    setShowAddItemModal(true);
  }
  
  function saveLineItem(data: {
    componentName: string;
    flashingId?: string;
    entryMode: 'single' | 'multiple';
    quantity?: number;
    unit?: string;
    lengths?: LengthEntry[];
    lengthUnit?: string;
    notes?: string;
  }) {
    const flashing = data.flashingId ? flashings.find(f => f.id === data.flashingId) : undefined;
    
    if (editingLineId) {
      // Update existing
      setOrderLines(orderLines.map(line => 
        line.id === editingLineId
          ? {
              ...line,
              componentName: data.componentName,
              flashingId: data.flashingId,
              flashingImageUrl: flashing?.image_url,
              entryMode: data.entryMode,
              quantity: data.quantity || 0,
              unit: data.unit || '',
              lengths: data.lengths,
              lengthUnit: data.lengthUnit,
              notes: data.notes,
            }
          : line
      ));
    } else {
      // Add new
      const newLine: OrderLineItem = {
        id: `line-${Date.now()}`,
        componentName: data.componentName,
        flashingId: data.flashingId,
        flashingImageUrl: flashing?.image_url,
        entryMode: data.entryMode,
        quantity: data.quantity || 0,
        unit: data.unit || '',
        lengths: data.lengths,
        lengthUnit: data.lengthUnit,
        notes: data.notes,
        showComponentName: true,
        showFlashingImage: true,
        showMeasurements: true,
      };
      setOrderLines([...orderLines, newLine]);
    }
    
    setShowAddItemModal(false);
    setEditingLineId(null);
  }
  
  function removeLine(id: string) {
    if (confirm('Remove this item from the order?')) {
      setOrderLines(orderLines.filter(l => l.id !== id));
    }
  }
  
  function toggleLineVisibility(lineId: string, field: 'showComponentName' | 'showFlashingImage' | 'showMeasurements') {
    setOrderLines(orderLines.map(line =>
      line.id === lineId ? { ...line, [field]: !line[field] } : line
    ));
  }
  
  function moveLineUp(lineId: string) {
    const index = orderLines.findIndex(l => l.id === lineId);
    if (index <= 0) return;
    
    const newLines = [...orderLines];
    [newLines[index - 1], newLines[index]] = [newLines[index], newLines[index - 1]];
    setOrderLines(newLines);
  }
  
  function moveLineDown(lineId: string) {
    const index = orderLines.findIndex(l => l.id === lineId);
    if (index < 0 || index >= orderLines.length - 1) return;
    
    const newLines = [...orderLines];
    [newLines[index], newLines[index + 1]] = [newLines[index + 1], newLines[index]];
    setOrderLines(newLines);
  }
  
  async function handleSaveDraft() {
    if (!reference.trim()) {
      alert('Please enter a Reference/Job name before saving');
      return;
    }
    
    if (orderLines.length === 0) {
      alert('Please add at least one component before saving');
      return;
    }
    
    setSaving(true);
    
    try {
      const result = await saveDraftOrder({
        orderId: existingOrder?.order.id,
        templateId: selectedTemplateId || undefined,
        reference: reference.trim(),
        toSupplier,
        fromCompany,
        contactPerson,
        contactDetails,
        orderType,
        colours,
        deliveryDate,
        deliveryAddress,
        orderNotes,
        logoUrl,
        orderDate,
        layoutMode,
        lineItems: orderLines.map((line, index) => ({
          componentName: line.componentName,
          flashingId: line.flashingId,
          flashingImageUrl: line.flashingImageUrl,
          entryMode: line.entryMode,
          quantity: line.quantity,
          unit: line.unit,
          lengths: line.lengths,
          lengthUnit: line.lengthUnit,
          notes: line.notes,
          showComponentName: line.showComponentName,
          showFlashingImage: line.showFlashingImage,
          showMeasurements: line.showMeasurements,
          sortOrder: index,
        })),
      });
      
      alert(`Order saved! Order #${result.orderNumber}`);
      router.push('../material-orders');
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save order. Please try again.');
    } finally {
      setSaving(false);
    }
  }
  
  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Back Button */}
      <div className="px-6 pt-4">
        <BackButton />
      </div>
      
      {/* Header Section */}
      <div className="flex-shrink-0">
        {headerExpanded ? (
          <div className="bg-white border-b border-slate-200 shadow-sm">
            {/* Template Selector */}
            <div className="px-6 py-3 border-b border-slate-100 bg-slate-50">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Use Template (Optional)
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full md:w-96 px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">None - Enter details manually</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name} {template.description && `- ${template.description}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Header Form - Two Column */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
              {/* LEFT COLUMN */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">To (Supplier)</h3>
                
                <input
                  type="text"
                  value={toSupplier}
                  onChange={(e) => setToSupplier(e.target.value)}
                  placeholder="To"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Reference"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                
                <input
                  type="text"
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value)}
                  placeholder="Order Type (optional)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                
                <input
                  type="text"
                  value={colours}
                  onChange={(e) => setColours(e.target.value)}
                  placeholder="Colours"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  placeholder="Delivery Date"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                
                <textarea
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Delivery Address"
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                
                <textarea
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Order Notes"
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">From (Your Company)</h3>
                
                <div className="flex items-start gap-3">
                  {logoUrl ? (
                    <div className="relative w-20 h-20 border border-slate-200 rounded bg-white">
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                      <button
                        type="button"
                        onClick={() => setLogoUrl('')}
                        className="absolute -top-1 -right-1 p-0.5 bg-red-600 text-white rounded-full hover:bg-red-700"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 border-2 border-dashed border-slate-300 rounded flex items-center justify-center bg-slate-50">
                      <span className="text-xs text-slate-400">Logo</span>
                    </div>
                  )}
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                      className="hidden"
                    />
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded border border-slate-300 hover:bg-slate-50">
                      {uploadingLogo ? 'Uploading...' : 'Upload'}
                    </span>
                  </label>
                </div>
                
                <input
                  type="text"
                  value={fromCompany}
                  onChange={(e) => setFromCompany(e.target.value)}
                  placeholder="From"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Contact Person"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                
                <input
                  type="text"
                  value={contactDetails}
                  onChange={(e) => setContactDetails(e.target.value)}
                  placeholder="Contact Details"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>

            {/* Minimize Button */}
            <div className="px-6 py-2 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setHeaderExpanded(false)}
                className="px-3 py-1.5 text-xs font-medium rounded border border-slate-300 hover:bg-white transition-colors"
              >
                Minimize Header
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              <span className="font-medium">To:</span> {toSupplier || 'Not set'} · 
              <span className="font-medium ml-2">From:</span> {fromCompany || 'Not set'} · 
              <span className="font-medium ml-2">Ref:</span> {reference || 'Not set'}
            </div>
            <button
              type="button"
              onClick={() => setHeaderExpanded(true)}
              className="px-3 py-1.5 text-xs font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition-colors"
            >
              Edit Header
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area - Sidebar + Order Form */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR - Order Components Control Panel */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h3 className="font-semibold text-slate-900 text-sm">Order Components</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Control what appears in the order form
            </p>
          </div>

          {/* Add Component Button - Top */}
          <div className="px-4 py-3 border-b border-slate-200">
            <button
              type="button"
              onClick={openAddItemModal}
              className="w-full px-4 py-2 text-sm font-medium rounded-full bg-[#FF6B35] text-white hover:bg-orange-600 transition-colors"
            >
              + Add Component
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {orderLines.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-xs mb-3">No components added</p>
                <button
                  type="button"
                  onClick={openAddItemModal}
                  className="px-3 py-1.5 text-xs font-medium rounded bg-[#FF6B35] text-white hover:bg-orange-600"
                >
                  Add Component
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {orderLines.map((line, index) => (
                  <div key={line.id} className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                    {/* Component Header */}
                    <div className="px-3 py-2 bg-white border-b border-slate-200">
                      <div className="flex items-start gap-2 mb-2">
                        {/* Up/Down Arrows */}
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveLineUp(line.id)}
                            disabled={index === 0}
                            className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move up"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => moveLineDown(line.id)}
                            disabled={index === orderLines.length - 1}
                            className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move down"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                        <h4 className="flex-1 font-medium text-sm text-slate-900">{line.componentName}</h4>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(line.id)}
                          className="flex-1 px-2 py-1 text-xs font-medium rounded border border-slate-300 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          className="flex-1 px-2 py-1 text-xs font-medium rounded border border-red-200 text-red-600 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {/* Visibility Controls */}
                    <div className="px-3 py-2 space-y-2">
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-white rounded px-2 py-1.5 transition-colors">
                        <input
                          type="checkbox"
                          checked={line.showComponentName}
                          onChange={() => toggleLineVisibility(line.id, 'showComponentName')}
                          className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                        />
                        <span>Show Name</span>
                      </label>
                      
                      {/* Flashing Drawing Selector */}
                      <div className="px-2 py-1.5">
                        <label className="block text-xs text-slate-600 mb-1">Flashing Drawing:</label>
                        <select
                          value={line.flashingId || ''}
                          onChange={(e) => {
                            const newFlashingId = e.target.value || undefined;
                            const updatedFlashing = newFlashingId ? flashings.find(f => f.id === newFlashingId) : undefined;
                            setOrderLines(orderLines.map(l => 
                              l.id === line.id 
                                ? { 
                                    ...l, 
                                    flashingId: newFlashingId, 
                                    flashingImageUrl: updatedFlashing?.image_url,
                                    showFlashingImage: !!newFlashingId
                                  }
                                : l
                            ));
                          }}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                        >
                          <option value="">None</option>
                          
                          {/* Show component's linked flashings first (if from quote) */}
                          {(() => {
                            // Get component data if this is from a quote
                            const quoteComponentId = line.id.startsWith('quote-') ? line.id.replace('quote-', '') : null;
                            const quoteComponent = quoteComponentId ? quoteData?.components.find(c => c.id === quoteComponentId) : null;
                            const linkedFlashingIds = quoteComponent?.component_library?.flashing_ids || [];
                            
                            if (linkedFlashingIds.length > 0) {
                              const linkedFlashings = flashings.filter(f => linkedFlashingIds.includes(f.id));
                              const otherFlashings = flashings.filter(f => !linkedFlashingIds.includes(f.id));
                              
                              return (
                                <>
                                  <optgroup label="━━ Component Flashings ━━">
                                    {linkedFlashings.map(f => (
                                      <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                  </optgroup>
                                  {otherFlashings.length > 0 && (
                                    <optgroup label="━━ All Other Flashings ━━">
                                      {otherFlashings.map(f => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                      ))}
                                    </optgroup>
                                  )}
                                </>
                              );
                            } else {
                              // No linked flashings, show all
                              return flashings.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                              ));
                            }
                          })()}
                        </select>
                      </div>
                      
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-white rounded px-2 py-1.5 transition-colors">
                        <input
                          type="checkbox"
                          checked={line.showMeasurements}
                          onChange={() => toggleLineVisibility(line.id, 'showMeasurements')}
                          className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                        />
                        <span>Show Measurements</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT - Order Form Display */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
          {/* Toolbar */}
          <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Order Form</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <button
                  type="button"
                  onClick={() => setLayoutMode('single')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                    layoutMode === 'single'
                      ? 'bg-[#FF6B35] text-white border-orange-600'
                      : 'border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Single Column
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode('double')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                    layoutMode === 'double'
                      ? 'bg-[#FF6B35] text-white border-orange-600'
                      : 'border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Double Column
                </button>
              </div>
            </div>
          </div>

          {/* Order Form Content - A4 Preview */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
            <div className="max-w-[210mm] mx-auto bg-white shadow-lg" style={{ minHeight: '297mm' }}>
              <div className="p-8">
                {/* Order Header */}
                <div className="mb-6 pb-6 border-b-2 border-slate-300">
                  {/* 3-Column Header Layout */}
                  <div className="grid grid-cols-3 gap-8">
                    {/* Column 1: TO section (left-aligned) */}
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-500 uppercase">To:</p>
                      <p className="text-sm font-medium text-slate-900">{toSupplier || 'Not set'}</p>
                      {reference && (
                        <p className="text-xs text-slate-600">
                          <span className="font-medium">Ref:</span> {reference}
                        </p>
                      )}
                      {orderType && (
                        <p className="text-xs text-slate-600">
                          <span className="font-medium">Order Type:</span> {orderType}
                        </p>
                      )}
                      {colours && (
                        <p className="text-xs text-slate-600">
                          <span className="font-medium">Colours:</span> {colours}
                        </p>
                      )}
                      
                      {deliveryAddress && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Delivery Address:</p>
                          <p className="text-xs text-slate-700 whitespace-pre-wrap">{deliveryAddress}</p>
                        </div>
                      )}
                      
                      {deliveryDate && (
                        <p className="text-xs text-slate-600 mt-2">
                          <span className="font-medium">Delivery Date:</span> {new Date(deliveryDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    
                    {/* Column 2: Spacer (breathing room) */}
                    <div></div>
                    
                    {/* Column 3: Logo + FROM section (left-aligned) */}
                    <div className="space-y-3">
                      {/* Logo pinned to top, max height */}
                      {logoUrl && (
                        <div className="flex items-start">
                          <img src={logoUrl} alt="Logo" className="max-h-16 max-w-full object-contain" />
                        </div>
                      )}
                      
                      {/* FROM section - left-aligned */}
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-500 uppercase">From:</p>
                        <p className="text-sm font-medium text-slate-900">{fromCompany || 'Not set'}</p>
                        {contactPerson && (
                          <p className="text-xs text-slate-600">{contactPerson}</p>
                        )}
                        {contactDetails && (
                          <p className="text-xs text-slate-600">{contactDetails}</p>
                        )}
                        {orderDate && (
                          <p className="text-xs text-slate-600 mt-2">
                            <span className="font-medium">Order Date:</span> {new Date(orderDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {orderNotes && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Notes:</p>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap">{orderNotes}</p>
                    </div>
                  )}
                </div>

                {/* Components Section */}
            {orderLines.length === 0 ? (
              <div className="text-center py-20 text-slate-500">
                <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm mb-4">No items added yet</p>
                <p className="text-xs text-slate-400 mb-4">
                  {quoteData 
                    ? 'Select items from the sidebar to add them here'
                    : 'Add custom items to get started'
                  }
                </p>
                <button
                  type="button"
                  onClick={openAddItemModal}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-[#FF6B35] text-white hover:bg-orange-600"
                >
                  Add Custom Item
                </button>
              </div>
            ) : (
              <div className={layoutMode === 'double' ? 'grid grid-cols-2 gap-6' : 'space-y-6'}>
                {orderLines.map(line => (
                  <div key={line.id} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                    {/* Component Name */}
                    {line.showComponentName && (
                      <h4 className="font-semibold text-slate-900 text-base">{line.componentName}</h4>
                    )}

                    {/* Flashing Image */}
                    {line.showFlashingImage && line.flashingImageUrl && (
                      <div>
                        <img 
                          src={line.flashingImageUrl} 
                          alt="Flashing" 
                          className={`border border-slate-200 rounded ${layoutMode === 'double' ? 'w-full' : 'w-full max-w-md'}`}
                        />
                      </div>
                    )}

                    {/* Measurements */}
                    {line.showMeasurements && (
                      <div className="text-sm text-slate-700">
                        {line.entryMode === 'single' ? (
                          <p className="font-medium">Quantity: {line.quantity} {line.unit}</p>
                        ) : (
                          <div>
                            <p className="font-medium text-xs text-slate-500 uppercase mb-2">Lengths ({line.lengthUnit}):</p>
                            <div className="space-y-2">
                              {line.lengths?.map((entry, idx) => (
                                <div key={idx}>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{entry.length}{line.lengthUnit}</span>
                                    <span className="text-slate-400">×</span>
                                    <span className="text-slate-600">{entry.multiplier}</span>
                                  </div>
                                  {entry.variables && entry.variables.length > 0 && (
                                    <div className="text-xs text-slate-500 pl-4 mt-0.5">
                                      {entry.variables.map((v, vIdx) => (
                                        <span key={vIdx} className="mr-2">
                                          {v.name}={v.value}{v.unit}
                                          {vIdx < entry.variables!.length - 1 && ', '}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {line.notes && <p className="text-slate-600 mt-2 text-xs italic">{line.notes}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 bg-white border-t border-slate-200 flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => router.push('../material-orders')}
              disabled={saving}
              className="px-6 py-2.5 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            {existingOrder && (
              <button
                type="button"
                onClick={() => window.open(`../material-orders/${existingOrder.order.id}/preview`, '_blank')}
                disabled={saving}
                className="px-6 py-2.5 text-sm font-medium rounded-full bg-slate-900 text-white hover:shadow-[0_0_15px_rgba(255,107,53,0.5)] hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                Preview
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving}
              className="px-6 py-2.5 text-sm font-medium rounded-full bg-[#FF6B35] text-white hover:bg-orange-600 transition-colors shadow-sm disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Order'}
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Item Modal */}
      {showAddItemModal && (
        <AddItemModal
          flashings={flashings}
          existingLine={editingLineId ? orderLines.find(l => l.id === editingLineId) : undefined}
          onSave={saveLineItem}
          onCancel={() => {
            setShowAddItemModal(false);
            setEditingLineId(null);
          }}
        />
      )}
    </div>
  );
}

// Add Item Modal Component
interface AddItemModalProps {
  flashings: FlashingLibraryRow[];
  existingLine?: OrderLineItem;
  onSave: (data: {
    componentName: string;
    flashingId?: string;
    entryMode: 'single' | 'multiple';
    quantity?: number;
    unit?: string;
    lengths?: LengthEntry[];
    lengthUnit?: string;
    notes?: string;
  }) => void;
  onCancel: () => void;
}

function AddItemModal({ flashings, existingLine, onSave, onCancel }: AddItemModalProps) {
  const [componentName, setComponentName] = useState(existingLine?.componentName || '');
  const [flashingId, setFlashingId] = useState(existingLine?.flashingId || '');
  const [entryMode, setEntryMode] = useState<'single' | 'multiple'>(existingLine?.entryMode || 'single');
  
  // Single mode
  const [quantity, setQuantity] = useState(existingLine?.quantity || 0);
  const [unit, setUnit] = useState(existingLine?.unit || 'pcs');
  
  // Multiple mode
  const [lengths, setLengths] = useState<LengthEntry[]>(existingLine?.lengths || []);
  const [lengthUnit, setLengthUnit] = useState(existingLine?.lengthUnit || 'm');
  const [newLength, setNewLength] = useState(0);
  const [newMultiplier, setNewMultiplier] = useState(1);
  
  // Variables for current length entry
  const [showVariables, setShowVariables] = useState(false);
  const [currentVariables, setCurrentVariables] = useState<Variable[]>([]);
  const [newVarName, setNewVarName] = useState('');
  const [newVarValue, setNewVarValue] = useState(0);
  const [newVarUnit, setNewVarUnit] = useState('mm');
  
  const [notes, setNotes] = useState(existingLine?.notes || '');
  
  function addVariable() {
    if (!newVarName.trim()) {
      alert('Variable name is required');
      return;
    }
    if (newVarValue <= 0) {
      alert('Variable value must be greater than 0');
      return;
    }
    
    setCurrentVariables([...currentVariables, { 
      name: newVarName.trim(), 
      value: newVarValue, 
      unit: newVarUnit 
    }]);
    setNewVarName('');
    setNewVarValue(0);
    setNewVarUnit('mm');
  }
  
  function removeVariable(index: number) {
    setCurrentVariables(currentVariables.filter((_, i) => i !== index));
  }
  
  function addLength() {
    if (newLength <= 0) {
      alert('Length must be greater than 0');
      return;
    }
    if (newMultiplier <= 0) {
      alert('Multiplier must be greater than 0');
      return;
    }
    
    setLengths([...lengths, { 
      length: newLength, 
      multiplier: newMultiplier,
      variables: currentVariables.length > 0 ? currentVariables : undefined
    }]);
    setNewLength(0);
    setNewMultiplier(1);
    setCurrentVariables([]);
    setShowVariables(false);
  }
  
  function removeLength(index: number) {
    setLengths(lengths.filter((_, i) => i !== index));
  }
  
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!componentName.trim()) {
      alert('Component name is required');
      return;
    }
    
    if (entryMode === 'single') {
      if (quantity <= 0) {
        alert('Quantity must be greater than 0');
        return;
      }
      
      onSave({
        componentName: componentName.trim(),
        flashingId: flashingId || undefined,
        entryMode: 'single',
        quantity,
        unit,
        notes: notes.trim() || undefined,
      });
    } else {
      if (lengths.length === 0) {
        alert('Add at least one length entry');
        return;
      }
      
      onSave({
        componentName: componentName.trim(),
        flashingId: flashingId || undefined,
        entryMode: 'multiple',
        lengths,
        lengthUnit,
        notes: notes.trim() || undefined,
      });
    }
  }
  
  const selectedFlashing = flashingId ? flashings.find(f => f.id === flashingId) : undefined;
  
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {existingLine ? 'Edit Order Item' : 'Add Order Item'}
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">Enter component details and measurements</p>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Component Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={componentName}
              onChange={(e) => setComponentName(e.target.value)}
              required
              placeholder="e.g., Ridge Flashing, Valley Gutter"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Flashing Drawing <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <select
              value={flashingId}
              onChange={(e) => setFlashingId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">No flashing image</option>
              {flashings.map(flashing => (
                <option key={flashing.id} value={flashing.id}>
                  {flashing.name}
                </option>
              ))}
            </select>
            {selectedFlashing && (
              <div className="mt-3 border border-slate-200 rounded-lg p-2 bg-slate-50">
                <img 
                  src={selectedFlashing.image_url} 
                  alt={selectedFlashing.name}
                  className="w-full max-w-sm mx-auto"
                />
              </div>
            )}
          </div>

          {/* Entry Mode Toggle */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Entry Mode</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setEntryMode('single')}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-full border transition-colors ${
                  entryMode === 'single'
                    ? 'bg-[#FF6B35] text-white border-orange-600'
                    : 'border-slate-300 hover:bg-slate-50'
                }`}
              >
                Single Item
              </button>
              <button
                type="button"
                onClick={() => setEntryMode('multiple')}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-full border transition-colors ${
                  entryMode === 'multiple'
                    ? 'bg-[#FF6B35] text-white border-orange-600'
                    : 'border-slate-300 hover:bg-slate-50'
                }`}
              >
                Multiple Lengths
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {entryMode === 'single' 
                ? 'For bulk items (rolls, sheets, pieces)' 
                : 'For flashings with multiple cut lengths'
              }
            </p>
          </div>

          {/* Single Mode Inputs */}
          {entryMode === 'single' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                  required
                  step="0.1"
                  min="0"
                  placeholder="0.0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Unit <span className="text-red-500">*</span>
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="sheets">Sheets</option>
                  <option value="rolls">Rolls</option>
                  <option value="boxes">Boxes</option>
                </select>
              </div>
            </div>
          )}

          {/* Multiple Lengths Mode */}
          {entryMode === 'multiple' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Length Unit</label>
                <select
                  value={lengthUnit}
                  onChange={(e) => setLengthUnit(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="m">Lineal Meters (m)</option>
                  <option value="ft">Lineal Feet (ft)</option>
                  <option value="in">Inches (in)</option>
                </select>
              </div>

              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <label className="block text-sm font-medium text-slate-700 mb-2">Add Length Entry</label>
                <div className="flex gap-2 mb-3">
                  <div className="flex-1">
                    <input
                      type="number"
                      value={newLength || ''}
                      onChange={(e) => setNewLength(parseFloat(e.target.value) || 0)}
                      step="0.01"
                      min="0"
                      placeholder="Length (e.g., 5.55)"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <span className="flex items-center text-slate-400 font-medium">×</span>
                  <div className="w-20">
                    <input
                      type="number"
                      value={newMultiplier || ''}
                      onChange={(e) => setNewMultiplier(parseInt(e.target.value) || 1)}
                      min="1"
                      placeholder="Qty"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* Variables Section (Optional) */}
                <div className="mb-3">
                  <button
                    type="button"
                    onClick={() => setShowVariables(!showVariables)}
                    className="w-full px-3 py-2 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-white transition-colors flex items-center justify-between"
                  >
                    <span>{showVariables ? '▼' : '▶'} Variables (Optional)</span>
                    {currentVariables.length > 0 && (
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs">
                        {currentVariables.length}
                      </span>
                    )}
                  </button>
                  
                  {showVariables && (
                    <div className="mt-2 p-3 border border-slate-200 rounded-lg bg-white space-y-2">
                      <p className="text-xs text-slate-600">Add dimension variables (e.g., x, y, z) for custom flashings</p>
                      
                      {/* Add Variable Input */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newVarName}
                          onChange={(e) => setNewVarName(e.target.value)}
                          placeholder="Name (x, y, z)"
                          maxLength={3}
                          className="w-16 px-2 py-1.5 border border-slate-300 rounded text-sm"
                        />
                        <span className="flex items-center text-slate-400">=</span>
                        <input
                          type="number"
                          value={newVarValue || ''}
                          onChange={(e) => setNewVarValue(parseFloat(e.target.value) || 0)}
                          step="0.1"
                          min="0"
                          placeholder="Value"
                          className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm"
                        />
                        <select
                          value={newVarUnit}
                          onChange={(e) => setNewVarUnit(e.target.value)}
                          className="w-20 px-2 py-1.5 border border-slate-300 rounded text-sm"
                        >
                          <option value="mm">mm</option>
                          <option value="cm">cm</option>
                          <option value="in">in</option>
                          <option value="°">degrees (°)</option>
                        </select>
                        <button
                          type="button"
                          onClick={addVariable}
                          className="px-3 py-1.5 text-xs font-medium rounded-full bg-slate-700 text-white hover:bg-slate-800"
                        >
                          Add
                        </button>
                      </div>

                      {/* Variable List */}
                      {currentVariables.length > 0 && (
                        <div className="space-y-1 pt-2 border-t border-slate-200">
                          {currentVariables.map((variable, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-slate-50 rounded px-2 py-1.5 text-sm">
                              <span>
                                <span className="font-medium">{variable.name}</span>
                                <span className="text-slate-400 mx-1">=</span>
                                <span>{variable.value}{variable.unit}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => removeVariable(idx)}
                                className="text-red-600 hover:text-red-700 text-xs"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={addLength}
                  className="w-full px-4 py-2 text-sm font-medium rounded-full bg-[#FF6B35] text-white hover:bg-orange-600"
                >
                  Add Length Entry
                </button>

                {/* Length List */}
                {lengths.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-600 uppercase">Added Lengths:</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {lengths.map((entry, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 rounded p-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm">
                              <span className="font-medium">{entry.length}{lengthUnit}</span>
                              <span className="text-slate-400 mx-2">×</span>
                              <span className="text-slate-600">{entry.multiplier}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => removeLength(idx)}
                              className="text-red-600 hover:text-red-700 text-xs font-medium"
                            >
                              Remove
                            </button>
                          </div>
                          {entry.variables && entry.variables.length > 0 && (
                            <div className="text-xs text-slate-600 pl-2 border-l-2 border-slate-200">
                              {entry.variables.map((v, vIdx) => (
                                <span key={vIdx} className="mr-2">
                                  <span className="font-medium">{v.name}</span>=<span>{v.value}{v.unit}</span>
                                  {vIdx < entry.variables!.length - 1 && <span className="text-slate-400">, </span>}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes or specifications..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        </form>

        <div className="px-6 py-4 border-t border-slate-200 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="px-6 py-2.5 text-sm font-medium rounded-full bg-[#FF6B35] text-white hover:bg-orange-600 transition-colors shadow-sm"
          >
            {existingLine ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  );
}
