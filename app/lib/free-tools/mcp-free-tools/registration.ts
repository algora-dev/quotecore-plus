import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getAdvice } from '@/app/(public)/free-tools/finder-advice';
import { buildConvertUrl, type ConvertibleLine } from '@/app/(public)/shared/convertLines';
import { calculate, type CurrencyCode, type DocumentKind } from '@/app/(public)/shared/document-generator/document-model';
import { ScanError } from '../host-roof-scan/types';
import type { FreeToolsMcpService } from './service';
import type { TakeoffTrade, UnitSystem } from './types';
import { recommendedMcpAction } from './routing-actions';
import { FREE_TOOLS_LAUNCHER_URI, freeToolsLauncherHtml } from './launcher';

const fileParam = z.object({
  download_url: z.string().max(8192),
  file_id: z.string().max(512),
  mime_type: z.string().max(100).optional(),
  file_name: z.string().max(255).optional(),
}).strict();
const normalizedPoint = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict();
const sourceOutline = z.object({
  name: z.string().max(80).optional(),
  points: z.array(normalizedPoint).min(3).max(160),
  notes: z.array(z.string().max(240)).max(6).optional(),
}).strict();
const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const noAuth = [{ type: 'noauth' as const }];
const launcherMeta = {
  ui: { resourceUri: FREE_TOOLS_LAUNCHER_URI, visibility: ['model', 'app'] as const },
  'openai/outputTemplate': FREE_TOOLS_LAUNCHER_URI,
};


function absolute(origin: string, path: string): string { return new URL(path, origin).href; }
function message(error: unknown): string { return error instanceof Error ? error.message : 'QuoteCore+ could not complete this request.'; }
function code(error: unknown): string { return error instanceof ScanError ? error.code : 'UNEXPECTED_ERROR'; }

async function startTakeoff(
  service: FreeToolsMcpService,
  trade: TakeoffTrade,
  args: { plan: unknown; unitSystem?: UnitSystem; source_outline?: unknown },
) {
  try {
    const result = await service.startTakeoff({ plan: args.plan, trade, unitSystem: args.unitSystem, sourceOutline: args.source_outline });
    const wording = result.hasSuggestedOutline
      ? 'The attached plan is ready in the real QuoteCore+ takeoff workstation with an unverified exterior outline suggestion. Calibrate, review and correct that outline first. After it is saved, choose either AI scan for components (live scans 2+3 on the corrected outline) or continue measuring components manually.'
      : trade === 'roofing'
        ? 'The attached plan is ready in the real QuoteCore+ roof takeoff workstation. Calibrate it, then draw or scan the exterior outline. After the outline is saved, choose AI component scan or manual component measurement.'
        : 'The attached plan is ready in the real QuoteCore+ takeoff workstation. Calibrate the plan before measuring.';
    return {
      structuredContent: { status: 'ready', trade, hasSuggestedOutline: result.hasSuggestedOutline, resultUrl: result.resultUrl },
      content: [{ type: 'text' as const, text: `${wording} Open ${result.resultUrl}` }],
    };
  } catch (error) {
    return { isError: true, structuredContent: { status: 'error', code: code(error), message: message(error) }, content: [{ type: 'text' as const, text: message(error) }] };
  }
}

function takeoffDescription(trade: TakeoffTrade): string {
  if (trade === 'roofing') return 'Starts the real QuoteCore+ roof takeoff workstation from a ChatGPT-attached PNG/JPEG/WebP image or PDF plan. PDF page selection happens in QuoteCore+ before measurement. If you can clearly see one exterior roof boundary in that SAME attachment, include source_outline in normalized 0..1 full-image coordinates; do not infer scale, pitch or internal components. The outline is only a suggestion: the user calibrates, reviews and can edit it in the existing two-phase takeoff UX. After saving the corrected outline they can either measure components manually or run QuoteCore+ AI scans 2+3 to propose the internal roof components for review.';
  if (trade === 'cladding') return 'Starts the real QuoteCore+ wall/cladding takeoff workstation from a ChatGPT-attached PNG/JPEG/WebP image or PDF elevation/plan. PDF page selection happens in QuoteCore+ before measurement. QuoteCore+ does not infer wall components here; the user calibrates and measures in the shared workstation.';
  return 'Starts the real QuoteCore+ flooring takeoff workstation from a ChatGPT-attached PNG/JPEG/WebP image or PDF floor plan. PDF page selection happens in QuoteCore+ before measurement. QuoteCore+ does not infer flooring components here; the user calibrates and measures in the shared workstation.';
}

