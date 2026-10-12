import { REFERENCE_BYTES, type ReferenceStore } from './references';
import { ScanError } from './types';

/** Test/development only. runtime.ts forbids memory storage on Vercel or production Node. */
export class MemoryReferenceStore implements ReferenceStore {
    private readonly records = new Map<string, { bytes: Buffer; expiresAt: number }>();
    constructor(private readonly now: () => number = Date.now, private readonly maxBytes = 8 * 1024 * 1024) { }
    async put(key: string, bytes: Buffer, expiresAt: number) {
        for (const [k, value] of this.records) if (value.expiresAt <= this.now()) this.records.delete(k);
        if (bytes.length > REFERENCE_BYTES) throw new ScanError('REFERENCE_TOO_LARGE', 'Reference record exceeds its size limit.', 413);
        if (this.records.has(key)) throw new ScanError('REFERENCE_COLLISION', 'Could not allocate a new reference. Try again.', 503);
        let used = 0;
        for (const value of this.records.values()) used += value.bytes.length;
        if (used + bytes.length > this.maxBytes) throw new ScanError('CAPACITY', 'Temporary reference storage is at capacity.', 503);
        this.records.set(key, { bytes: Buffer.from(bytes), expiresAt });
    }
    async get(key: string) {
        const value = this.records.get(key);
        if (!value || value.expiresAt <= this.now()) {
            this.records.delete(key);
            throw new ScanError('REFERENCE_NOT_FOUND', 'Reference unavailable, expired, or mistyped. Copy the latest complete review link or upload again.', 410);
        }
        return Buffer.from(value.bytes);
    }
}

/** A SEPARATE private JSON bucket: never widen the image bucket's MIME allowlist.
 * No public/signed download URLs, no user-account tables and no new runtime dependency.
 */
export class SupabaseReferenceStore implements ReferenceStore {
    private checked = false;
    constructor(private readonly origin: string, private readonly serviceKey: string, private readonly bucket: string) {
        if (!/^https:\/\/[a-z0-9.-]+(?::443)?$/.test(origin) || !serviceKey || !/^qc-host-[a-z0-9-]{1,54}$/.test(bucket))
            throw new ScanError('CONFIGURATION_REQUIRED', 'Configure a dedicated qc-host- private reference bucket.', 503);
    }
    private async call(path: string, init: RequestInit = {}) {
        try {
            return await fetch(`${this.origin}/storage/v1/${path}`, {
                ...init, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(12000),
                headers: { apikey: this.serviceKey, Authorization: `Bearer ${this.serviceKey}`, ...init.headers },
            });
        } catch { throw new ScanError('REFERENCE_STORAGE_UNAVAILABLE', 'Temporary reference storage is unavailable.', 503); }
    }
    private async bytes(response: Response): Promise<Buffer> {
        const advertised = response.headers.get('content-length');
        if (advertised && (!/^\d+$/.test(advertised) || Number(advertised) > REFERENCE_BYTES)) {
            await response.body?.cancel().catch(() => undefined);
            throw new ScanError('REFERENCE_TOO_LARGE', 'Reference response exceeds its size limit.', 503);
        }
        if (!response.body) return Buffer.alloc(0);
        const reader = response.body.getReader(), chunks: Buffer[] = [];
        let length = 0;
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                length += value.byteLength;
                if (length > REFERENCE_BYTES) {
                    await reader.cancel();
                    throw new ScanError('REFERENCE_TOO_LARGE', 'Reference response exceeds its size limit.', 503);
                }
                chunks.push(Buffer.from(value));
            }
        } catch (error) {
            if (error instanceof ScanError) throw error;
            throw new ScanError('REFERENCE_STORAGE_UNAVAILABLE', 'Temporary reference storage could not be read.', 503);
        } finally { reader.releaseLock(); }
        return Buffer.concat(chunks);
    }
    private async check() {
        if (this.checked) return;
        const response = await this.call(`bucket/${this.bucket}`);
        if (!response.ok) {
            await response.body?.cancel().catch(() => undefined);
            throw new ScanError('CONFIGURATION_REQUIRED', 'Create and configure the dedicated private reference bucket before enabling opaque references.', 503);
        }
        let b: { public?: unknown; file_size_limit?: unknown; allowed_mime_types?: unknown };
        try { b = JSON.parse((await this.bytes(response)).toString('utf8')); }
        catch (e) { if (e instanceof ScanError) throw e; throw new ScanError('CONFIGURATION_REQUIRED', 'Reference bucket configuration is invalid.', 503); }
        if (b?.public !== false || Number(b.file_size_limit) !== REFERENCE_BYTES
            || !Array.isArray(b.allowed_mime_types) || b.allowed_mime_types.length !== 1 || b.allowed_mime_types[0] !== 'application/json')
            throw new ScanError('UNSAFE_REFERENCE_STORAGE', 'Reference bucket must be private, JSON-only, and limited to 65536 bytes. No bucket settings were changed.', 503);
        this.checked = true;
    }
    private path(key: string) {
        if (!/^host-outline-refs-v1\/\d{4}-\d{2}-\d{2}\/\d{1,16}-[a-f0-9]{64}\.json$/.test(key))
            throw new ScanError('INVALID_REFERENCE', 'Invalid reference storage key.', 403);
        return `object/${this.bucket}/${key}`;
    }
    async put(key: string, bytes: Buffer, _expiresAt: number) {
        const path = this.path(key);
        if (bytes.length > REFERENCE_BYTES) throw new ScanError('REFERENCE_TOO_LARGE', 'Reference record exceeds its size limit.', 413);
        await this.check();
        const response = await this.call(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-upsert': 'false', 'Cache-Control': 'private, no-store' }, body: new Uint8Array(bytes) });
        await response.body?.cancel().catch(() => undefined);
        if (!response.ok) throw new ScanError('REFERENCE_STORAGE_UNAVAILABLE', 'The temporary reference could not be saved. Reopen the latest saved review before retrying.', 503);
    }
    async get(key: string) {
        const path = this.path(key);
        await this.check();
        const response = await this.call(path);
        if (!response.ok) {
            let missing = response.status === 404;
            if (response.status === 400) {
                const bytes = await this.bytes(response);
                try {
                    const error = JSON.parse(bytes.toString('utf8'));
                    missing = error?.code === 'NoSuchKey' || String(error?.statusCode) === '404';
                } catch { /* A malformed error is an outage, not proof of an expired reference. */ }
            } else await response.body?.cancel().catch(() => undefined);
            if (missing) throw new ScanError('REFERENCE_NOT_FOUND', 'Reference unavailable, expired, or mistyped. Copy the latest complete review link or upload again.', 410);
            throw new ScanError('REFERENCE_STORAGE_UNAVAILABLE', 'Temporary reference storage is unavailable. Retry the same link later.', 503);
        }
        return this.bytes(response);
    }
}
