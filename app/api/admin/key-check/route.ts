import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getAdminSignupsApiKey } from '@/app/lib/marketing/adminSecrets';

export const runtime = 'nodejs';

/**
 * GET /api/admin/key-check - diagnostics for the signups API key.
 *
 * Returns a fingerprint (first 12 hex of SHA256) of the ACTIVE key so
 * "which key is live right now" is a single curl, with no guesswork and
 * no secret disclosure. 200 = key resolvable, 503 = nothing configured.
 */
export async function GET(req: NextRequest) {
  const expected = await getAdminSignupsApiKey();
  if (!expected) {
    return NextResponse.json({ error: 'API key not configured on server' }, { status: 503 });
  }
  const fingerprint = createHash('sha256').update(expected).digest('hex').slice(0, 12);
  return NextResponse.json({ fingerprint, source: 'app_runtime_config or env fallback' });
}
