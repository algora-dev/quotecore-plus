import { ScanError, type ImageStore } from '../host-roof-scan/types';

const TTL_MS = 30 * 60 * 1000;
const MAX_STORED_ASSET = 50 * 1024 * 1024;

export class WorkspaceMemoryImageStore implements ImageStore {
  private data = new Map<string, { bytes: Buffer; expiresAt: number }>();
  constructor(private readonly now: () => number = Date.now, private readonly maxBytes = 96 * 1024 * 1024) {}
  private prune() { for (const [key, item] of this.data) if (item.expiresAt <= this.now()) this.data.delete(key); }
  async put(key: string, bytes: Buffer) {
    this.prune();
    let total = 0;
    for (const item of this.data.values()) total += item.bytes.length;
    if (bytes.length > MAX_STORED_ASSET || total + bytes.length > this.maxBytes)
      throw new ScanError('CAPACITY', 'Temporary takeoff storage is at capacity. Try again later.', 503);
    this.data.set(key, { bytes: Buffer.from(bytes), expiresAt: this.now() + TTL_MS });
  }
  async get(key: string) {
    this.prune();
    const item = this.data.get(key);
    if (!item) throw new ScanError('EXPIRED', 'The temporary plan asset is no longer available.', 410);
    return Buffer.from(item.bytes);
  }
  async remove(key: string) { this.data.delete(key); }
}

export class WorkspaceSupabaseImageStore implements ImageStore {
  private checked = false;
  constructor(private readonly origin: string, private readonly key: string, private readonly bucket: string) {
    if (!/^https:\/\/[a-z0-9.-]+(?::443)?$/.test(origin) || !key || !/^[a-z0-9][a-z0-9-]{2,62}$/.test(bucket))
      throw new ScanError('CONFIGURATION_REQUIRED', 'Configure a dedicated private free-tools MCP storage bucket.', 503);
  }
  private async call(path: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await fetch(`${this.origin}/storage/v1/${path}`, {
        ...init, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(12000),
        headers: { apikey: this.key, Authorization: `Bearer ${this.key}`, ...init.headers },
      });
    } catch { throw new ScanError('STORAGE_UNAVAILABLE', 'Temporary takeoff storage is unavailable.', 503); }
  }
  private async check() {
    if (this.checked) return;
    const response = await this.call(`bucket/${this.bucket}`);
    if (!response.ok) throw new ScanError('CONFIGURATION_REQUIRED', 'Create the configured private free-tools MCP bucket before enabling the connector.', 503);
    const bucket = await response.json() as { public?: boolean };
    if (bucket.public !== false) throw new ScanError('UNSAFE_STORAGE', 'The free-tools MCP bucket must be private.', 503);
    this.checked = true;
  }
  private path(key: string) {
    if (!/^mcp-free-tools-v2\/\d{4}-\d{2}-\d{2}\/\d+-[a-f0-9-]{36}$/.test(key))
      throw new ScanError('INVALID_REFERENCE', 'Invalid takeoff storage reference.', 403);
    return `object/${this.bucket}/${key}`;
  }
  async put(key: string, bytes: Buffer, mimeType: string) {
    if (bytes.length > MAX_STORED_ASSET) throw new ScanError('INVALID_STORED_IMAGE', 'Prepared takeoff asset exceeds the storage limit.', 413);
    await this.check();
    const response = await this.call(this.path(key), {
      method: 'POST', headers: { 'Content-Type': mimeType, 'x-upsert': 'false', 'Cache-Control': 'private, no-store' }, body: new Uint8Array(bytes),
    });
    if (!response.ok) throw new ScanError('STORAGE_UNAVAILABLE', 'The plan asset could not be saved to temporary storage.', 503);
  }
  async get(key: string) {
    await this.check();
    const response = await this.call(this.path(key));
    if (!response.ok) throw new ScanError('EXPIRED', 'The temporary plan asset is no longer available.', 410);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_STORED_ASSET) throw new ScanError('INVALID_STORED_IMAGE', 'The stored plan asset is outside the allowed size.', 400);
    return bytes;
  }
  async pruneExpired(cutoffMs: number, hardCap = 500): Promise<{ scanned: number; deleted: number; capped: boolean }> {
    await this.check();
    let scanned = 0;
    const remove: string[] = [];
    for (const namespace of ['mcp-free-tools-v1', 'mcp-free-tools-v2']) {
      const root = await this.call(`object/list/${this.bucket}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: namespace, limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } }),
      });
      if (!root.ok) continue;
      const dates = await root.json() as Array<{ name?: string; metadata?: unknown }>;
      for (const date of dates) {
        if (!date?.name || date.metadata) continue;
        const prefix = `${namespace}/${date.name}`;
        const listing = await this.call(`object/list/${this.bucket}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefix, limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } }),
        });
        if (!listing.ok) continue;
        const rows = await listing.json() as Array<{ name?: string }>;
        for (const row of rows) {
          if (!row?.name) continue;
          scanned++;
          const match = /^(\d+)-[a-f0-9-]{36}$/.exec(row.name);
          if (!match || Number(match[1]) > cutoffMs) continue;
          remove.push(`${prefix}/${row.name}`);
          if (remove.length >= hardCap) break;
        }
        if (remove.length >= hardCap) break;
      }
      if (remove.length >= hardCap) break;
    }
    if (remove.length) {
      const response = await this.call(`object/${this.bucket}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: remove }),
      });
      if (!response.ok) throw new ScanError('STORAGE_UNAVAILABLE', 'Could not prune temporary takeoff storage.', 503);
    }
    return { scanned, deleted: remove.length, capped: remove.length >= hardCap };
  }

  async remove(key: string) {
    this.path(key);
    await this.check();
    const response = await this.call(`object/${this.bucket}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [key] }),
    });
    if (!response.ok) throw new ScanError('STORAGE_UNAVAILABLE', 'Could not remove the temporary plan image.', 503);
  }
}
