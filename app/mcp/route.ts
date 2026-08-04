import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { calculatePublicRoofTakeoff, parseQueryInput, toResultQuery } from '@/app/(public)/free-roofing-takeoff-builder/public-contract';
import { roofTakeoffSchema } from '@/app/(public)/free-roofing-takeoff-builder/schema';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';

export const dynamic = 'force-dynamic';

const inputSchema = {
  mode: z.enum(['actual', 'plan']).default('actual').describe('Use actual for final measurements or plan for plan-view measurements that need pitch adjustment.'),
  units: z.enum(['metric', 'imperial', 'squares']).default('metric'),
  pitchDegrees: z.number().min(0).max(89).default(0),
  area: z.number().positive().optional(),
  hips: z.array(z.union([z.number().positive(), z.object({ length: z.number().positive() })])).max(200).optional(),
  ridges: z.array(z.union([z.number().positive(), z.object({ length: z.number().positive() })])).max(200).optional(),
  valleys: z.array(z.union([z.number().positive(), z.object({ length: z.number().positive() })])).max(200).optional(),
  barges: z.array(z.union([z.number().positive(), z.object({ length: z.number().positive() })])).max(200).optional(),
  spouting: z.array(z.union([z.number().positive(), z.object({ length: z.number().positive() })])).max(200).optional().describe('Gutter/eaves lengths. Gutter is an accepted natural-language alias.'),
  underlay: z.number().positive().optional(),
  fixings: z.number().positive().optional(),
};

function createServer(origin: string) {
  const server = new McpServer(
    { name: 'quotecore-roof-takeoff', version: '1.0.0' },
    { instructions: 'Use get_roof_takeoff_schema when input semantics are unclear. Use calculate_roof_takeoff to calculate and return the provided resultUrl. Actual measurements are not pitch-adjusted; plan measurements are.' },
  );

  server.registerTool(
    'get_roof_takeoff_schema',
    {
      title: 'Get roof takeoff schema',
      description: 'Returns every supported Roof Takeoff Builder input, mode, unit, alias, validation rule, output, endpoint, and example.',
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => ({
      structuredContent: roofTakeoffSchema,
      content: [{ type: 'text', text: `QuoteCore+ Roof Takeoff schema version ${roofTakeoffSchema.calculationVersion}.` }],
    }),
  );

  server.registerTool(
    'calculate_roof_takeoff',
    {
      title: 'Calculate roof takeoff',
      description: 'Calculates a deterministic roof takeoff and returns structured component totals plus a QuoteCore+ URL showing the same result.',
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (input) => {
      const result = calculatePublicRoofTakeoff(input);
      if (!result.success) {
        return { isError: true, structuredContent: { ...result }, content: [{ type: 'text', text: result.errors.map((error) => `${error.field}: ${error.message}`).join('\n') }] };
      }
      if (result.status === 'needs_clarification') {
        return { isError: false, structuredContent: { ...result }, content: [{ type: 'text', text: `Clarification needed: ${result.question} (required field: ${result.requiredField})` }] };
      }
      result.resultUrl = `${origin}/free-roofing-takeoff-builder/calculate?${toResultQuery(input)}`;
      return {
        structuredContent: { ...result },
        content: [{ type: 'text', text: `Roof takeoff calculated with ${result.results.totalEntries} entries. View the same result at ${result.resultUrl}` }],
      };
    },
  );

  server.registerTool(
    'get_calculation_result',
    {
      title: 'Get calculation result',
      description: 'Reads and recalculates a QuoteCore+ roof takeoff result URL using the same versioned engine.',
      inputSchema: { resultUrl: z.string().url().describe('A QuoteCore+ /free-roofing-takeoff-builder/calculate URL.') },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ resultUrl }) => {
      const url = new URL(resultUrl);
      if (url.origin !== origin || url.pathname !== '/free-roofing-takeoff-builder/calculate') {
        return { isError: true, content: [{ type: 'text', text: 'The result URL must be a QuoteCore+ roof takeoff result URL.' }] };
      }
      const input = parseQueryInput(url.searchParams);
      const result = calculatePublicRoofTakeoff(input);
      if (result.success && result.status === 'complete') result.resultUrl = resultUrl;
      return { structuredContent: { ...result }, content: [{ type: 'text', text: `Retrieved roof takeoff result from ${resultUrl}` }] };
    },
  );

  return server;
}

async function handle(request: Request): Promise<Response> {
  const clientIp = getClientIP(request.headers);
  const allowed = await checkRateLimit(`public-roof-takeoff-mcp:${clientIp}`, 240, 60 * 60 * 1000);
  if (!allowed) {
    return Response.json({ jsonrpc: '2.0', error: { code: -32000, message: 'Too many MCP requests. Please try again later.' }, id: null }, { status: 429 });
  }

  const origin = new URL(request.url).origin;
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  const server = createServer(origin);
  await server.connect(transport);
  return transport.handleRequest(request);
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID',
    },
  });
}
