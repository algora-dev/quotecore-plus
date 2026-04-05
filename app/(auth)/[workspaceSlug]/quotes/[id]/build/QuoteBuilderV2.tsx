'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { QuoteRow, QuoteRoofAreaRow, QuoteComponentRow, ComponentLibraryRow } from '@/app/lib/types';

type Step = 'roof-areas' | 'components' | 'extras' | 'review';

interface Props {
  quote: QuoteRow;
  roofAreas: QuoteRoofAreaRow[];
  components: QuoteComponentRow[];
  libraryComponents: ComponentLibraryRow[];
  workspaceSlug: string;
  initialStep: string;
}

export function QuoteBuilderV2({
  quote,
  roofAreas,
  components,
  libraryComponents,
  workspaceSlug,
  initialStep,
}: Props) {
  const router = useRouter();
  const currentStep = (initialStep as Step) || 'roof-areas';

  const steps: { key: Step; label: string; number: number }[] = [
    { key: 'roof-areas', label: 'Roof Areas', number: 1 },
    { key: 'components', label: 'Components', number: 2 },
    { key: 'extras', label: 'Extras', number: 3 },
    { key: 'review', label: 'Review', number: 4 },
  ];

  function navigateToStep(step: Step) {
    router.push(`/${workspaceSlug}/quotes/${quote.id}/build?step=${step}`);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/${workspaceSlug}/quotes`}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← Back to Quotes
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 mt-2">
            {quote.customer_name}
            {quote.job_name && (
              <span className="text-lg font-normal text-slate-600 ml-2">
                — {quote.job_name}
              </span>
            )}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
              🤖 Digital Takeoff
            </span>
            <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded">
              {quote.status === 'draft' ? 'Draft' : 'Confirmed'}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 mb-6">
          <div className="flex border-b border-slate-200">
            {steps.map((step) => {
              const isActive = currentStep === step.key;
              const isPast = steps.findIndex(s => s.key === currentStep) > steps.findIndex(s => s.key === step.key);
              const isDisabled = !isPast && !isActive;

              return (
                <button
                  key={step.key}
                  onClick={() => !isDisabled && navigateToStep(step.key)}
                  disabled={isDisabled}
                  className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                      : isPast
                      ? 'text-slate-700 hover:bg-slate-50 cursor-pointer'
                      : 'text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span
                      className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : isPast
                          ? 'bg-green-500 text-white'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {isPast ? '✓' : step.number}
                    </span>
                    <span>{step.label}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {currentStep === 'roof-areas' && (
              <RoofAreasTab
                roofAreas={roofAreas}
                onNext={() => navigateToStep('components')}
              />
            )}
            {currentStep === 'components' && (
              <ComponentsTab
                components={components}
                roofAreas={roofAreas}
                onNext={() => navigateToStep('extras')}
              />
            )}
            {currentStep === 'extras' && (
              <ExtrasTab onNext={() => navigateToStep('review')} />
            )}
            {currentStep === 'review' && (
              <ReviewTab quote={quote} components={components} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Tab Components (Placeholders for now)
function RoofAreasTab({
  roofAreas,
  onNext,
}: {
  roofAreas: QuoteRoofAreaRow[];
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          <div>
            <p className="text-sm font-medium text-blue-900">
              Auto-populated from Digital Takeoff
            </p>
            <p className="text-xs text-blue-700">
              {roofAreas.length} roof area(s) created from your measurements
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {roofAreas.map((area) => (
          <div
            key={area.id}
            className="bg-white border border-slate-200 rounded-lg p-4"
          >
            <h3 className="font-semibold text-slate-900 mb-2">{area.label}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-600">Area:</span>
                <span className="ml-2 font-medium">
                  {area.manual_sqm?.toFixed(2)} m² (
                  {((area.manual_sqm || 0) * 10.764).toFixed(2)} sq ft)
                </span>
              </div>
              <div>
                <span className="text-slate-600">Status:</span>
                <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                  🔒 Locked
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-200">
        <button
          onClick={onNext}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
        >
          Next: Components →
        </button>
      </div>
    </div>
  );
}

function ComponentsTab({
  components,
  roofAreas,
  onNext,
}: {
  components: QuoteComponentRow[];
  roofAreas: QuoteRoofAreaRow[];
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          <div>
            <p className="text-sm font-medium text-blue-900">
              Auto-populated from Digital Takeoff
            </p>
            <p className="text-xs text-blue-700">
              {components.length} component(s) with measurements
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {roofAreas.map((area) => {
          const areaComps = components.filter(
            (c) => c.quote_roof_area_id === area.id
          );
          if (areaComps.length === 0) return null;

          return (
            <div key={area.id}>
              <h3 className="font-semibold text-slate-900 mb-3">{area.label}</h3>
              <div className="space-y-3">
                {areaComps.map((comp) => (
                  <div
                    key={comp.id}
                    className="bg-white border border-slate-200 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-slate-900">{comp.name}</h4>
                        <p className="text-sm text-slate-600 mt-1">
                          Value: {comp.final_value?.toFixed(2)} {comp.measurement_type === 'linear' ? 'ft' : 'units'}
                        </p>
                      </div>
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                        🔒 From Takeoff
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-200">
        <button
          onClick={onNext}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
        >
          Next: Extras →
        </button>
      </div>
    </div>
  );
}

function ExtrasTab({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-6">
      <p className="text-slate-600">Add extra components (manual entry)</p>
      <p className="text-sm text-slate-500">
        [To be implemented - manual component addition]
      </p>

      <div className="flex justify-end pt-4 border-t border-slate-200">
        <button
          onClick={onNext}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
        >
          Next: Review →
        </button>
      </div>
    </div>
  );
}

function ReviewTab({
  quote,
  components,
}: {
  quote: QuoteRow;
  components: QuoteComponentRow[];
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-900">Quote Summary</h2>
      <p className="text-slate-600">{components.length} component(s) total</p>
      <p className="text-sm text-slate-500">
        [To be implemented - totals, pricing, confirm button]
      </p>

      <div className="flex justify-end pt-4 border-t border-slate-200">
        <button className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700">
          Confirm Quote
        </button>
      </div>
    </div>
  );
}
