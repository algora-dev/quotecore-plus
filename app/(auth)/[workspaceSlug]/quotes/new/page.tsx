import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { QuoteDetailsForm } from './QuoteDetailsForm';

export default async function NewQuotePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Load templates for dropdown
  const { data: templates } = await supabase
    .from('templates')
    .select('id, name, description')
    .eq('company_id', profile.company_id)
    .eq('is_active', true)
    .order('name');

  return (
    <div>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Create New Quote</h1>
          <p className="text-sm text-slate-500 mt-1">
            Enter job details to get started.
          </p>
        </div>

        <QuoteDetailsForm
          workspaceSlug={workspaceSlug}
          templates={templates || []}
          companyId={profile.company_id}
        />
      </div>
    </div>
  );
}
