import { requireCompanyContext } from '@/app/lib/supabase/server';
import { loadCustomerQuoteTemplates } from '../quotes/actions';
import Link from 'next/link';

export default async function CustomerQuoteTemplatesPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  await requireCompanyContext();

  const templates = await loadCustomerQuoteTemplates();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Customer Quote Templates</h1>
            <p className="text-sm text-slate-500 mt-1">
              Create reusable layouts for customer-facing quotes
            </p>
          </div>
          <Link
            href={`/${workspaceSlug}/customer-quote-templates/create`}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + Create Template
          </Link>
        </div>

        {/* Templates List */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {templates.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-400 mb-4">No templates created yet</p>
              <Link
                href={`/${workspaceSlug}/customer-quote-templates/create`}
                className="inline-block px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Your First Template
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Template Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Company Name
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {templates.map((template) => (
                  <tr key={template.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-900">{template.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      {template.is_starter_template ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          Starter
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Custom
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {template.company_name || '—'}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Link
                        href={`/${workspaceSlug}/customer-quote-templates/${template.id}`}
                        className="text-sm text-orange-600 hover:text-blue-700"
                      >
                        View
                      </Link>
                      {!template.is_starter_template && (
                        <>
                          <Link
                            href={`/${workspaceSlug}/customer-quote-templates/${template.id}/edit`}
                            className="text-sm text-slate-600 hover:text-slate-700"
                          >
                            Edit
                          </Link>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
