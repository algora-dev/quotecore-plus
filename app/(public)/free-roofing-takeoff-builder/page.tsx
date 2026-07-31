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
      <section className="sr-only" aria-labelledby="roof-takeoff-capabilities">
        <h1 id="roof-takeoff-capabilities">Free Roof Takeoff Builder</h1>
        <p>Calculate a complete roof takeoff using actual final measurements or measurements taken from a roof plan. Use metric, imperial, or roofing-square units with pitch calculations where applicable.</p>
        <h2>Supported measurements</h2>
        <ul>
          <li>Roof area, hips, ridges, valleys, barges, spouting and gutters</li>
          <li>Underlay, fixings, and custom linear, area, or fixed components</li>
          <li>Waste allowances, quantities, catalogue components, pack pricing, labour, and known prices</li>
        </ul>
        <h2>Machine-accessible interfaces</h2>
        <p>This tool is accessible to AI agents and external systems via the following endpoints, all using the same shared calculation engine:</p>
        <ul>
          <li><a href="/docs/roof-takeoff-api">API documentation</a> - REST API and MCP reference</li>
          <li><a href="/api/public/roof-takeoff/schema">Schema endpoint</a> - JSON schema for calculation inputs and outputs</li>
          <li><a href="/docs/roof-takeoff-calculate">GET calculation documentation</a> - server-rendered calculation via URL query parameters</li>
          <li><a href="/api/public/roof-takeoff/openapi">OpenAPI specification</a> - machine-readable API spec</li>
          <li><a href="/mcp">MCP server</a> - Model Context Protocol endpoint for AI tools</li>
        </ul>
        <p>No signup is required. The public API and MCP server use the same calculation engine as this human-facing builder.</p>
      </section>
      <RoofTakeoffBuilder initialInput={initialInput} />
      <section className="border-t border-slate-200 bg-slate-50 px-4 py-8" aria-labelledby="machine-access">
        <div className="mx-auto max-w-5xl">
          <h2 id="machine-access" className="text-sm font-semibold text-slate-700">Developer and AI access</h2>
          <p className="mt-1 text-xs text-slate-500">This calculator is accessible to external systems and AI agents. All interfaces use the same calculation engine.</p>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <li><Link href="/docs/roof-takeoff-api" className="font-medium text-[#BD4A1A] hover:underline">API documentation</Link></li>
            <li><Link href="/docs/roof-takeoff-calculate" className="font-medium text-[#BD4A1A] hover:underline">GET calculation docs</Link></li>
            <li><Link href="/api/public/roof-takeoff/schema" className="font-medium text-[#BD4A1A] hover:underline">Schema endpoint</Link></li>
            <li><Link href="/api/public/roof-takeoff/openapi" className="font-medium text-[#BD4A1A] hover:underline">OpenAPI spec</Link></li>
            <li><Link href="/mcp" className="font-medium text-[#BD4A1A] hover:underline">MCP server</Link></li>
            <li><Link href="/llms.txt" className="font-medium text-[#BD4A1A] hover:underline">llms.txt</Link></li>
          </ul>
        </div>
      </section>
    </>
  );
}
