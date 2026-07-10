import { ConstructionCalculator } from './ConstructionCalculator';

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-6">
      {/* Hero */}
      <section className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
          Free Construction Calculator
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-500 sm:text-base">
          All-in-one roofing and construction calculator. Calculate pitch, roof area, rafter length,
          hip/valley, volume, and material quantities. No signup required — works on mobile and desktop.
        </p>
      </section>

      <ConstructionCalculator />

      {/* SEO content section */}
      <section className="mx-auto mt-16 max-w-3xl space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">How to use this calculator</h2>
          <p className="mt-2 text-sm text-slate-600">
            Select a calculator tab above, enter your measurements, and get instant results.
            Toggle between metric (m, m², m³) and imperial (ft, ft², ft³) units using the toggle
            at the top. All calculations run in your browser — no data is sent anywhere.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900">Common roofing calculations</h2>
          <p className="mt-2 text-sm text-slate-600">
            <strong>Pitch factor:</strong> The pitch factor converts a flat (plan) measurement to the
            actual sloped roof area. For a rafter-type roof at 25°, the factor is approximately 1.103,
            meaning a 100 m² plan area has ~110.3 m² of actual roofing surface.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            <strong>Rafter length:</strong> Calculated as half the span divided by the cosine of the
            pitch angle. For a 10m span at 30°, each rafter is (10/2) / cos(30°) ≈ 5.77m.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            <strong>Hip/Valley length:</strong> Uses a compound angle formula combining the roof pitch
            with the 45° hip/valley angle. The hip factor is √(rafter_factor² + 1).
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900">Turn calculations into quotes</h2>
          <p className="mt-2 text-sm text-slate-600">
            Need to turn these measurements into a professional quote for your customer?
            <a href="/free-quote-generator" className="font-medium text-[#FF6B35] hover:text-[#ff5722]">
              {' '}Try our free AI quote generator →
            </a>
            Or get the full QuoteCore+ experience with digital takeoff, component libraries, and
            branded PDF quotes.
            <a href="/signup?ref=calculator" className="font-medium text-[#FF6B35] hover:text-[#ff5722]">
              {' '}Start a 14-day free trial →
            </a>
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900">Frequently asked questions</h2>
          <div className="mt-3 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Is this calculator free?</h3>
              <p className="mt-1 text-sm text-slate-600">
                Yes, completely free with no signup required. It works entirely in your browser.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Does it work on mobile?</h3>
              <p className="mt-1 text-sm text-slate-600">
                Yes, the calculator is fully responsive and optimized for mobile use on-site.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Can I use imperial units?</h3>
              <p className="mt-1 text-sm text-slate-600">
                Yes, toggle between metric and imperial at any time. All calculators support both.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
