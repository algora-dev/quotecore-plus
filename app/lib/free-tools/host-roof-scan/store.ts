import { LIMITS, ScanError, type ImageStore } from './types';
/** Local development only. Never select this for Vercel or multi-instance hosting. */
export class MemoryImageStore implements ImageStore {
    private data = new Map<string, {
        bytes: Buffer;
        expiresAt: number;
    }>();
    constructor(private readonly now: () => number = Date.now, private readonly maxBytes = 32 * 1024 * 1024) { }
    private prune() { for (const [key, item] of this.data)
        if (item.expiresAt <= this.now())
            this.data.delete(key); }
    async put(key: string, bytes: Buffer) {
        this.prune();
        let total = 0;
        for (const item of this.data.values())
            total += item.bytes.length;
        if (total + bytes.length > this.maxBytes)
            throw new ScanError('CAPACITY', 'The test server is at capacity. Try again later.', 503);
        this.data.set(key, { bytes: Buffer.from(bytes), expiresAt: this.now() + LIMITS.ttlSeconds * 1000 });
    }
    async get(key: string) { this.prune(); const item = this.data.get(key); if (!item)
        throw new ScanError('EXPIRED', 'The temporary image is no longer available.', 410); return Buffer.from(item.bytes); }
    async remove(key: string) { this.data.delete(key); }
}
/** Uses a dedicated private bucket, provisioned by the deployer. No SQL/RLS changes. */
export class SupabaseImageStore implements ImageStore {
    private checked = false;
    constructor(private readonly origin: string, private readonly key: string, private readonly bucket: string) {
        if (!/^https:\/\/[a-z0-9.-]+(?::443)?$/.test(origin) || !key || !/^[a-z0-9][a-z0-9-]{2,62}$/.test(bucket))
            throw new ScanError('CONFIGURATION_REQUIRED', 'Configure a dedicated private host-scan storage bucket.', 503);
    }
    private async call(path: string, init: RequestInit = {}): Promise<Response> {
        try {
            return await fetch(`${this.origin}/storage/v1/${path}`, { ...init, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(12000), headers: { apikey: this.key, Authorization: `Bearer ${this.key}`, ...init.headers } });
        }
        catch {
            throw new ScanError('STORAGE_UNAVAILABLE', 'Temporary image storage is unavailable.', 503);
        }
    }
    private async check() {
        if (this.checked)
            return;
        const r = await this.call(`bucket/${this.bucket}`);
        if (!r.ok)
            throw new ScanError('CONFIGURATION_REQUIRED', 'Create the configured private host-scan bucket before enabling this feature.', 503);
        const b = await r.json();
        if (b.public !== false)
            throw new ScanError('UNSAFE_STORAGE', 'The host-scan bucket must be private.', 503);
        this.checked = true;
    }
    private path(key: string) {
        if (!/^host-outline-v1\/\d{4}-\d{2}-\d{2}\/\d+-[a-f0-9-]{36}$/.test(key))
            throw new ScanError('INVALID_REFERENCE', 'Invalid storage reference.', 403);
        return `object/${this.bucket}/${key}`;
    }
    async put(key: string, bytes: Buffer, mimeType: string) {
        await this.check();
        const r = await this.call(this.path(key), { method: 'POST', headers: { 'Content-Type': mimeType, 'x-upsert': 'false', 'Cache-Control': 'private, no-store' }, body: new Uint8Array(bytes) });
        if (!r.ok)
            throw new ScanError('STORAGE_UNAVAILABLE', 'The image could not be saved to temporary storage.', 503);
    }
    async get(key: string) {
        await this.check();
        const r = await this.call(this.path(key));
        if (!r.ok)
            throw new ScanError('EXPIRED', 'The temporary image is no longer available.', 410);
        const bytes = Buffer.from(await r.arrayBuffer());
        if (bytes.length > LIMITS.imageBytes)
            throw new ScanError('INVALID_STORED_IMAGE', 'The stored image is outside the allowed size.', 400);
        return bytes;
    }
    async remove(key: string) {
        this.path(key);
        await this.check();
        const r = await this.call(`object/${this.bucket}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [key] }) });
        if (!r.ok)
            throw new ScanError('STORAGE_UNAVAILABLE', 'Could not remove the temporary image. Please retry.', 503);
    }
}
