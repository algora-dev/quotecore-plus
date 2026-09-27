import { QcLibrary } from '@/app/components/ui/v2/QcLibrary';
import { createTemplate } from '../actions';

async function handleCreate(formData: FormData) {
  'use server';
  // This page appears to be unused/deprecated - wrapping for type safety
  await createTemplate({
    name: formData.get('name') as string,
    description: formData.get('description') as string || '',
    roofingProfile: formData.get('roofingProfile') as string || '',
    notes: '',
    customerTemplateId: null,
    components: [],
    extras: [],
  });
}

export default function NewTemplatePage() {
  return (
    <QcLibrary className="max-w-2xl mx-auto space-y-6">
      <h1 className="qc-library-title text-3xl font-semibold text-slate-900">New Template</h1>

      <form action={handleCreate} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Template Name *</label>
          <input aria-label="Template Name"
            name="name"
            required
            className="qc-input qc-library-control w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-slate-500 focus:outline-none"
            placeholder="e.g. Long Run Steel Roof"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <textarea aria-label="Description"
            name="description"
            rows={2}
            className="qc-input qc-library-control w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-slate-500 focus:outline-none"
            placeholder="Optional description"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Roofing Profile</label>
          <input aria-label="Roofing Profile"
            name="roofing_profile"
            className="qc-input qc-library-control w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-slate-500 focus:outline-none"
            placeholder="e.g. Corrugate, Standing Seam, Tiles"
          />
        </div>

        <button data-qc-variant="primary"
          type="submit"
          className="qc-button qc-flow-control qc-library-control w-full"
        >
          Create Template
        </button>
      </form>
    </QcLibrary>
  );
}
