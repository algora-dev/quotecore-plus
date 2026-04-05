'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createQuoteWithDetails } from './actions';

interface Template {
  id: string;
  name: string;
  description: string | null;
}

interface Props {
  workspaceSlug: string;
  templates: Template[];
}

export function QuoteDetailsForm({ workspaceSlug, templates }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [customerName, setCustomerName] = useState('');
  const [jobName, setJobName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [entryMode, setEntryMode] = useState<'manual' | 'digital' | null>(null);
  const [roofPlanFile, setRoofPlanFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);

  // Pre-select template from URL param
  useEffect(() => {
    const urlTemplateId = searchParams.get('template');
    if (urlTemplateId && templates.find(t => t.id === urlTemplateId)) {
      setTemplateId(urlTemplateId);
    }
  }, [searchParams, templates]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!customerName.trim()) {
      alert('Customer name is required');
      return;
    }

    if (!entryMode) {
      alert('Please select an entry mode (Manual or Digital)');
      return;
    }

    if (entryMode === 'digital' && !roofPlanFile) {
      alert('Please upload a roof plan for digital takeoff');
      return;
    }

    setCreating(true);
    try {
      // Create quote first
      const quoteId = await createQuoteWithDetails({
        customerName: customerName.trim(),
        jobName: jobName.trim() || null,
        templateId: templateId || null,
        entryMode,
      });

      // If digital mode, upload file via FormData
      if (entryMode === 'digital' && roofPlanFile) {
        const formData = new FormData();
        formData.append('file', roofPlanFile);
        formData.append('quoteId', quoteId);
        
        const response = await fetch(`/${workspaceSlug}/quotes/new/upload-plan`, {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(error || 'Failed to upload roof plan');
        }
      }

      // Redirect based on entry mode
      if (entryMode === 'digital') {
        router.push(`/${workspaceSlug}/quotes/${quoteId}/takeoff`);
      } else {
        router.push(`/${workspaceSlug}/quotes/${quoteId}`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create quote');
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-8 space-y-6">
      {/* Customer Name */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Customer Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="e.g., John Smith"
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
          autoFocus
        />
      </div>

      {/* Job Name */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Job Name <span className="text-slate-400">(optional)</span>
        </label>
        <input
          type="text"
          value={jobName}
          onChange={(e) => setJobName(e.target.value)}
          placeholder="e.g., Residential Re-roof, 123 Main St"
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Template Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Quote Template <span className="text-slate-400">(optional)</span>
        </label>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Start from scratch</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
              {template.description ? ` — ${template.description}` : ''}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500 mt-1">
          Templates pre-load roof areas and components
        </p>
      </div>

      {/* Entry Mode Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-3">
          Entry Mode <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {/* Manual Mode Button */}
          <button
            type="button"
            onClick={() => {
              setEntryMode('manual');
              setRoofPlanFile(null);
            }}
            className={`relative p-4 rounded-lg border-2 transition-all ${
              entryMode === 'manual'
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-300 hover:border-slate-400'
            }`}
            title="Transfer already sourced measurements directly into Roof Areas and Components"
          >
            <div className="flex items-center justify-center mb-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="text-sm font-medium text-slate-900">Manual Mode</div>
            <div className="text-xs text-slate-500 mt-1">Traditional quote builder</div>
          </button>

          {/* Digital Mode Button */}
          <button
            type="button"
            onClick={() => setEntryMode('digital')}
            className={`relative p-4 rounded-lg border-2 transition-all ${
              entryMode === 'digital'
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-300 hover:border-slate-400'
            }`}
            title="Upload your roof plan, measure and assign roof areas, roof component items (Faster)"
          >
            <div className="flex items-center justify-center mb-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <div className="text-sm font-medium text-slate-900">Digital Mode</div>
            <div className="text-xs text-slate-500 mt-1">Digital takeoff canvas</div>
          </button>
        </div>
      </div>

      {/* Conditional Roof Plan Upload (Digital Mode Only) */}
      {entryMode === 'digital' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Upload Roof Plan <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setRoofPlanFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-slate-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-600 file:text-white
              hover:file:bg-blue-700
              cursor-pointer"
          />
          {roofPlanFile && (
            <p className="text-xs text-green-600 mt-2">
              ✓ {roofPlanFile.name} selected
            </p>
          )}
          <p className="text-xs text-slate-500 mt-2">
            Accepted formats: JPG, PNG, PDF
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <Link
          href={`/${workspaceSlug}/quotes`}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← Cancel
        </Link>
        <button
          type="submit"
          disabled={creating || !customerName.trim() || !entryMode || (entryMode === 'digital' && !roofPlanFile)}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creating ? 'Creating...' : entryMode === 'digital' ? 'Start Digital Takeoff' : 'Start Quote'}
        </button>
      </div>
    </form>
  );
}
