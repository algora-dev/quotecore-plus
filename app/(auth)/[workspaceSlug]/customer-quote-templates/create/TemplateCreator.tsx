'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CustomerQuoteTemplateRow } from '@/app/lib/types';

type CreationMode = 'scratch' | 'copy' | null;

interface Props {
  workspaceSlug: string;
  existingTemplates: CustomerQuoteTemplateRow[];
}

export function TemplateCreator({ workspaceSlug, existingTemplates }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<CreationMode>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templateName, setTemplateName] = useState('');
  const [nameError, setNameError] = useState('');

  const existingNames = existingTemplates.map(t => t.name.toLowerCase());
  const isDuplicate = templateName.trim().length > 0 && existingNames.includes(templateName.trim().toLowerCase());

  const handleNameChange = (value: string) => {
    setTemplateName(value);
    if (value.trim().length > 0 && existingNames.includes(value.trim().toLowerCase())) {
      setNameError('A template with this name already exists');
    } else {
      setNameError('');
    }
  };

  const handleContinue = () => {
    if (!mode || !templateName.trim() || isDuplicate) return;

    if (mode === 'scratch') {
      router.push(`/${workspaceSlug}/customer-quote-templates/create/build?name=${encodeURIComponent(templateName.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <Link
            href={`/${workspaceSlug}/customer-quote-templates`}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← Back to Templates
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900 mt-2">Create Customer Quote Template</h1>
          <p className="text-sm text-slate-500 mt-1">
            Choose how you want to create your template
          </p>
        </div>

        {/* Template Name */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Template Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={templateName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Standard Roofing Quote"
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent ${
              nameError
                ? 'border-red-400 focus:ring-red-500'
                : 'border-slate-300 focus:ring-orange-500'
            }`}
          />
          {nameError && (
            <p className="mt-1.5 text-xs text-red-500">{nameError}</p>
          )}
        </div>

        {/* Creation Options */}
        <div className="space-y-4">
          {/* Option 1: From Scratch */}
          <button
            onClick={() => setMode('scratch')}
            className={`w-full text-left p-6 rounded-xl border-2 transition-all ${
              mode === 'scratch'
                ? 'border-orange-500 bg-blue-50'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 mb-1">
                  Build from Scratch
                </h3>
                <p className="text-sm text-slate-600">
                  Start with a blank template and select which components to include
                </p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                mode === 'scratch' ? 'border-orange-500 bg-black' : 'border-slate-300'
              }`}>
                {mode === 'scratch' && (
                  <div className="w-2 h-2 bg-white rounded-full" />
                )}
              </div>
            </div>
          </button>

          {/* Option 2: Copy Existing */}
          {existingTemplates.length > 0 && (
            <div
              className={`rounded-xl border-2 transition-all ${
                mode === 'copy'
                  ? 'border-orange-500 bg-blue-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <button
                onClick={() => setMode('copy')}
                className="w-full text-left p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">
                      Copy Existing Template
                    </h3>
                    <p className="text-sm text-slate-600">
                      Duplicate an existing template and customize it
                    </p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    mode === 'copy' ? 'border-orange-500 bg-black' : 'border-slate-300'
                  }`}>
                    {mode === 'copy' && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                </div>
              </button>

              {mode === 'copy' && (
                <div className="px-6 pb-6 space-y-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Select Template to Copy
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Choose a template...</option>
                    {existingTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Continue Button */}
        <div className="flex gap-3 justify-end pt-4">
          <Link
            href={`/${workspaceSlug}/customer-quote-templates`}
            className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-full hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            onClick={handleContinue}
            disabled={!mode || !templateName.trim() || isDuplicate}
            className="px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowe transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
