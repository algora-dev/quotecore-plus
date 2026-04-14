'use client';

import { useState } from 'react';
import type { MaterialOrderTemplateRow } from '@/app/lib/types';

interface OrderCreateFormProps {
  templates: MaterialOrderTemplateRow[];
  quoteId?: string; // Optional - if creating from quote
}

interface OrderLineItem {
  id: string;
  componentName: string;
  flashingImageUrl?: string;
  quantity: number;
  unit: string;
  notes?: string;
}

export function OrderCreateForm({ templates, quoteId }: OrderCreateFormProps) {
  // Layout state
  const [layoutMode, setLayoutMode] = useState<'single' | 'double'>('single');
  const [headerExpanded, setHeaderExpanded] = useState(true);
  
  // Template selection
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  
  // Header form state - LEFT
  const [toSupplier, setToSupplier] = useState('');
  const [reference, setReference] = useState('');
  const [orderType, setOrderType] = useState('');
  const [colours, setColours] = useState<string[]>([]);
  const [colourInput, setColourInput] = useState('');
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
  
  // Sidebar - Quote component navigator (placeholder for now)
  const quoteComponents: any[] = []; // TODO: Load from quote if quoteId provided
  
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
      setColours([]);
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
    if (template.default_colours) setColours(template.default_colours);
  }
  
  function addColour() {
    const trimmed = colourInput.trim();
    if (trimmed && !colours.includes(trimmed)) {
      setColours([...colours, trimmed]);
      setColourInput('');
    }
  }
  
  function removeColour(colour: string) {
    setColours(colours.filter(c => c !== colour));
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
  
  function addCustomLine() {
    const newLine: OrderLineItem = {
      id: `line-${Date.now()}`,
      componentName: '',
      quantity: 0,
      unit: 'm',
    };
    setOrderLines([...orderLines, newLine]);
  }
  
  function removeLine(id: string) {
    setOrderLines(orderLines.filter(l => l.id !== id));
  }
  
  return (
    <div className="flex flex-col h-screen bg-slate-50">
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
                
                <div>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={colourInput}
                      onChange={(e) => setColourInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addColour())}
                      placeholder="Colours"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                    <button
                      type="button"
                      onClick={addColour}
                      className="px-3 py-2 text-sm font-medium rounded-lg bg-[#FF6B35] text-white hover:bg-orange-600"
                    >
                      Add
                    </button>
                  </div>
                  {colours.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {colours.map(colour => (
                        <span
                          key={colour}
                          className="inline-flex items-center gap-2 px-2 py-1 bg-slate-100 border border-slate-200 rounded-full text-xs"
                        >
                          {colour}
                          <button
                            type="button"
                            onClick={() => removeColour(colour)}
                            className="text-red-600 hover:text-red-700"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
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
              className="px-3 py-1.5 text-xs font-medium rounded border border-slate-300 hover:bg-slate-50 transition-colors"
            >
              Edit Header
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area - Sidebar + Order Form */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR - Quote Navigator */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h3 className="font-semibold text-slate-900 text-sm">Quote Items</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {quoteId ? 'Select items to add to order' : 'No quote selected'}
            </p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {quoteComponents.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-xs mb-3">No quote items</p>
                <button
                  type="button"
                  onClick={addCustomLine}
                  className="px-3 py-1.5 text-xs font-medium rounded bg-[#FF6B35] text-white hover:bg-orange-600"
                >
                  Add Custom Item
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {/* TODO: Map quote components here */}
                <p className="text-xs text-slate-500">Quote components will appear here</p>
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
                  className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
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
                  className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
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

          {/* Order Form Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {orderLines.length === 0 ? (
              <div className="text-center py-20 text-slate-500">
                <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm mb-4">No items added yet</p>
                <p className="text-xs text-slate-400 mb-4">
                  {quoteId 
                    ? 'Select items from the sidebar to add them here'
                    : 'Add custom items to get started'
                  }
                </p>
                <button
                  type="button"
                  onClick={addCustomLine}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-[#FF6B35] text-white hover:bg-orange-600"
                >
                  Add Custom Item
                </button>
              </div>
            ) : (
              <div className={layoutMode === 'double' ? 'grid grid-cols-2 gap-6' : 'space-y-6'}>
                {orderLines.map(line => (
                  <div key={line.id} className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-medium text-slate-900">{line.componentName || 'Unnamed Component'}</h4>
                      <button
                        type="button"
                        onClick={() => removeLine(line.id)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                    {line.flashingImageUrl && (
                      <div className="mb-3">
                        <img 
                          src={line.flashingImageUrl} 
                          alt="Flashing" 
                          className={`border border-slate-200 rounded ${layoutMode === 'double' ? 'w-full' : 'w-64'}`}
                        />
                      </div>
                    )}
                    <div className="text-sm text-slate-600">
                      <p>Quantity: {line.quantity} {line.unit}</p>
                      {line.notes && <p className="text-slate-500 mt-1">{line.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 bg-white border-t border-slate-200 flex gap-3 justify-end">
            <button
              type="button"
              className="px-6 py-2.5 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-6 py-2.5 text-sm font-medium rounded-lg bg-[#FF6B35] text-white hover:bg-orange-600 transition-colors shadow-sm"
            >
              Save Draft
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
