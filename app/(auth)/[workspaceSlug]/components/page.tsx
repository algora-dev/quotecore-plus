import { loadComponentLibrary } from './actions';
import { ComponentList } from './component-list';
import { loadCompanyContext } from '@/app/lib/data/company-context';

export default async function ComponentsPage(props: {params: Promise<{workspaceSlug: string}>}) {
  const { workspaceSlug } = await props.params;
  let components;

  try {
    components = await loadComponentLibrary();
  } catch (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-900 mb-2">Unable to load components</h2>
        <p className="text-sm text-red-700">
          {error instanceof Error ? error.message : 'An unexpected error occurred'}
        </p>
      </div>
    );
  }

  // Component library is per-company — shared across every quote regardless of
  // measurement system. We render rates in the company default so an Imperial
  // shop sees ft²/RS labels here, with a note that per-quote display still
  // follows the quote's own measurement_system.
  const { company } = await loadCompanyContext();

  return (
    <ComponentList
      initialComponents={components}
      workspaceSlug={workspaceSlug}
      companyMeasurementSystem={company.default_measurement_system}
    />
  );
}
