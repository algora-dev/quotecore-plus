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

    setCreating(true);
    try {
      const quoteId = await createQuoteWithDetails({
        customerName: customerName.trim(),
        jobName: jobName.trim() || null,
        templateId: templateId || null,
      });

      // Redirect to quote builder
      router.push(`/${workspaceSlug}/quotes/${quoteId}`);
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
          disabled={creating || !customerName.trim()}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creating ? 'Creating...' : 'Continue to Quote Builder'}
        </button>
      </div>
    </form>
  );
}