const lineInput = z.object({
  description: z.string().max(8000),
  qty: z.number().min(0).max(1e12),
  unit: z.string().max(40).default('pcs'),
  rate: z.number().min(-1e12).max(1e12),
}).strict();
const currencyInput = z.enum(['GBP', 'USD', 'EUR', 'AUD', 'CAD', 'NZD']).default('GBP');
const measurementPrefill = z.object({
  componentName: z.string().min(1).max(120).describe('What is being measured, for example Roof Area, Ridge, Valley, Spouting, Building Wrap, Skirting or Carpet.'),
  measurementType: z.enum(['area', 'lineal', 'quantity']).optional().describe('Supply this for unfamiliar/custom component names. Common construction component names can be inferred.'),
  value: z.number().positive().max(1e12).describe('Measurement value in the selected unit system. Areas use m²/ft²/squares, lineal uses m/ft, quantities use count.'),
  areaName: z.string().max(160).optional().describe('Optional roof area, elevation, room or zone name used to group this measurement.'),
  label: z.string().max(160).optional().describe('Optional human-readable note for this individual measurement.'),
  repeat: z.number().int().min(1).max(100000).optional().describe('Number of identical repeats. Defaults to 1.'),
  basis: z.enum(['actual', 'plan']).optional().describe('Roofing only: actual means already measured on slope; plan means a flat-plan length/area that may need pitch adjustment.'),
  pitchDegrees: z.number().min(0).max(89.999).optional().describe('Roofing only. Use only when the measurement basis is plan and the user supplied a known pitch.'),
}).strict();

function documentUrl(origin: string, kind: DocumentKind, args: {
  lines: ConvertibleLine[]; recipientName?: string; currency: CurrencyCode; taxEnabled: boolean; taxRate: number; taxName: string;
}) {
  const targetPath = kind === 'quote' ? '/free-quote-generator' : kind === 'invoice' ? '/free-invoice-generator' : '/free-purchase-order-generator';
  const totals = calculate({ lines: args.lines.map((line, i) => ({ ...line, id: `mcp-${i}`, lineHidden: false })), taxEnabled: args.taxEnabled, taxRate: args.taxRate });
  const base = buildConvertUrl({ targetPath, amount: totals.total, clientName: kind === 'order' ? undefined : args.recipientName, lines: args.lines, ref: 'chatgpt-mcp' });
  const url = new URL(base, origin);
  if (kind === 'order' && args.recipientName) url.searchParams.set('supplier', args.recipientName);
  url.searchParams.set('currency', args.currency);
  url.searchParams.set('taxEnabled', String(args.taxEnabled));
  url.searchParams.set('taxRate', String(args.taxRate));
  url.searchParams.set('taxName', args.taxName);
  if (url.href.length > 16000) throw new ScanError('DOCUMENT_TOO_LARGE', 'This draft is too large for a safe prefilled URL. Reduce the number or size of line items, then retry.');
  return { resultUrl: url.href, totals };
}

export const FREE_TOOLS_MCP_TOOL_NAMES = [
  'find_quotecore_tool', 'start_roof_takeoff', 'start_cladding_takeoff', 'start_flooring_takeoff',
  'start_measurements_to_pricing', 'create_quote', 'create_invoice', 'create_purchase_order',
] as const;

