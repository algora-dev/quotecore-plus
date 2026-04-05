'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createQuoteWithDetails } from './actions';
import { FileUploader } from '@/app/components/FileUploader';
import { createClient } from '@/app/lib/supabase/client';
import { checkStorageQuota, saveFileMetadata } from '../../account/actions';

interface Template {
  id: string;
  name: string;
  description: string | null;
}

interface Props {
  workspaceSlug: string;
  templates: Template[];
  companyId: string;
}

export function QuoteDetailsForm({ workspaceSlug, templates, companyId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [customerName, setCustomerName] = useState('');
  const [jobName, setJobName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [entryMode, setEntryMode] = useState<'manual' | 'digital' | null>(null);
  const [planUploaded, setPlanUploaded] = useState(false);
  const [uploadedPlanPath, setUploadedPlanPath] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Pre-select template from URL param
  useEffect(() => {
    const urlTemplateId = searchParams.get('template');
    if (urlTemplateId && templates.find(t => t.id === urlTemplateId)) {
      setTemplateId(urlTemplateId);
    }
  }, [searchParams, templates]);

  async function handlePlanUpload(file: File) {
    const hasQuota = await checkStorageQuota(companyId, file.size);
    if (!hasQuota) {
      throw new Error('Storage quota exceeded. Please upgrade your plan.');
    }

    // Upload to storage only (don't save metadata yet - quote doesn't exist)
    const supabase = createClient();
    const fileExt = file.name.split('.').pop();
    const fileName = `plan-${Date.now()}.${fileExt}`;
    const tempPath = `temp/${companyId}/${fileName}`;
    
    const { error: uploadError } = await supabase.storage
      .from('QUOTE-DOCUMENTS')
      .upload(tempPath, file, { upsert: true });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    // Store file info in state - will save metadata after quote creation
    setUploadedPlanPath(tempPath);
    setPlanUploaded(true);
    
    // Store file details for later metadata save
    (window as any).__pendingPlanFile = { fileName, fileSize: file.size, mimeType: file.type, tempPath };
  }

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

    if (entryMode === 'digital' && !planUploaded) {
      alert('Please upload a roof plan for digital takeoff');
      return;
    }

    setCreating(true);
    try {
      const quoteId = await createQuoteWithDetails({
        customerName: customerName.trim(),
        jobName: jobName.trim() || null,
        templateId: templateId || null,
        entryMode,
      });

      // If digital mode with uploaded plan, move file and save metadata
      if (entryMode === 'digital' && uploadedPlanPath) {
        const pendingFile = (window as any).__pendingPlanFile;
        if (pendingFile) {
          const supabase = createClient();
          
          // Move file from temp to final location
          const finalPath = `${companyId}/${quoteId}/${pendingFile.fileName}`;
          await supabase.storage.from('QUOTE-DOCUMENTS').move(pendingFile.tempPath, finalPath);
          
          // Save metadata now that quote exists
          await saveFileMetadata({
            companyId,
            quoteId,
            fileType: 'plan',
            fileName: pendingFile.fileName,
            fileSize: pendingFile.fileSize,
            mimeType: pendingFile.mimeType,
            storagePath: finalPath,
          });
          
          delete (window as any).__pendingPlanFile;
        }
        
        router.push(`/${workspaceSlug}/quotes/${quoteId}/takeoff`);
      } else {
        // Manual mode goes to quote builder
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
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
              setPlanUploaded(false);
              setUploadedPlanPath(null);
            }}
            className={`relative p-4 rounded-full border-2 transition-all ${
              entryMode === 'manual'
                ? 'border-orange-500 bg-blue-50'
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
            className={`relative p-4 rounded-full border-2 transition-all ${
              entryMode === 'digital'
                ? 'border-orange-500 bg-blue-50'
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

      {/* Roof Plan Upload (Digital Mode Only) */}
      {entryMode === 'digital' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Upload Roof Plan</h3>
            <p className="text-xs text-slate-600 mb-3">
              Upload roof plan (PDF or image) for digital takeoff. Max 10 MB.
            </p>
          </div>
          
          {planUploaded ? (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-green-900 font-medium">Roof plan uploaded successfully!</span>
            </div>
          ) : (
            <FileUploader
              accept="image/*,application/pdf"
              maxSize={10485760}
              onUpload={handlePlanUpload}
              currentFileUrl={null}
              label="Upload Roof Plan"
              description="PDF or image (max 10 MB)"
            />
          )}
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
          disabled={creating || !customerName.trim() || !entryMode || (entryMode === 'digital' && !planUploaded)}
          className="px-6 py-3 bg-orange-500 text-white font-medium rounded-full hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
        >
          {creating ? 'Creating...' : entryMode === 'digital' ? 'Start Digital Takeoff' : 'Create Quote'}
        </button>
      </div>
    </form>
  );
}
