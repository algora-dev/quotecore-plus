import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import type { FlashingLibraryRow } from '@/app/lib/types';
import { EditFlashingForm } from './edit-form';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';
import { getTradeLabels } from '@/app/lib/trades/labels';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ workspaceSlug: string; id: string }>;
}

export default async function EditFlashingPage(props: Props) {
  const { workspaceSlug, id } = await props.params;

  // Ensure user has company context
  const profile = await requireCompanyContext();

  // Feature gate: companies without the flashings feature shouldn't be able
  // to edit existing flashing rows either. Cap doesn't apply to edits.
  const ent = await loadCompanyEntitlements(profile.company_id);
  if (!ent.features.flashings) {
    redirect(`/${workspaceSlug}/flashings`);
  }
  
  const supabase = await createSupabaseServerClient();
  
  // Load flashing
  const { data: flashing, error } = await supabase
    .from('flashing_library')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error || !flashing) {
    notFound();
  }

  // Trade-aware singular label ('Flashing' / 'Drawing/Image'). Display only.
  const { data: companyRow } = await supabase
    .from('companies')
    .select('default_trade')
    .eq('id', profile.company_id)
    .maybeSingle();
  const featureLabelSingular = getTradeLabels(
    (companyRow as { default_trade?: string } | null)?.default_trade,
  ).featureLabelSingular;

  return (
    <div className="max-w-4xl mx-auto p-6 bg-slate-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Edit {featureLabelSingular}</h1>
        <p className="text-sm text-slate-600 mt-1">
          Update {featureLabelSingular.toLowerCase()} details and measurement values
        </p>
      </div>
      
      <EditFlashingForm
        flashing={flashing as unknown as FlashingLibraryRow}
        workspaceSlug={workspaceSlug}
      />
    </div>
  );
}
