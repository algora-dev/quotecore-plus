import Link from 'next/link';
import { loadTemplates } from './data';

export default async function TemplatesPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const templates = await loadTemplates();
  const basePath = `/${workspaceSlug}/templates`;

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-900">Templates</h1>
        <p className="text-base text-slate-600">
          Reusable roofing quote templates with default roof areas and components.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`${basePath}/new`}
          prefetch={false}
          className="inline-flex items-center rounded-full border border-transparent bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          + New template
        </Link>
      </div>

      {templates.length > 0 ? (
        <div className="grid gap-4">
          {templates.map((template) => (
            <Link
              key={template.id}
              href={`${basePath}/${template.id}`}
              prefetch={false}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-6">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">{template.name}</h3>
                  <p className="text-sm text-slate-600">{template.description || 'No description'}</p>
                  {template.roofing_profile && (
                    <span className="mt-2 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                      {template.roofing_profile}
                    </span>
                  )}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs ${
                  template.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                }`}>
                  {template.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <h2 className="text-2xl font-semibold text-slate-900">No templates yet</h2>
          <p className="mt-2 text-slate-600">Create your first template to define default roof areas and components.</p>
          <Link
            href={`${basePath}/new`}
            prefetch={false}
            className="mt-6 inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Create first template
          </Link>
        </div>
      )}
    </section>
  );
}
