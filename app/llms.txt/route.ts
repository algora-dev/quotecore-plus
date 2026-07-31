export const dynamic = 'force-static';

export function GET() {
  return new Response(`# QuoteCore+

QuoteCore+ provides free construction and roofing tools.

## Free Roof Takeoff Builder

URL: https://quote-core.com/free-roofing-takeoff-builder
Documentation: https://quote-core.com/docs/roof-takeoff-api
Schema: https://quote-core.com/api/public/roof-takeoff/schema
Calculate: https://quote-core.com/api/public/roof-takeoff/calculate
OpenAPI: https://quote-core.com/api/public/roof-takeoff/openapi
MCP: https://quote-core.com/mcp

The Roof Takeoff Builder calculates roof area, hips, ridges, valleys, barges, spouting/gutters, underlay, fixings and custom measurements using actual final measurements or plan measurements adjusted for pitch. Metric, imperial and roofing-square units are supported.
`, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
