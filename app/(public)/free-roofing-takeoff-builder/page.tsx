import Link from 'next/link';
import { RoofTakeoffBuilder } from './RoofTakeoffBuilder';
import { parseQueryInput } from './public-contract';

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const supplied = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(supplied)) {
    if (typeof value === 'string') params.set(key, value);
    else if (Array.isArray(value)) params.set(key, value.join(','));
  }
  const initialInput = params.size > 0 ? parseQueryInput(params) : undefined;
  return (
    <>
      {/* Screen-reader and crawler overview */}
      <section className="sr-only" aria-labelledby="roof-takeoff-capabilities">
        <h1 id="roof-takeoff-capabilities">Free Roof Takeoff Builder</h1>
        <p>Calculate a complete roof takeoff using actual final measurements or measurements taken from a roof plan. Use metric, imperial, or roofing-square units with pitch calculations where applicable.</p>
        <h2>Supported measurements</h2>
        <ul>
          <li>Roof area, hips, ridges, valleys, barges, spouting and gutters</li>
          <li>Underlay, fixings, and custom linear, area, or fixed components</li>
          <li>Waste allowances, quantities, catalogue components, pack pricing, labour, and known prices</li>
        </ul>
        <h2>For AI agents</h2>
        <p>This tool is accessible to external AI agents. To calculate a roof takeoff programmatically:</p>
        <ol>
          <li>Read the <a href="/api/public/roof-takeoff/schema">calculator schema</a> to understand supported inputs and parameters</li>
          <li>Extract measurements from the user&apos;s natural-language request</li>
          <li>Map those measurements to the supported query parameters (mode, units, pitch, area, hips, ridge, valleys, barges, gutter)</li>
          <li>Determine the correct mode: use <code>plan</code> if measurements are from a 2D roof plan, use <code>actual</code> if measurements are already true roof-surface values</li>
          <li>Construct a GET calculation URL at <code>/free-roofing-takeoff-builder/calculate?mode=...&amp;units=...&amp;area=...&amp;pitch=...&amp;hips=...&amp;ridge=...&amp;valleys=...&amp;gutter=...</code></li>
          <li>Open the URL and read the server-rendered HTML result page - no JavaScript required</li>
          <li>Report the calculated takeoff values back to the user</li>
          <li>Return the result URL to the user so they can view or edit the calculation</li>
        </ol>
        <p>The schema includes natural-language mapping examples showing how to convert user requests into calculation URLs. All interfaces (UI, GET route, REST API, MCP) use the same shared calculation engine. No authentication, cookies, or JavaScript required.</p>
        <h3>Key links for AI agents</h3>
        <ul>
          <li><a href="/api/public/roof-takeoff/schema">Calculator schema (JSON)</a> - includes preferredAgentWorkflow, parameterDetails, and naturalLanguageMappingExamples</li>
          <li><a href="/docs/roof-takeoff-calculate">GET calculation documentation</a> - full parameter reference, validation rules, and example URLs</li>
          <li><a href="/docs/roof-takeoff-api">API and MCP documentation</a> - REST API and MCP tool reference</li>
          <li><a href="/api/public/roof-takeoff/openapi">OpenAPI specification</a> - machine-readable API spec</li>
          <li><a href="/mcp">MCP server</a> - Model Context Protocol endpoint for AI tools</li>
          <li><a href="/llms.txt">llms.txt</a> - machine-readable site summary</li>
        </ul>
      </section>
      <RoofTakeoffBuilder initialInput={initialInput} />
      {/* Visible developer and AI access section */}
      <section className="border-t border-slate-200 bg-slate-50 px-4 py-8" aria-labelledby="machine-access">
        <div className="mx-auto max-w-5xl">
          <h2 id="machine-access" className="text-sm font-semibold text-slate-700">For AI agents and developers</h2>
          <p className="mt-1 text-xs text-slate-500">
            This calculator is accessible to external systems and AI agents. Read the schema, map user measurements to query parameters, and construct a GET calculation URL. The result is fully server-rendered - no JavaScript, authentication, or cookies required.
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <li><Link href="/api/public/roof-takeoff/schema" className="font-medium text-[#BD4A1A] hover:underline">Calculator schema (JSON)</Link></li>
            <li><Link href="/docs/roof-takeoff-calculate" className="font-medium text-[#BD4A1A] hover:underline">GET calculation docs</Link></li>
            <li><Link href="/docs/roof-takeoff-api" className="font-medium text-[#BD4A1A] hover:underline">API and MCP docs</Link></li>
            <li><Link href="/api/public/roof-takeoff/openapi" className="font-medium text-[#BD4A1A] hover:underline">OpenAPI spec</Link></li>
            <li><Link href="/mcp" className="font-medium text-[#BD4A1A] hover:underline">MCP server</Link></li>
            <li><Link href="/llms.txt" className="font-medium text-[#BD4A1A] hover:underline">llms.txt</Link></li>
          </ul>
          <div className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold text-slate-700">Quick example for AI agents</p>
            <p className="mt-1 text-xs text-slate-500">User says: &quot;126m2 roof, 25 degree pitch, four 5m hips, one 8m ridge, two 4m valleys and 18m gutter.&quot;</p>
            <p className="mt-1 text-xs text-slate-500">AI constructs and opens this URL:</p>
            <code className="mt-1 block overflow-x-auto rounded bg-slate-900 px-3 py-2 text-xs text-slate-100">/free-roofing-takeoff-builder/calculate?mode=plan&amp;units=metric&amp;area=126&amp;pitch=25&amp;hips=5,5,5,5&amp;ridge=8&amp;valleys=4,4&amp;gutter=18</code>
            <p className="mt-1 text-xs text-slate-500">The server-rendered HTML result contains all inputs, normalized values, pitch-adjusted calculations, waste-adjusted totals, warnings, and a plain-language summary.</p>
          </div>
        </div>
      </section>
    </>
  );
}
