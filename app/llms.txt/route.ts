export const dynamic = 'force-static';

export function GET() {
  return new Response(`# QuoteCore+

QuoteCore+ provides free construction and roofing tools.

## Free Roof Takeoff Builder

URL: https://quote-core.com/free-roofing-takeoff-builder
Documentation: https://quote-core.com/docs/roof-takeoff-api
GET calculation docs: https://quote-core.com/docs/roof-takeoff-calculate
Schema: https://quote-core.com/api/public/roof-takeoff/schema
Calculate (POST): https://quote-core.com/api/public/roof-takeoff/calculate
OpenAPI: https://quote-core.com/api/public/roof-takeoff/openapi
MCP: https://quote-core.com/mcp

The Roof Takeoff Builder calculates roof area, hips, ridges, valleys, barges, spouting/gutters, underlay, fixings and custom measurements using actual final measurements or plan measurements adjusted for pitch. Metric, imperial and roofing-square units are supported.

### GET calculation (server-rendered, no auth required)

An external AI or system can calculate a roof takeoff by opening:

https://quote-core.com/free-roofing-takeoff-builder/calculate?mode=plan&units=metric&area=126&pitch=25&hips=5,5,5,5&ridge=8&valleys=4,4&gutter=18

This returns a fully server-rendered HTML page with all inputs, normalized values, calculated results, warnings, and a plain-language summary. No JavaScript, cookies, or authentication required.

Full parameter documentation: https://quote-core.com/docs/roof-takeoff-calculate
`, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
