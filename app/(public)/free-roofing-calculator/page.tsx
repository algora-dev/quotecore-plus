import { RoofingCalculator } from './RoofingCalculator';
import Link from 'next/link';

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-6">
      {/* Hero */}
      <section className="mb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
              Free Roofing Calculator
            </h1>
            <p className="mt-2 text-sm text-slate-500 max-w-xl">
              Calculate roof pitch, rafter length, roof surface area, quantities and complex pricing.
              No signup required - works on mobile and desktop.
            </p>
          </div>
        </div>
      </section>

      {/* Calculator */}
      <RoofingCalculator />

      {/* Related tools */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold text-slate-900">Related calculators</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/free-quote-generator"
            prefetch={false}
            className="block w-full text-left p-5 bg-white border-2 border-slate-200 rounded-xl hover:border-[#FF6B35] hover:shadow-lg transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-orange-50 group-hover:bg-orange-100 transition-colors">
                <svg className="w-5 h-5 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">Free Quote Generator</p>
                <p className="text-xs text-slate-500 mt-0.5">Turn measurements into a professional quote</p>
              </div>
            </div>
          </Link>

          <Link
            href="/signup?ref=free-roofing-calculator"
            className="block w-full text-left p-5 bg-white border-2 border-slate-200 rounded-xl hover:border-[#FF6B35] hover:shadow-lg transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-orange-50 group-hover:bg-orange-100 transition-colors">
                <svg className="w-5 h-5 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">Start free trial</p>
                <p className="text-xs text-slate-500 mt-0.5">Full quoting, takeoff, and job management</p>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Tips & Knowledge */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold text-slate-900">Roofing calculation tips</h2>
        <div className="mt-4 space-y-4">
          <Tip
            title="How to measure roof pitch on-site"
            body="Use a digital level or smartphone app placed on the roof surface to get a direct degree reading. Alternatively, measure 1 metre horizontally from the roof edge, then measure the vertical rise at that point. The arctangent of rise / run gives you the pitch in degrees."
          />
          <Tip
            title="When to use rafter vs hip/valley pitch factors"
            body="Use the rafter pitch factor for simple gable or lean-to roofs where the slope runs in one direction. Use the hip/valley factor for hipped roofs where the slope changes direction — this includes the compound angle that increases the actual surface area."
          />
          <Tip
            title="Common waste percentages by material"
            body="Concrete tiles: 5-10%. Clay tiles: 10-15% (fragile, more breakage). Metal sheets: 5%. Asphalt shingles: 10-15%. Membrane: 5%. Add an extra 5% for complex roof shapes with many valleys, hips, or dormers that require numerous cuts."
          />
          <Tip
            title="Why plan area differs from actual roof area"
            body="Plan area is the footprint of the building viewed from above. A pitched roof covers more surface than the flat plan because it slopes upward. The pitch factor (1 / cos(pitch)) accounts for this difference. At 25 degrees, a 100 m² plan has about 110.3 m² of actual roofing surface."
          />
          <Tip
            title="Accounting for complex roof shapes"
            body="For roofs with multiple sections (L-shaped, T-shaped, with dormers), calculate each rectangular section separately using the same pitch, then add the areas together. For triangular sections (hips), use base × height / 2 with the pitch-adjusted height."
          />
          <Tip
            title="When to add extra material for cuts and overlaps"
            body="Beyond the standard waste percentage, add extra material for roofs with many penetrations (chimneys, skylights, vents), complex valley junctions, or when using materials that require specific overlap patterns. A rule of thumb: add 2-3 extra units per penetration or junction."
          />
        </div>
      </section>

      {/* Formula reference */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold text-slate-900">Formulas used</h2>
        <div className="mt-4 space-y-2">
          <Formula name="Rafter length" formula="rafter = (span / 2) / cos(pitch°)" />
          <Formula name="Rafter pitch factor" formula="factor = 1 / cos(pitch°)" />
          <Formula name="Hip/valley factor" formula="factor = sqrt((1/cos(pitch°))² + 1)" />
          <Formula name="Roof surface area" formula="area = plan_area × pitch_factor" />
          <Formula name="Material quantity" formula="quantity = (area × (1 + waste%)) / coverage_per_unit" />
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-12 mb-8">
        <h2 className="text-lg font-semibold text-slate-900">Frequently asked questions</h2>
        <div className="mt-4 space-y-4">
          <FAQ
            question="How do I calculate roof pitch?"
            answer="Roof pitch is measured in degrees from horizontal. Use a digital level or smartphone app on the roof surface, or measure the rise over run ratio and convert to degrees using: pitch = arctan(rise / run)."
          />
          <FAQ
            question="What is a pitch factor?"
            answer="A pitch factor converts flat plan area to actual sloped roof area. For a rafter-type roof, the factor is 1 / cos(pitch angle). At 25 degrees, the factor is approximately 1.103, meaning 100 m² of plan area has about 110.3 m² of actual roofing surface."
          />
          <FAQ
            question="How is rafter length calculated?"
            answer="Rafter length equals half the span divided by the cosine of the pitch angle. For a 10m span at 30 degrees: rafter = (10 / 2) / cos(30) = 5.77m."
          />
          <FAQ
            question="What waste percentage should I add for roofing materials?"
            answer="Typical waste percentages: concrete tiles 5-10%, clay tiles 10-15% (fragile), metal sheets 5%, asphalt shingles 10-15%, membrane 5%. Add more for complex roof shapes with many cuts."
          />
          <FAQ
            question="Is this roofing calculator free?"
            answer="Yes, completely free with no signup required. All calculations run in your browser. No data is sent anywhere."
          />
        </div>
      </section>
    </div>
  );
}

function Tip({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{body}</p>
    </div>
  );
}

function Formula({ name, formula }: { name: string; formula: string }) {
  return (
    <details className="rounded-lg border border-slate-200 bg-white">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-700 hover:text-[#FF6B35] transition select-none">
        {name}
      </summary>
      <div className="px-4 pb-3">
        <p className="text-xs text-slate-600 font-mono">{formula}</p>
      </div>
    </details>
  );
}

function FAQ({ question, answer }: { question: string; answer: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700">{question}</h3>
      <p className="mt-1 text-sm text-slate-600">{answer}</p>
    </div>
  );
}
