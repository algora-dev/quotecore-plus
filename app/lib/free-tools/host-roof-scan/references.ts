import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Tickets } from './tokens';
import { LIMITS, ScanError, type Ticket } from './types';

export type ReferenceKind = 'plan' | 'proposal' | 'reviewed';
export type ReferenceMode = 'signed' | 'opaque';
type PublicTicket = Extract<Ticket, { kind: ReferenceKind }>;
export interface ReferenceStore {
    /** Immutable, private, bounded records. Production implementations must be shared across instances. */
    put(key: string, bytes: Buffer, expiresAt: number): Promise<void>;
    get(key: string): Promise<Buffer>;
}
const KIND = { plan: 'p', proposal: 'o', reviewed: 'r' } as const;
const PATTERN = /^qcr1([por])_([0-9a-z]{1,11})_([A-Za-z0-9_-]{22})$/;
export const REFERENCE_BYTES = 64 * 1024;

/** Opaque bearer capabilities, not guessable invitation codes or account authentication.
 * Only the random reference is exposed to the host. Its signed ticket remains server-side.
 * Old signed tickets remain readable; neither encoding extends the original session lifetime.
 */
export class References {
    private readonly tickets: Tickets;
    constructor(
        private readonly secret: string,
        private readonly store?: ReferenceStore,
        private readonly mode: ReferenceMode = store ? 'opaque' : 'signed',
        private readonly now: () => number = Date.now,
    ) {
        this.tickets = new Tickets(secret, now);
        if (mode === 'opaque' && !store)
            throw new ScanError('REFERENCE_STORE_REQUIRED', 'Opaque references require shared private reference storage.', 503);
    }
    private mac(reference: string, ticket: string): Buffer {
        return createHmac('sha256', this.secret).update(`qc-host-reference-v1\n${reference}\n${ticket}`).digest();
    }
    private location(reference: string, kind: ReferenceKind) {
        const m = PATTERN.exec(reference);
        if (!m || m[1] !== KIND[kind] || Buffer.from(m[3], 'base64url').toString('base64url') !== m[3])
            throw new ScanError('INVALID_REFERENCE', 'Invalid reference or wrong reference type. Copy the complete reference again.', 403);
        const expiresAt = Number.parseInt(m[2], 36);
        if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0 || expiresAt > 8.64e15 || expiresAt.toString(36) !== m[2])
            throw new ScanError('INVALID_REFERENCE', 'Invalid reference encoding.', 403);
        if (expiresAt <= this.now())
            throw new ScanError('EXPIRED', 'This temporary session expired. Save your local draft and upload the plan again.', 410);
        const day = new Date(expiresAt).toISOString().slice(0, 10);
        // No capability itself is used as a storage filename or returned in storage errors.
        const digest = createHash('sha256').update(reference).digest('hex');
        return { expiresAt, key: `host-outline-refs-v1/${day}/${expiresAt}-${digest}.json` };
    }
    async issue<T extends PublicTicket>(ticket: T): Promise<string> {
        const signed = this.tickets.issue(ticket);
        if (this.mode === 'signed') return signed;
        if (!Number.isSafeInteger(ticket.expiresAt) || ticket.expiresAt <= this.now()
            || ticket.expiresAt > this.now() + LIMITS.ttlSeconds * 1000)
            throw new ScanError('INVALID_REFERENCE_LIFETIME', 'Reference lifetime must not exceed the original session.', 400);
        // 128 random bits: 22 base64url characters, plus a version/type/expiry prefix (~37 total).
        const reference = `qcr1${KIND[ticket.kind]}_${ticket.expiresAt.toString(36)}_${randomBytes(16).toString('base64url')}`;
        const location = this.location(reference, ticket.kind);
        const bytes = Buffer.from(JSON.stringify({ v: 'qc-reference-v1', ticket: signed, mac: this.mac(reference, signed).toString('base64url') }));
        if (bytes.length > REFERENCE_BYTES) throw new ScanError('TOKEN_TOO_LARGE', 'The reference record is too large.');
        await this.store!.put(location.key, bytes, ticket.expiresAt);
        return reference;
    }
    async read<K extends ReferenceKind>(input: unknown, kind: K): Promise<Extract<PublicTicket, { kind: K }>> {
        if (typeof input !== 'string' || !input || input.length > LIMITS.tokenChars)
            throw new ScanError('INVALID_REFERENCE', 'A complete temporary reference is required.', 403);
        // Do not autocorrect, trim interior whitespace, search for a near match, or guess a session.
        if (!input.startsWith('qcr1')) return this.tickets.read(input, kind);
        const location = this.location(input, kind);
        if (!this.store)
            throw new ScanError('REFERENCE_STORE_REQUIRED', 'This deployment cannot resolve short references. Ask the operator to configure shared reference storage.', 503);
        const bytes = await this.store.get(location.key);
        if (bytes.length > REFERENCE_BYTES)
            throw new ScanError('INVALID_REFERENCE', 'The stored reference is invalid.', 403);
        let record: unknown;
        try { record = JSON.parse(bytes.toString('utf8')); }
        catch { throw new ScanError('INVALID_REFERENCE', 'The stored reference is invalid.', 403); }
        const r = record as { v?: unknown; ticket?: unknown; mac?: unknown } | null;
        if (!r || r.v !== 'qc-reference-v1' || typeof r.ticket !== 'string' || r.ticket.length > LIMITS.tokenChars
            || typeof r.mac !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(r.mac))
            throw new ScanError('INVALID_REFERENCE', 'The stored reference is invalid.', 403);
        const actual = Buffer.from(r.mac, 'base64url'), expected = this.mac(input, r.ticket);
        if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
            throw new ScanError('INVALID_REFERENCE', 'Reference integrity check failed. Copy the original link again.', 403);
        // Tickets.read validates kind at runtime; K excludes the UI-only review-gate.
        const ticket = this.tickets.read(r.ticket, kind) as Extract<PublicTicket, { kind: K }>;
        if (ticket.expiresAt !== location.expiresAt)
            throw new ScanError('INVALID_REFERENCE', 'Reference lifetime did not match its signed record.', 403);
        return ticket;
    }
}
