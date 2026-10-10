import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { calculatePublicRoofTakeoff, parseQueryInput, toResultQuery } from '@/app/(public)/free-roofing-takeoff-builder/public-contract';
import { roofTakeoffSchema } from '@/app/(public)/free-roofing-takeoff-builder/schema';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';

import { SERVER_INSTRUCTIONS } from '../lib/free-tools/host-roof-scan/contract';
import { exposedOnMainMcp } from '../lib/free-tools/host-roof-scan/config';
import { corsHeaders, readLimited, parseRpc, rpcError, type RpcEnvelope } from '../lib/free-tools/host-roof-scan/request';
import { ScanError } from '../lib/free-tools/host-roof-scan/types';
import { runStatelessMcp } from '../lib/free-tools/mcp/transport';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

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

async function createServer(origin: string, withHostOutline: boolean) {
  const server = new McpServer(
    { name: 'quotecore-roof-takeoff', version: '1.0.0' },
    { instructions: 'Use get_roof_takeoff_schema when input semantics are unclear. Use calculate_roof_takeoff to calculate and return the provided resultUrl. Actual measurements are not pitch-adjusted; plan measurements are.' + (withHostOutline ? ' ' + SERVER_INSTRUCTIONS : '') },
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

  if (withHostOutline) {
    // Do not load Sharp, storage or experimental SDK registration when the flag is off.
    const { registerHostOutlineTools } = await import('../lib/free-tools/host-roof-scan/registration');
    const { runtimeService } = await import('../lib/free-tools/host-roof-scan/runtime');
    registerHostOutlineTools(server, runtimeService);
  }
  return server;
}


async function handle(request: Request): Promise<Response> {
  let rpc: RpcEnvelope | undefined;
  try {
    // Keep the existing distributed namespace and budget for the existing endpoint.
    const clientIp = getClientIP(request.headers);
    const allowed = await checkRateLimit(`public-roof-takeoff-mcp:${clientIp}`, 240, 60 * 60 * 1000);
    if (!allowed) throw new ScanError('RATE_LIMIT', 'Too many MCP requests. Please try again later.', 429);
    if (request.method !== 'POST')
      return new Response(null, { status: 405, headers: { ...corsHeaders, Allow: 'POST, OPTIONS' } });
    if ((request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase() !== 'application/json')
      throw new ScanError('CONTENT_TYPE', 'MCP requests must use application/json.', 415);
    const body = await readLimited(request);
    rpc = parseRpc(body);
    const withHostOutline = exposedOnMainMcp();
    if (withHostOutline) {
      const { guardHostOutlineRpc, isHostOutlineRpc } = await import('../lib/free-tools/host-roof-scan/runtime');
      if (isHostOutlineRpc(rpc)) await guardHostOutlineRpc(request, rpc);
    }
    // Existing deterministic result URLs retain their original request-origin semantics.
    // Private scan/review URLs use only QC_HOST_SCAN_ORIGIN, never a request header.
    const server = await createServer(new URL(request.url).origin, withHostOutline);
    return await runStatelessMcp(request, body, server);
  } catch (error) { return rpcError(error, rpc?.id); }
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
export function OPTIONS() { return new Response(null, { status: 204, headers: corsHeaders }); }
