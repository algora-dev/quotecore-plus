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

        <section className="mt-8" aria-labelledby="agent-workflow">
          <h2 id="agent-workflow" className="text-xl font-semibold text-slate-900">AI agent workflow</h2>
          <p className="mt-2 text-sm text-slate-600">An external AI agent can calculate a roof takeoff by following these steps:</p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
            <li>Read the <Link href="/api/public/roof-takeoff/schema" className="text-[#BD4A1A] hover:underline">calculator schema</Link> to understand supported inputs</li>
            <li>Extract measurements from the user&apos;s natural-language request</li>
            <li>Map measurements to query parameters (mode, units, pitch, area, hips, ridge, valleys, barges, gutter)</li>
            <li>Determine mode: <code>plan</code> if from a 2D roof plan, <code>actual</code> if already sloped/real measurements</li>
            <li>Construct the GET calculation URL</li>
            <li>Open the URL and read the server-rendered HTML result (no JavaScript required)</li>
            <li>Report the calculated values back to the user</li>
            <li>Return the result URL so the user can view or edit</li>
          </ol>
        </section>

        <section className="mt-8" aria-labelledby="nl-mapping">
          <h2 id="nl-mapping" className="text-xl font-semibold text-slate-900">Natural-language mapping examples</h2>
          <p className="mt-2 text-sm text-slate-600">How to map a user&apos;s natural-language request to calculation URL parameters.</p>

          <div className="mt-4 space-y-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">User says:</p>
              <p className="mt-1 text-sm text-slate-600">&quot;126m2 roof, 25 degree pitch, four 5m hips, one 8m ridge, two 4m valleys and 18m gutter.&quot;</p>
              <p className="mt-3 text-xs font-semibold text-slate-500">Mapped to:</p>
              <pre className="mt-1 overflow-x-auto rounded bg-slate-900 p-2 text-xs text-slate-100"><code>mode=plan, units=metric, area=126, pitch=25, hips=5,5,5,5, ridge=8, valleys=4,4, gutter=18</code></pre>
              <p className="mt-3 text-xs font-semibold text-slate-500">Calculation URL:</p>
              <pre className="mt-1 overflow-x-auto rounded bg-slate-900 p-2 text-xs text-slate-100"><code>/free-roofing-takeoff-builder/calculate?mode=plan&amp;units=metric&amp;area=126&amp;pitch=25&amp;hips=5,5,5,5&amp;ridge=8&amp;valleys=4,4&amp;gutter=18</code></pre>
              <Link href="/free-roofing-takeoff-builder/calculate?mode=plan&units=metric&area=126&pitch=25&hips=5,5,5,5&ridge=8&valleys=4,4&gutter=18" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#BD4A1A] hover:underline">
                Open result <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">User says:</p>
              <p className="mt-1 text-sm text-slate-600">&quot;150m2 roof at 35 degrees with four 4m hips, two 3m valleys, two 2.5m barges and one 5m ridge.&quot;</p>
              <p className="mt-3 text-xs font-semibold text-slate-500">Mapped to:</p>
              <pre className="mt-1 overflow-x-auto rounded bg-slate-900 p-2 text-xs text-slate-100"><code>mode=plan, units=metric, area=150, pitch=35, hips=4,4,4,4, valleys=3,3, barges=2.5,2.5, ridge=5</code></pre>
              <p className="mt-3 text-xs font-semibold text-slate-500">Calculation URL:</p>
              <pre className="mt-1 overflow-x-auto rounded bg-slate-900 p-2 text-xs text-slate-100"><code>/free-roofing-takeoff-builder/calculate?mode=plan&amp;units=metric&amp;area=150&amp;pitch=35&amp;hips=4,4,4,4&amp;valleys=3,3&amp;barges=2.5,2.5&amp;ridge=5</code></pre>
              <Link href="/free-roofing-takeoff-builder/calculate?mode=plan&units=metric&area=150&pitch=35&hips=4,4,4,4&valleys=3,3&barges=2.5,2.5&ridge=5" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#BD4A1A] hover:underline">
                Open result <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">User says:</p>
              <p className="mt-1 text-sm text-slate-600">&quot;Actual roof measurements: 200 square metres, 10m ridge, 22m hips, 12m valleys, 30m spouting. Pitch is 30 degrees but these are already sloped.&quot;</p>
              <p className="mt-3 text-xs font-semibold text-slate-500">Mapped to (note: mode=actual because measurements are already sloped):</p>
              <pre className="mt-1 overflow-x-auto rounded bg-slate-900 p-2 text-xs text-slate-100"><code>mode=actual, units=metric, area=200, pitch=30, hips=22, ridge=10, valleys=12, gutter=30</code></pre>
              <p className="mt-3 text-xs font-semibold text-slate-500">Calculation URL:</p>
              <pre className="mt-1 overflow-x-auto rounded bg-slate-900 p-2 text-xs text-slate-100"><code>/free-roofing-takeoff-builder/calculate?mode=actual&amp;units=metric&amp;area=200&amp;pitch=30&amp;hips=22&amp;ridge=10&amp;valleys=12&amp;gutter=30</code></pre>
              <Link href="/free-roofing-takeoff-builder/calculate?mode=actual&units=metric&area=200&pitch=30&hips=22&ridge=10&valleys=12&gutter=30" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#BD4A1A] hover:underline">
                Open result <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>
          </div>
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
            <li>JSON-LD structured data embedded in the page containing all inputs, outputs, calculator name, units, calculation version, and canonical result URL</li>
            <li>The canonical <code>resultUrl</code> displayed on the page for easy copying</li>
            <li>Links to edit the calculation in the builder or start a new one</li>
          </ul>
          <p className="mt-3 text-sm text-slate-600">The page is <code>noindex</code> (not indexed by search engines) but <code>follow</code> (links are followed). Result URLs are shareable and require no authentication.</p>
          <p className="mt-3 text-sm text-slate-600">The GET <code>/calculate</code> route redirects to a stable result URL at <code>/free-roofing-takeoff-builder/result/[token]</code>. This stable URL is deterministic - the same inputs always produce the same token. AI agents should return this stable URL to users.</p>
        </section>

        <section className="mt-8" aria-labelledby="result-url-guidance">
          <h2 id="result-url-guidance" className="text-xl font-semibold text-slate-900">Canonical result URL guidance</h2>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Rule</p>
            <p className="mt-1 text-sm text-slate-600">Return the exact <code>resultUrl</code> supplied by QuoteCore. Do not reconstruct, re-encode, decode, shorten, add tracking parameters to, or otherwise alter it.</p>
          </div>
          <p className="mt-3 text-sm text-slate-600">Every calculation response includes a canonical <code>resultUrl</code> field:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>In the JSON API response, <code>resultUrl</code> is a top-level field</li>
            <li>On the HTML result page, the canonical URL is displayed in a visible box and in JSON-LD structured data</li>
            <li>The URL points to <code>/free-roofing-takeoff-builder/result/[token]</code> - a stable, shareable page</li>
            <li>The same inputs always produce the same token, so the URL is deterministic</li>
          </ul>
          <p className="mt-3 text-sm font-semibold text-slate-900">Preferred AI workflow:</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
            <li>Submit calculation inputs via POST API or GET calculation URL</li>
            <li>Receive the response containing <code>resultUrl</code></li>
            <li>Return <code>resultUrl</code> to the user exactly as provided by the server</li>
          </ol>
          <p className="mt-3 text-sm text-slate-600">Do not build result URLs from scratch. The server generates them. Copy and return them unchanged.</p>
        </section>

        <section className="mt-8" aria-labelledby="url-encoding">
          <h2 id="url-encoding" className="text-xl font-semibold text-slate-900">URL encoding rules</h2>
          <p className="mt-2 text-sm text-slate-600">When constructing GET calculation URLs, only individual parameter <strong>values</strong> should be URL-encoded. The query-string separators must never be encoded.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-semibold text-green-800">Correct</p>
              <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-2 text-xs text-slate-100"><code>?area=150&amp;hips=4%2C4%2C4%2C4&amp;pitch=35</code></pre>
              <p className="mt-2 text-xs text-green-700">Separators (?, &amp;, =) are raw. Commas in values are encoded as %2C.</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800">Incorrect</p>
              <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-2 text-xs text-slate-100"><code>?area=150%26hips%3D4%2C4%2C4%2C4%26pitch%3D35</code></pre>
              <p className="mt-2 text-xs text-red-700">Separators are encoded (%26 = &amp;, %3D = =). This will not work.</p>
            </div>
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Commas within values (e.g. <code>hips=5,5,5,5</code>) can be encoded as <code>%2C</code> in strict contexts, but raw commas also work in practice</li>
            <li>The <code>?</code> that starts the query string must never be encoded</li>
            <li>The <code>&amp;</code> that separates parameters must never be encoded</li>
            <li>The <code>=</code> that separates key from value must never be encoded</li>
            <li>Numerical values (<code>area=150</code>, <code>pitch=35</code>) need no encoding</li>
          </ul>
        </section>

        <section className="mt-8" aria-labelledby="stable-result-route">
          <h2 id="stable-result-route" className="text-xl font-semibold text-slate-900">Stable result route</h2>
          <p className="mt-2 text-sm text-slate-600">Every calculation produces a stable result URL at:</p>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100"><code>/free-roofing-takeoff-builder/result/[token]</code></pre>
          <p className="mt-2 text-sm text-slate-600">The token is a signed, deterministic encoding of the calculation inputs. The same inputs always produce the same token, so the URL is stable and shareable. The result page:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Displays the full server-rendered result (no JavaScript required)</li>
            <li>Contains all normalized inputs and calculated outputs</li>
            <li>Includes an "Edit this calculation" link with inputs prefilled</li>
            <li>Contains JSON-LD structured data for machine consumption</li>
            <li>Shows the canonical result URL for easy copying</li>
            <li>Requires no login, cookies, or authentication</li>
          </ul>
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