export function registerFreeToolsMcpTools(server: McpServer, origin: string, getService: () => FreeToolsMcpService): void {
  server.registerResource('quotecore-free-tools-launcher', FREE_TOOLS_LAUNCHER_URI, {
    mimeType: 'text/html;profile=mcp-app',
    description: 'Compact QuoteCore+ action card for opening a prepared free-tool workflow.',
  }, async (uri) => ({
    contents: [{
      uri: uri.href,
      mimeType: 'text/html;profile=mcp-app',
      text: freeToolsLauncherHtml(),
      _meta: {
        ui: { prefersBorder: true, domain: origin, csp: { connectDomains: [], resourceDomains: [] } },
        'openai/widgetDescription': 'A compact QuoteCore+ card that opens the prepared takeoff, pricing or document workflow.',
        'openai/widgetCSP': { connect_domains: [], resource_domains: [], redirect_domains: [origin] },
        'openai/ui': { availableDisplayModes: ['inline'] },
      },
    }],
  }));

  server.registerTool('find_quotecore_tool', {
    title: 'Find the right QuoteCore+ free tool',
    description: 'Uses the same deterministic Free Tools router as quote-core.com to recommend or clarify the correct measurement, specialist calculator, pricing or document workflow. Use this for ambiguous jobs, for calculator discovery, or when the user asks which QuoteCore+ tool to use. Skip it when a directly exposed MCP action already matches a clear measurement, pricing or document request.',
    inputSchema: { query: z.string().min(1).max(300) }, annotations, _meta: { ...launcherMeta, securitySchemes: noAuth },
  }, async ({ query }) => {
    const advice = getAdvice(query);
    if (advice.kind === 'clarify') return { structuredContent: advice, content: [{ type: 'text', text: `${advice.message} ${advice.choices.map(c => c.label).join(' / ')}` }] };
    if (advice.kind === 'none') return { structuredContent: advice, content: [{ type: 'text', text: advice.message }] };
    const tools = advice.tools.map(tool => ({ id: tool.id, name: tool.name, description: tool.shortDescription, url: absolute(origin, tool.url), action: recommendedMcpAction(tool.id) }));
    return { structuredContent: { kind: 'match', confident: advice.confident, message: advice.message, tools }, content: [{ type: 'text', text: `${advice.message} ${tools.map(tool => `${tool.name}: ${tool.url}`).join(' | ')}` }] };
  });

  const commonTakeoffSchema = {
    plan: fileParam.describe('The plan image or PDF attached to the ChatGPT conversation. The host transfers this file to QuoteCore+.'),
    unitSystem: z.enum(['metric', 'imperial', 'squares']).optional(),
  };
  server.registerTool('start_roof_takeoff', {
    title: 'Measure a roof from an attached plan', description: takeoffDescription('roofing'),
    inputSchema: { ...commonTakeoffSchema, source_outline: sourceOutline.optional().describe('Optional exterior roof polygon traced from this SAME attachment. Full-image normalized coordinates: top-left is 0,0 and bottom-right is 1,1. Do not infer pitch, scale, ridges, hips, valleys or other components.') },
    annotations: { ...annotations, readOnlyHint: false, idempotentHint: false, openWorldHint: true },
    _meta: { ...launcherMeta, securitySchemes: noAuth, 'openai/fileParams': ['plan'], 'openai/toolInvocation/invoking': 'Preparing roof takeoff', 'openai/toolInvocation/invoked': 'Roof takeoff ready for review' },
  }, async (args) => startTakeoff(getService(), 'roofing', args));

  for (const [name, trade, title] of [
    ['start_cladding_takeoff', 'cladding', 'Measure walls or cladding from an attached plan'],
    ['start_flooring_takeoff', 'flooring', 'Measure flooring from an attached plan'],
  ] as const) {
    server.registerTool(name, {
      title, description: takeoffDescription(trade), inputSchema: commonTakeoffSchema,
      annotations: { ...annotations, readOnlyHint: false, idempotentHint: false, openWorldHint: true },
      _meta: { ...launcherMeta, securitySchemes: noAuth, 'openai/fileParams': ['plan'], 'openai/toolInvocation/invoking': `Preparing ${trade} takeoff`, 'openai/toolInvocation/invoked': `${title} is ready` },
    }, async (args) => startTakeoff(getService(), trade, args));
  }

  server.registerTool('start_measurements_to_pricing', {
    title: 'Price measurements you already have',
    description: 'Opens the existing QuoteCore+ Measurements to Pricing UX when the user already knows areas, lengths or quantities. If measurements were supplied in the conversation, pass them here so QuoteCore+ preloads the same values and the user only has to review rates/waste/pitch. For a prefilled session, trade and unitSystem are required and must match the supplied values; do not silently default, convert or invent them. If no measurements were supplied, omit the array and open the normal blank workflow.',
    inputSchema: {
      trade: z.enum(['roofing', 'cladding', 'flooring']).optional(),
      unitSystem: z.enum(['metric', 'imperial', 'squares']).optional(),
      currency: currencyInput.optional(),
      title: z.string().max(160).optional(),
      basis: z.enum(['actual', 'plan']).optional(),
      measurements: z.array(measurementPrefill).max(500).default([]),
    }, annotations, _meta: { ...launcherMeta, securitySchemes: noAuth },
  }, async ({ trade, unitSystem, currency, title, basis, measurements }) => {
    try {
      if (!measurements.length) {
        const url = new URL('/measurement-to-quote-tool', origin);
        if (trade) url.searchParams.set('trade', trade);
        if (basis && (!trade || trade === 'roofing')) url.searchParams.set('mode', basis);
        return { structuredContent: { status: 'ready', workflow: 'measurements_to_pricing', measurementCount: 0, resultUrl: url.href }, content: [{ type: 'text', text: `Open the blank Measurements to Pricing workflow in QuoteCore+: ${url.href}` }] };
      }
      if (!trade || !unitSystem) {
        throw new ScanError('INPUT_REQUIRED', 'When preloading measurements, set both trade and unitSystem to match the values the user supplied. Do not guess or silently default their units.');
      }
      const result = await getService().startMeasurementsToPricing({ trade, unitSystem, currency, title, basis, measurements });
      return {
        structuredContent: { status: 'ready', workflow: 'measurements_to_pricing', trade: result.trade, unitSystem: result.unitSystem, measurementCount: result.measurementCount, resultUrl: result.resultUrl },
        content: [{ type: 'text', text: `${result.measurementCount} supplied measurement${result.measurementCount === 1 ? '' : 's'} are preloaded in the real QuoteCore+ Measurements to Pricing UX. Rates start at zero so the user can review pricing inputs before relying on the result. Open ${result.resultUrl}` }],
      };
    } catch (error) {
      return { isError: true, structuredContent: { status: 'error', code: code(error), message: message(error) }, content: [{ type: 'text', text: message(error) }] };
    }
  });

  const registerDocument = (name: 'create_quote' | 'create_invoice' | 'create_purchase_order', kind: DocumentKind, title: string) => {
    server.registerTool(name, {
      title,
      description: `Opens an editable ${kind === 'order' ? 'purchase order' : kind} draft in the existing QuoteCore+ document generator. Prefill any line items the user has already supplied; if none were supplied, open a blank draft instead of forcing the user to repeat the request. This does not send or persist the document; the user reviews it in QuoteCore+ and can print/save it.`,
      inputSchema: {
        lines: z.array(lineInput).max(200).default([]),
        recipientName: z.string().max(2000).optional().describe(kind === 'order' ? 'Supplier name.' : 'Customer/client name.'),
        currency: currencyInput,
        taxEnabled: z.boolean().default(false),
        taxRate: z.number().min(0).max(100).default(0),
        taxName: z.string().min(1).max(100).default('Tax'),
      },
      annotations, _meta: { ...launcherMeta, securitySchemes: noAuth },
    }, async ({ lines, recipientName, currency, taxEnabled, taxRate, taxName }) => {
      try {
        const result = documentUrl(origin, kind, { lines, recipientName, currency, taxEnabled, taxRate, taxName });
        return {
          structuredContent: { status: 'ready', kind, subtotal: result.totals.subtotal, tax: result.totals.tax, total: result.totals.total, currency, resultUrl: result.resultUrl },
          content: [{ type: 'text', text: `${title} draft ready for user review${lines.length ? ` with ${lines.length} prefilled line item${lines.length === 1 ? '' : 's'}` : ''}. Total ${result.totals.total.toFixed(2)} ${currency}. Open ${result.resultUrl}` }],
        };
      } catch (error) {
        return { isError: true, structuredContent: { status: 'error', code: code(error), message: message(error) }, content: [{ type: 'text', text: message(error) }] };
      }
    });
  };
  registerDocument('create_quote', 'quote', 'Create a quote');
  registerDocument('create_invoice', 'invoice', 'Create an invoice');
  registerDocument('create_purchase_order', 'order', 'Create a purchase order');
}

