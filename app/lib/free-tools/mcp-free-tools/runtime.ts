import { createHash } from 'node:crypto';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';
import type { RpcEnvelope } from '../host-roof-scan/request';
import { ScanError } from '../host-roof-scan/types';
import { freeToolsMcpEnabled, freeToolsMcpFileOrigins, freeToolsMcpOrigin } from './config';
import { FreeToolsMcpService } from './service';
import { FREE_TOOLS_ATTACHMENT_ACTIONS } from './routing-actions';
import { WorkspaceMemoryImageStore, WorkspaceSupabaseImageStore } from './store';

export const ATTACHMENT_TAKEOFF_TOOLS = new Set<string>(FREE_TOOLS_ATTACHMENT_ACTIONS);
let singleton: FreeToolsMcpService | null = null;

export function freeToolsMcpService(): FreeToolsMcpService {
  if (!freeToolsMcpEnabled()) throw new ScanError('NOT_ENABLED', 'QuoteCore+ Free Tools MCP integration is not enabled.', 404);
  if (singleton) return singleton;
  const secret = process.env.QC_FREE_TOOLS_MCP_SECRET ?? '';
  const storage = process.env.QC_FREE_TOOLS_MCP_STORAGE;
  let store;
  if (storage === 'memory' && process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    store = new WorkspaceMemoryImageStore();
  } else if (storage === 'supabase') {
    store = new WorkspaceSupabaseImageStore(
      (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, ''),
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      process.env.QC_FREE_TOOLS_MCP_BUCKET ?? '',
    );
  } else {
    throw new ScanError('CONFIGURATION_REQUIRED', 'Use private Supabase storage for the Free Tools MCP integration. Memory mode is local-only.', 503);
  }
  singleton = new FreeToolsMcpService({
    origin: freeToolsMcpOrigin(),
    secret,
    store,
    allowedFileOrigins: freeToolsMcpFileOrigins(),
  });
  return singleton;
}

export async function guardFreeToolsMcpRpc(request: Request, rpc: RpcEnvelope): Promise<void> {
  if (rpc.method !== 'tools/call') return;
  const tool = String(rpc.params?.name ?? '');
  const args = rpc.params?.arguments;
  if (!args || typeof args !== 'object' || Array.isArray(args)) return;
  const input = args as Record<string, unknown>;
  const createsPlanAsset = ATTACHMENT_TAKEOFF_TOOLS.has(tool) && Boolean(input.plan);
  const createsMeasurementAsset = tool === 'start_measurements_to_pricing'
    && Array.isArray(input.measurements) && input.measurements.length > 0;
  if (!createsPlanAsset && !createsMeasurementAsset) return;

  const id = createHash('sha256').update(getClientIP(request.headers)).digest('hex').slice(0, 24);
  const failClosed = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const perClientLimit = createsPlanAsset ? 20 : 60;
  const globalLimit = createsPlanAsset ? 200 : 600;
  const bucket = createsPlanAsset ? 'upload' : 'measurement-session';
  if (!await checkRateLimit(`qc-free-tools-mcp-v2:${bucket}:${id}`, perClientLimit, 60 * 60 * 1000, { failClosed }))
    throw new ScanError('RATE_LIMIT', createsPlanAsset ? 'Too many plan uploads. Please retry later.' : 'Too many pricing-session requests. Please retry later.', 429);
  if (!await checkRateLimit(`qc-free-tools-mcp-v2:${bucket}s-global`, globalLimit, 60 * 60 * 1000, { failClosed }))
    throw new ScanError('CAPACITY', createsPlanAsset ? 'The plan-upload capacity is reached. Please retry later.' : 'The pricing-session capacity is reached. Please retry later.', 429);
}


export async function pruneFreeToolsMcpAssets(now = Date.now()): Promise<{ scanned: number; deleted: number; capped: boolean }> {
  const service = freeToolsMcpService();
  const store = service.options.store;
  if (!(store instanceof WorkspaceSupabaseImageStore)) return { scanned: 0, deleted: 0, capped: false };
  // Sessions live for 30 minutes; keep a generous two-hour grace window for retries/reloads.
  return store.pruneExpired(now - 2 * 60 * 60 * 1000, 500);
}
