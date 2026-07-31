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
        <p>No signup is required. The public API and MCP server use the same calculation engine as this human-facing builder.</p>
      </section>
      <RoofTakeoffBuilder initialInput={initialInput} />
    </>
  );
}
