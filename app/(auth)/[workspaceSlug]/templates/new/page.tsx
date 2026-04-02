import { createTemplate } from '../actions';

export default function NewTemplatePage() {
  return (
    <section className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-semibold text-slate-900">New Template</h1>

      <form action={createTemplate} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Template Name *</label>
          <input
            name="name"
            required
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-slate-500 focus:outline-none"
            placeholder="e.g. Long Run Steel Roof"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <textarea
            name="description"
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-slate-500 focus:outline-none"
            placeholder="Optional description"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Roofing Profile</label>
          <input
            name="roofing_profile"
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-slate-500 focus:outline-none"
            placeholder="e.g. Corrugate, Standing Seam, Tiles"
          />
        </div>

        <button
          type="submit"
          className="w-full py-2.5 text-sm font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800"
        >
          Create Template
        </button>
      </form>
    </section>
  );
}