export const FREE_TOOLS_MCP_INSTRUCTIONS = [
  'QuoteCore+ Free Tools follows the same Measure / Calculate / Create documents routing as quote-core.com/free-tools.',
  'When the user clearly wants to measure an attached roof, wall/cladding or floor plan, call the matching start_*_takeoff tool directly. If no plan is attached, ask for the plan image or PDF rather than inventing a file reference.',
  'For a single roof image that you can actually see, you may include one exterior source_outline in normalized full-image 0..1 coordinates in the SAME start_roof_takeoff call. Never infer scale, pitch or internal roof components. For PDF attachments, omit source_outline because the user must choose the page first. If the boundary is unclear, omit source_outline and let the user trace manually.',
  'The takeoff workstation is authoritative for calibration, edits and measured components. A model-suggested roof outline is unverified until the user reviews it. For roofing, after the corrected outline is saved the existing workstation offers either manual component measurement or AI scans 2+3 for internal component proposals; those scans use the corrected human-reviewed outline, not the original model polygon.',
  'If the user already has measurements, use start_measurements_to_pricing instead of asking for a plan. Pass measurements the user already supplied so they appear in the existing QuoteCore+ pricing UX; never invent missing quantities, units, pitch or rates.',
  'Use create_quote, create_invoice or create_purchase_order for document requests. Prefill line items already supplied by the user, but the tools may also open a blank editable draft when details have not been supplied yet. They do not send documents.',
  'Use find_quotecore_tool for ambiguous jobs and as the gateway to specialist calculators in the Calculate lane. Its recommendations include an action hint when the website route has a richer MCP-native continuation; follow that action when its requirements are satisfied instead of merely opening the public page. When a calculator request maps to an existing QuoteCore+ calculator page, return/open that real tool rather than reproducing its UI-local formula logic in the connector. Existing deterministic roof calculation tools remain available for numeric roof takeoff calculations already exposed headlessly.',
].join(' ');
