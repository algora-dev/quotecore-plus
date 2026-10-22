import { createHmac, timingSafeEqual } from 'node:crypto';
import { ScanError } from '../host-roof-scan/types';
import { FREE_TOOLS_MCP_VERSION, type FreeToolsSessionTicket, type MeasurementSessionTicket, type WorkspaceSessionTicket } from './types';

const MAX_TOKEN_CHARS = 32000;

export class WorkspaceTickets {
  constructor(private readonly secret: string, private readonly now: () => number = Date.now) {
    if (Buffer.byteLength(secret) < 32)
      throw new ScanError('CONFIGURATION_REQUIRED', 'Set QC_FREE_TOOLS_MCP_SECRET to a separate random secret of at least 32 bytes.', 503);
  }

  issue(payload: FreeToolsSessionTicket): string {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.secret).update(`qc-free-tools-mcp.${encoded}`).digest('base64url');
    const token = `${encoded}.${signature}`;
    if (token.length > MAX_TOKEN_CHARS) throw new ScanError('TOKEN_TOO_LARGE', 'The free-tools session contains too much metadata.');
    return token;
  }

  private readAny(token: unknown): FreeToolsSessionTicket {
    if (typeof token !== 'string' || token.length > MAX_TOKEN_CHARS)
      throw new ScanError('INVALID_TOKEN', 'Invalid free-tools session reference.', 403);
    const parts = token.split('.');
    if (parts.length !== 2 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part)))
      throw new ScanError('INVALID_TOKEN', 'Invalid free-tools session reference.', 403);
    const expected = createHmac('sha256', this.secret).update(`qc-free-tools-mcp.${parts[0]}`).digest();
    const actual = Buffer.from(parts[1], 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new ScanError('INVALID_TOKEN', 'Free-tools session signature did not match.', 403);
    let value: FreeToolsSessionTicket;
    try { value = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as FreeToolsSessionTicket; }
    catch { throw new ScanError('INVALID_TOKEN', 'Invalid free-tools session payload.', 403); }
    if (!value || value.v !== FREE_TOOLS_MCP_VERSION || !['workspace', 'measurements'].includes(value.kind) || !Number.isFinite(value.expiresAt))
      throw new ScanError('INVALID_TOKEN', 'Wrong free-tools session version or type.', 403);
    if (value.expiresAt <= this.now())
      throw new ScanError('EXPIRED', 'This temporary QuoteCore+ session expired. Start the workflow again to create a fresh session.', 410);
    return value;
  }

  read(token: unknown): WorkspaceSessionTicket {
    const value = this.readAny(token);
    if (value.kind !== 'workspace') throw new ScanError('INVALID_TOKEN', 'This session is not a takeoff workspace.', 403);
    return value;
  }

  readMeasurements(token: unknown): MeasurementSessionTicket {
    const value = this.readAny(token);
    if (value.kind !== 'measurements') throw new ScanError('INVALID_TOKEN', 'This session is not a measurements-to-pricing session.', 403);
    return value;
  }
}
