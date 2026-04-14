'use client';

import { useState } from 'react';
import type { 
  MaterialOrderTemplateRow, 
  ComponentLibraryRow,
  FlashingLibraryRow 
} from '@/app/lib/types';

interface Props {
  workspaceSlug: string;
  templates: MaterialOrderTemplateRow[];
  components: ComponentLibraryRow[];
  flashings: FlashingLibraryRow[];
}

export function OrderCreateForm({ workspaceSlug, templates, components, flashings }: Props) {
  // Template selection
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  
  // Header form state - Left column (Job/Delivery)
  const [toCompany, setToCompany] = useState('');
  const [jobReference, setJobReference] = useState('');
  const [colours, setColours] = useState<string[]>([]);
  const [colourInput, setColourInput] = useState('');
  const [includedMaterials, setIncludedMaterials] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  
  // Header form state - Right column (Supplier)
  const [fromSupplier, setFromSupplier] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  
  // Handle template selection
  function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId);
    
    if (!templateId) {
      // Clear supplier fields if "None" selected
      setFromSupplier('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setDeliveryAddress('');
      setNotes('');
      return;
    }
    
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setFromSupplier(template.default_supplier_name || '');
      setContactPerson(template.default_supplier_contact || '');
      setPhone(template.default_supplier_phone || '');
      setEmail(template.default_supplier_email || '');
      setDeliveryAddress(template.default_delivery_address || '');
      setNotes(template.default_header_notes || '');
      setLogoUrl(template.default_logo_url || '');
    }
  }
  
  // Add colour to list
  function addColour() {
    if (colourInput.trim() && !colours.includes(colourInput.trim())) {
      setColours([...colours, colourInput.trim()]);
      setColourInput('');
    }
  }
  
  // Remove colour from list
  function removeColour(colour: string) {
    setColours(colours.filter(c => c !== colour));
  }

  return (
    <div className="space-y-6">
      {/* Template Selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Use Supplier Template (Optional)
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
            ✓ Supplier details auto-filled from template
          </p>
        )}
      </div>

      {/* Header Form - Two Column Layout */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Order Header</h2>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
          {/* LEFT COLUMN - Job/Delivery Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                To (Company/Customer)
              </label>
              <input
                type="text"
                value={toCompany}
                onChange={(e) => setToCompany(e.target.value)}
                placeholder="Enter company or customer name"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Job Reference
              </label>
              <input
                type="text"
                value={jobReference}
                onChange={(e) => setJobReference(e.target.value)}
                placeholder="Job number or reference"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Colour(s)
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={colourInput}
                  onChange={(e) => setColourInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addColour())}
                  placeholder="Enter colour name"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
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
                Included Materials
              </label>
              <textarea
                value={includedMaterials}
                onChange={(e) => setIncludedMaterials(e.target.value)}
                placeholder="List any materials included in this order..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Delivery Date
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes or instructions..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* RIGHT COLUMN - Supplier Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Logo (Optional)
              </label>
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  <div className="relative w-32 h-32 border border-slate-200 rounded-lg overflow-hidden">
                    <img src={logoUrl} alt="Company logo" className="w-full h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="w-32 h-32 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center">
                    <span className="text-xs text-slate-400">No logo</span>
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="text"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="Enter logo URL or upload (coming soon)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Enter image URL or leave blank
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                From (Supplier Name)
              </label>
              <input
                type="text"
                value={fromSupplier}
                onChange={(e) => setFromSupplier(e.target.value)}
                placeholder="Supplier company name"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Line Items Section - Placeholder */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Order Line Items</h2>
        <div className="text-center py-12 text-slate-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm">Line items section - Coming next!</p>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => window.location.href = `/${workspaceSlug}/material-orders`}
          className="px-6 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          className="px-6 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
        >
          Save Draft
        </button>
      </div>
    </div>
  );
}
