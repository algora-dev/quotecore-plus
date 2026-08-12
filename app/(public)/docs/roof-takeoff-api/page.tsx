import Link from 'next/link';
import { roofTakeoffSchema } from '../../free-roofing-takeoff-builder/schema';

export const metadata = {
  title: 'Roof Takeoff API and MCP Documentation',
  description: 'Use the QuoteCore+ Roof Takeoff Builder through REST, server-rendered result URLs, OpenAPI, or MCP.',
  alternates: { canonical: 'https://quote-core.com/docs/roof-takeoff-api' },
};

export default function RoofTakeoffApiDocsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <article className="mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white p-6 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#FF6B35]">Public API</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Roof Takeoff API and MCP</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{roofTakeoffSchema.description} The human builder, REST API, result page, and MCP tools all use the same calculation engine.</p>

        <section className="mt-8" aria-labelledby="api-endpoints">
          <h2 id="api-endpoints" className="text-xl font-semibold text-slate-900">Endpoints</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li><code>GET /api/public/roof-takeoff/schema</code> - <Link href="/api/public/roof-takeoff/schema" className="text-[#BD4A1A] hover:underline">View</Link></li>
            <li><code>POST /api/public/roof-takeoff/calculate</code> - POST JSON body, returns JSON result</li>
            <li><code>GET /api/public/roof-takeoff/openapi</code> - <Link href="/api/public/roof-takeoff/openapi" className="text-[#BD4A1A] hover:underline">View</Link></li>
            <li><code>GET /free-roofing-takeoff-builder/calculate</code> - server-rendered HTML result. <Link href="/docs/roof-takeoff-calculate" className="text-[#BD4A1A] hover:underline">Full documentation and examples</Link></li>
            <li><code>POST https://quote-core.com/mcp</code> - MCP server for AI tools</li>
          </ul>
        </section>

        <section className="mt-8" aria-labelledby="api-example">
          <h2 id="api-example" className="text-xl font-semibold text-slate-900">Example request</h2>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100"><code>{JSON.stringify(roofTakeoffSchema.example, null, 2)}</code></pre>
          <p className="mt-3 text-sm text-slate-600">Use <code>actual</code> for final roof measurements. Use <code>plan</code> when dimensions are plan-view measurements requiring pitch adjustment. Results are estimates and depend on supplied measurements and any published catalogue pricing.</p>
        </section>

        <section className="mt-8" aria-labelledby="mcp-tools">
          <h2 id="mcp-tools" className="text-xl font-semibold text-slate-900">MCP tools</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li><code>get_roof_takeoff_schema</code></li>
            <li><code>calculate_roof_takeoff</code></li>
            <li><code>get_calculation_result</code></li>
          </ul>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/free-roofing-takeoff-builder" className="inline-flex rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]">Open the builder</Link>
          <Link href="/api/public/roof-takeoff/schema" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">View schema JSON</Link>
        </div>
      </article>
    </main>
  );
}
