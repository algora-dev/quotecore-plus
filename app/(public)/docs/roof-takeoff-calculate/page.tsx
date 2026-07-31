import Link from 'next/link';

export const metadata = {
  title: 'GET Calculation API - Roof Takeoff Builder | QuoteCore+',
  description: 'Server-rendered roof takeoff calculation via URL query parameters. No authentication, cookies, or JavaScript required.',
  robots: { index: true, follow: true },
};

export default function RoofTakeoffCalculateDocsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <article className="mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white p-6 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#FF6B35]">Public API</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">GET Calculation API</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Calculate a roof takeoff by opening a URL with query parameters. The result is a fully server-rendered HTML page containing all supplied inputs, normalized values, calculated results, warnings, and a plain-language summary. No authentication, cookies, localStorage, CAPTCHA, or JavaScript is required.
        </p>

        <section className="mt-8" aria-labelledby="endpoint">
          <h2 id="endpoint" className="text-xl font-semibold text-slate-900">Endpoint</h2>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100"><code>GET /free-roofing-takeoff-builder/calculate</code></pre>
          <p className="mt-2 text-sm text-slate-600">All parameters are passed as URL query parameters. The page returns server-rendered HTML. An external AI or system with only normal web access can construct this URL and read the result.</p>
        </section>

        <section className="mt-8" aria-labelledby="parameters">
          <h2 id="parameters" className="text-xl font-semibold text-slate-900">Query parameters</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="pb-2 pr-4 font-semibold text-slate-700">Parameter</th>
                  <th className="pb-2 pr-4 font-semibold text-slate-700">Aliases</th>
                  <th className="pb-2 pr-4 font-semibold text-slate-700">Type</th>
                  <th className="pb-2 pr-4 font-semibold text-slate-700">Required</th>
                  <th className="pb-2 font-semibold text-slate-700">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs text-slate-900">mode</td>
                  <td className="py-2 pr-4 text-xs text-slate-500">-</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">string</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">No (default: actual)</td>
                  <td className="py-2 text-xs text-slate-600">Measurement mode. <code>actual</code> = final measurements, <code>plan</code> = plan-view dimensions adjusted for pitch.</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs text-slate-900">units</td>
                  <td className="py-2 pr-4 text-xs text-slate-500">-</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">string</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">No (default: metric)</td>
                  <td className="py-2 text-xs text-slate-600">Unit system: <code>metric</code> (m, m2), <code>imperial</code> (ft, sq ft), or <code>squares</code> (ft, roofing squares).</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs text-slate-900">pitch</td>
                  <td className="py-2 pr-4 text-xs text-slate-500">pitchDegrees</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">number</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">No (default: 0)</td>
                  <td className="py-2 text-xs text-slate-600">Roof pitch in degrees. Range: 0-89. Required for plan mode to calculate sloped lengths.</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs text-slate-900">area</td>
                  <td className="py-2 pr-4 text-xs text-slate-500">roofArea</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">number</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">No</td>
                  <td className="py-2 text-xs text-slate-600">Total roof area. In plan mode, this is the plan-view area (pitch-adjusted).</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs text-slate-900">hips</td>
                  <td className="py-2 pr-4 text-xs text-slate-500">hip</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">comma-separated numbers</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">No</td>
                  <td className="py-2 text-xs text-slate-600">Hip lengths. Example: <code>hips=5,5,5,5</code> for four 5m hips. Max 200 entries.</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs text-slate-900">ridge</td>
                  <td className="py-2 pr-4 text-xs text-slate-500">ridges</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">comma-separated numbers</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">No</td>
                  <td className="py-2 text-xs text-slate-600">Ridge lengths. Example: <code>ridge=8</code> for one 8m ridge. Max 200 entries.</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs text-slate-900">valleys</td>
                  <td className="py-2 pr-4 text-xs text-slate-500">valley</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">comma-separated numbers</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">No</td>
                  <td className="py-2 text-xs text-slate-600">Valley lengths. Example: <code>valleys=4,4</code> for two 4m valleys. Max 200 entries.</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs text-slate-900">barges</td>
                  <td className="py-2 pr-4 text-xs text-slate-500">barge</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">comma-separated numbers</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">No</td>
                  <td className="py-2 text-xs text-slate-600">Barge board lengths. Max 200 entries.</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs text-slate-900">gutter</td>
                  <td className="py-2 pr-4 text-xs text-slate-500">spouting, gutters</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">comma-separated numbers</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">No</td>
                  <td className="py-2 text-xs text-slate-600">Gutter/spouting lengths. Max 200 entries.</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs text-slate-900">underlay</td>
                  <td className="py-2 pr-4 text-xs text-slate-500">-</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">number</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">No</td>
                  <td className="py-2 text-xs text-slate-600">Underlay area.</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs text-slate-900">fixings</td>
                  <td className="py-2 pr-4 text-xs text-slate-500">-</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">number</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">No</td>
                  <td className="py-2 text-xs text-slate-600">Fixings area.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8" aria-labelledby="validation">
          <h2 id="validation" className="text-xl font-semibold text-slate-900">Validation rules</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>All measurement values must be positive finite numbers.</li>
            <li>Pitch must be between 0 and 89 degrees.</li>
            <li>Mode must be <code>actual</code> or <code>plan</code>.</li>
            <li>Units must be <code>metric</code>, <code>imperial</code>, or <code>squares</code>.</li>
            <li>Array parameters accept at most 200 entries each.</li>
            <li>If no area or linear measurements are supplied, the result page returns 404.</li>
          </ul>
        </section>

        <section className="mt-8" aria-labelledby="examples">
          <h2 id="examples" className="text-xl font-semibold text-slate-900">Example URLs</h2>

          <div className="mt-4 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Example 1: Plan mode, metric, 25 degree pitch</h3>
              <p className="mt-1 text-xs text-slate-500">126m2 roof with 25 degree pitch, four 5m hips, one 8m ridge, two 4m valleys, 18m gutter.</p>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100"><code>/free-roofing-takeoff-builder/calculate?mode=plan&amp;units=metric&amp;area=126&amp;pitch=25&amp;hips=5,5,5,5&amp;ridge=8&amp;valleys=4,4&amp;gutter=18</code></pre>
              <Link href="/free-roofing-takeoff-builder/calculate?mode=plan&units=metric&area=126&pitch=25&hips=5,5,5,5&ridge=8&valleys=4,4&gutter=18" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#BD4A1A] hover:underline">
                Open this result <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900">Example 2: Actual mode, metric</h3>
              <p className="mt-1 text-xs text-slate-500">Actual measurements - 150m2 roof with 10m ridge, 20m hips, 12m valleys, 25m gutter.</p>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100"><code>/free-roofing-takeoff-builder/calculate?mode=actual&amp;units=metric&amp;area=150&amp;pitch=30&amp;hips=10,10&amp;ridge=10&amp;valleys=6,6&amp;gutter=25</code></pre>
              <Link href="/free-roofing-takeoff-builder/calculate?mode=actual&units=metric&area=150&pitch=30&hips=10,10&ridge=10&valleys=6,6&gutter=25" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#BD4A1A] hover:underline">
                Open this result <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900">Example 3: Plan mode, imperial, 35 degree pitch</h3>
              <p className="mt-1 text-xs text-slate-500">Imperial units - 1600 sq ft roof at 35 degree pitch with hips and ridges.</p>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100"><code>/free-roofing-takeoff-builder/calculate?mode=plan&amp;units=imperial&amp;area=1600&amp;pitch=35&amp;hips=16,14,12,10&amp;ridge=28&amp;gutter=60</code></pre>
              <Link href="/free-roofing-takeoff-builder/calculate?mode=plan&units=imperial&area=1600&pitch=35&hips=16,14,12,10&ridge=28&gutter=60" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#BD4A1A] hover:underline">
                Open this result <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-8" aria-labelledby="response">
          <h2 id="response" className="text-xl font-semibold text-slate-900">Response format</h2>
          <p className="mt-2 text-sm text-slate-600">The response is a server-rendered HTML page containing:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>All supplied inputs with their values and units</li>
            <li>Normalized values (how inputs were parsed before calculation)</li>
            <li>Complete takeoff results per component (raw total, waste-adjusted total, waste percent, unit)</li>
            <li>Material and labour totals (when catalogue pricing is available)</li>
            <li>Warnings and notes</li>
            <li>A plain-language summary readable by screen readers and AI crawlers</li>
            <li>Links to edit the calculation in the builder or start a new one</li>
          </ul>
          <p className="mt-3 text-sm text-slate-600">The page is <code>noindex</code> (not indexed by search engines) but <code>follow</code> (links are followed). Result URLs are shareable and require no authentication.</p>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/free-roofing-takeoff-builder" className="inline-flex rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]">Open the builder</Link>
          <Link href="/docs/roof-takeoff-api" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">REST API and MCP docs</Link>
          <Link href="/api/public/roof-takeoff/schema" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">View schema JSON</Link>
        </div>
      </article>
    </main>
  );
}
