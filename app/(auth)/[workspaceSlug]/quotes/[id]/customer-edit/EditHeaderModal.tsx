'use client';
import { useState } from 'react';

interface Props {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyLogoUrl: string;
  onSave: (data: {
    companyName: string;
    companyAddress: string;
    companyPhone: string;
    companyEmail: string;
    companyLogoUrl: string;
  }) => void;
  onCancel: () => void;
}

export function EditHeaderModal({ companyName, companyAddress, companyPhone, companyEmail, companyLogoUrl, onSave, onCancel }: Props) {
  const [name, setName] = useState(companyName);
  const [address, setAddress] = useState(companyAddress);
  const [phone, setPhone] = useState(companyPhone);
  const [email, setEmail] = useState(companyEmail);
  const [logoUrl, setLogoUrl] = useState(companyLogoUrl);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Edit Header Details</h2>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Company Name"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+64 21 123 4567"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="info@yourcompany.com"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main Street, City"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Logo URL</label>
            <input
              type="text"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
            <p className="text-xs text-slate-500 mt-1">Enter a direct URL to your company logo image</p>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave({ companyName: name, companyAddress: address, companyPhone: phone, companyEmail: email, companyLogoUrl: logoUrl });
            }}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
