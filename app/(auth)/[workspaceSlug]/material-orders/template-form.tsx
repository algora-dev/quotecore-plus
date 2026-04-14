'use client';

import { useState } from 'react';

interface TemplateFormData {
  name: string;
  description: string;
  // Left side
  toSupplier: string;
  reference: string;
  orderType: string;
  colours: string[];
  deliveryAddress: string;
  orderNotes: string;
  // Right side
  logoUrl: string;
  fromCompany: string;
  contactPerson: string;
  contactDetails: string;
}

interface Props {
  mode: 'create' | 'edit';
  initialData?: Partial<TemplateFormData>;
  onSubmit: (data: TemplateFormData) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

export function TemplateForm({ mode, initialData, onSubmit, onCancel, saving }: Props) {
  // Template meta
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  
  // LEFT SIDE
  const [toSupplier, setToSupplier] = useState(initialData?.toSupplier || '');
  const [reference, setReference] = useState(initialData?.reference || '');
  const [orderType, setOrderType] = useState(initialData?.orderType || '');
  const [colours, setColours] = useState<string[]>(initialData?.colours || []);
  const [colourInput, setColourInput] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState(initialData?.deliveryAddress || '');
  const [orderNotes, setOrderNotes] = useState(initialData?.orderNotes || '');
  
  // RIGHT SIDE
  const [logoUrl, setLogoUrl] = useState(initialData?.logoUrl || '');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [fromCompany, setFromCompany] = useState(initialData?.fromCompany || '');
  const [contactPerson, setContactPerson] = useState(initialData?.contactPerson || '');
  const [contactDetails, setContactDetails] = useState(initialData?.contactDetails || '');
  
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
  
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!name.trim()) {
      alert('Template name is required');
      return;
    }
    
    onSubmit({
      name,
      description,
      toSupplier,
      reference,
      orderType,
      colours,
      deliveryAddress,
      orderNotes,
      logoUrl,
      fromCompany,
      contactPerson,
      contactDetails,
    });
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Template Name & Description */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Template Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g., Main Supplier, Emergency Supplier"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
          <p className="text-xs text-slate-500 mt-1">This name will appear in the template dropdown</p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Description <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional notes about this template"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>
      </div>

      {/* Order Fields - Two Column Layout */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Default Order Fields</h3>
          <p className="text-xs text-slate-600 mt-0.5">Fill in defaults for this template (all optional)</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6">
          {/* LEFT SIDE - To Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">To (Supplier)</h4>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">To</label>
              <input
                type="text"
                value={toSupplier}
                onChange={(e) => setToSupplier(e.target.value)}
                placeholder="Supplier company name"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reference</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Default job reference (usually left blank)"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Order Type</label>
              <input
                type="text"
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
                placeholder="e.g., roof, flashings, underlay"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Colours</label>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Delivery Address</label>
              <textarea
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Default delivery address..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Order Notes</label>
              <textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Default notes..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>

          {/* RIGHT SIDE - From Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">From (Your Company)</h4>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Logo</label>
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
                  <p className="text-xs text-slate-500">PNG, JPG, or GIF (max 5MB)</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">From</label>
              <input
                type="text"
                value={fromCompany}
                onChange={(e) => setFromCompany(e.target.value)}
                placeholder="Your company name"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Contact name"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact Details</label>
              <input
                type="text"
                value={contactDetails}
                onChange={(e) => setContactDetails(e.target.value)}
                placeholder="Phone number or email"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-6 py-2.5 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 text-sm font-medium rounded-lg bg-[#FF6B35] text-white hover:bg-orange-600 transition-colors shadow-sm disabled:opacity-50"
        >
          {saving ? 'Saving...' : mode === 'create' ? 'Create Template' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
