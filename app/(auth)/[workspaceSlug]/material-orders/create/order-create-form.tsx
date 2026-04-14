'use client';

import { useState } from 'react';
import type { MaterialOrderTemplateRow } from '@/app/lib/types';

interface OrderCreateFormProps {
  templates: MaterialOrderTemplateRow[];
}

export function OrderCreateForm({ templates }: OrderCreateFormProps) {
  // Template selection
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  
  // LEFT SIDE - To Section
  const [toSupplier, setToSupplier] = useState('');
  const [reference, setReference] = useState('');
  const [orderType, setOrderType] = useState('');
  const [colours, setColours] = useState<string[]>([]);
  const [colourInput, setColourInput] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  
  // RIGHT SIDE - From Section
  const [logoUrl, setLogoUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [fromCompany, setFromCompany] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactDetails, setContactDetails] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]); // Default to today
  
  // Handle template selection
  function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId);
    
    if (!templateId) {
      // Clear all fields if "None" selected
      setToSupplier('');
      setFromCompany('');
      setContactPerson('');
      setContactDetails('');
      setDeliveryAddress('');
      setOrderNotes('');
      setLogoUrl('');
      return;
    }
    
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    
    // Auto-fill from template
    if (template.default_supplier_name) setToSupplier(template.default_supplier_name);
    if (template.default_supplier_contact) setContactPerson(template.default_supplier_contact);
    if (template.default_supplier_phone || template.default_supplier_email) {
      const details = [template.default_supplier_phone, template.default_supplier_email]
        .filter(Boolean)
        .join(' / ');
      setContactDetails(details);
    }
    if (template.default_delivery_address) setDeliveryAddress(template.default_delivery_address);
    if (template.default_header_notes) setOrderNotes(template.default_header_notes);
    if (template.default_logo_url) setLogoUrl(template.default_logo_url);
  }
  
  // Handle colour tags
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
  
  // Handle logo upload
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
  
  return (
    <div className="space-y-6">
      {/* Template Selector */}
      <div>
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
        {selectedTemplateId && (
          <p className="text-xs text-slate-500 mt-2">
            ✓ Details auto-filled from template (you can still edit them)
          </p>
        )}
      </div>

      {/* Order Header Form */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Order Header</h2>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6">
          {/* LEFT SIDE - To Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">To (Supplier)</h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                To
              </label>
              <input
                type="text"
                value={toSupplier}
                onChange={(e) => setToSupplier(e.target.value)}
                placeholder="Supplier company name"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Reference
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Job name or quote number"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Order Type <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
                placeholder="e.g., roof, flashings, underlay"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Colours
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={colourInput}
                  onChange={(e) => setColourInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addColour())}
                  placeholder="Enter colour name"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
                <button
                  type="button"
                  onClick={addColour}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-[#FF6B35] text-white hover:bg-orange-600 transition-colors"
                >
                  Add
                </button>
              </div>
              {colours.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {colours.map(colour => (
                    <span
                      key={colour}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-sm"
                    >
                      {colour}
                      <button
                        type="button"
                        onClick={() => removeColour(colour)}
                        className="text-red-600 hover:text-red-700 font-medium"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Delivery Date
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Delivery Address
              </label>
              <textarea
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Enter delivery address..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Order Notes
              </label>
              <textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Add any extra information for this order..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>

          {/* RIGHT SIDE - From Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">From (Your Company)</h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Logo <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="flex items-start gap-4">
                {logoUrl ? (
                  <div className="relative w-32 h-32 border border-slate-200 rounded-lg overflow-hidden bg-white">
                    <img src={logoUrl} alt="Company logo" className="w-full h-full object-contain p-2" />
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-lg"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="w-32 h-32 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center bg-slate-50">
                    <span className="text-xs text-slate-400">No logo</span>
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                      className="hidden"
                    />
                    <span className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 cursor-pointer transition-colors">
                      {uploadingLogo ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Uploading...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Upload Logo
                        </>
                      )}
                    </span>
                  </label>
                  <p className="text-xs text-slate-500">
                    PNG, JPG, or GIF (max 5MB)
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                From
              </label>
              <input
                type="text"
                value={fromCompany}
                onChange={(e) => setFromCompany(e.target.value)}
                placeholder="Your company name"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Contact Person
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Contact name"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Contact Details
              </label>
              <input
                type="text"
                value={contactDetails}
                onChange={(e) => setContactDetails(e.target.value)}
                placeholder="Phone number or email"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Order Date
              </label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Line Items Section - Placeholder */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Order Items</h2>
        </div>
        <div className="p-6 text-center text-slate-500">
          Line items section coming next...
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end">
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
  );
}
