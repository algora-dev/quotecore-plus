import { createHmac, timingSafeEqual } from 'node:crypto';
import { LIMITS, ScanError, VERSION, type Ticket } from './types';
/** Signed, immutable capability envelopes. Not account authentication. Never log them. */
export class Tickets {
    constructor(private readonly secret: string, private readonly now: () => number = Date.now) {
        if (Buffer.byteLength(secret) < 32)
            throw new ScanError('CONFIGURATION_REQUIRED', 'Set QC_HOST_SCAN_SECRET to a separate random secret of at least 32 bytes.', 503);
    }
    issue<T extends Ticket>(payload: T): string {
        const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const signature = createHmac('sha256', this.secret).update(`qc-host-scan.${encoded}`).digest('base64url');
        const token = `${encoded}.${signature}`;
        if (token.length > LIMITS.tokenChars)
            throw new ScanError('TOKEN_TOO_LARGE', 'The outline contains too much metadata.');
        return token;
    }
    read<K extends Ticket['kind']>(token: unknown, kind: K): Extract<Ticket, {
        kind: K;
    }> {
        if (typeof token !== 'string' || token.length > LIMITS.tokenChars)
            throw new ScanError('INVALID_TOKEN', 'Invalid review or image reference.', 403);
        const parts = token.split('.');
        if (parts.length !== 2 || !parts.every(s => /^[A-Za-z0-9_-]+$/.test(s)))
            throw new ScanError('INVALID_TOKEN', 'Invalid reference encoding.', 403);
        const expected = createHmac('sha256', this.secret).update(`qc-host-scan.${parts[0]}`).digest();
        const actual = Buffer.from(parts[1], 'base64url');
        if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
            throw new ScanError('INVALID_TOKEN', 'Reference signature did not match.', 403);
        let value: Ticket;
        try {
            value = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
        }
        catch {
            throw new ScanError('INVALID_TOKEN', 'Invalid reference payload.', 403);
        }
        if (!value || value.v !== VERSION || value.kind !== kind || !Number.isFinite(value.expiresAt))
            throw new ScanError('INVALID_TOKEN', 'Wrong reference type or version.', 403);
        if (value.expiresAt <= this.now())
            throw new ScanError('EXPIRED', 'This temporary session expired. Download existing work locally or upload the plan again.', 410);
        return value as Extract<Ticket, {
            kind: K;
        }>;
    }
}
