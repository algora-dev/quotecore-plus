import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { QuoteDetailsForm } from './QuoteDetailsForm';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import { normalizeMeasurementSystem } from '@/app/lib/types';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';

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

  // Surface the company's default measurement system so the new-quote form
  // can pre-select the right radio. Normalised so legacy 'imperial' doesn't
  // leak into the UI.
  const { company } = await loadCompanyContext();
  const defaultMeasurementSystem = normalizeMeasurementSystem(company.default_measurement_system);
  const ent = await loadCompanyEntitlements(profile.company_id);
  const monthlyQuoteAtCap = ent.monthlyQuoteUsed >= ent.monthlyQuoteLimit;

  // Phase 8 (Generic Trades): load collections + default trade for the
  // trade/collection pickers. Only needed when the client flag is on, but
  // cheap enough to load always so the server component stays simple.
  const { data: componentCollections } = await supabase
    .from('component_collections')
    .select('id, name, is_bootstrap')
    .eq('company_id', profile.company_id)
    .order('is_bootstrap', { ascending: false }) // bootstrap first
    .order('name', { ascending: true });
  const defaultTrade = (company as { default_trade?: string }).default_trade ?? 'roofing';

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
          defaultMeasurementSystem={defaultMeasurementSystem}
          digitalTakeoffAvailable={ent.features.digital_takeoff}
          monthlyQuoteAtCap={monthlyQuoteAtCap}
          monthlyQuoteUsed={ent.monthlyQuoteUsed}
          monthlyQuoteLimit={ent.monthlyQuoteLimit}
          effectivePlanCode={ent.effectivePlanCode}
          defaultTrade={defaultTrade}
          componentCollections={componentCollections ?? []}
          isOverStorage={ent.isOverStorage}
        />
      </div>
    </div>
  );
}
