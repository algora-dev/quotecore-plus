import {
  calculatePublicRoofTakeoff,
  toResultQuery,
  type PublicRoofTakeoffInput,
} from '@/app/(public)/free-roofing-takeoff-builder/public-contract';
import { createResultToken, buildResultUrl } from '@/app/(public)/free-roofing-takeoff-builder/result-token';
import { ROOF_TAKEOFF_CALCULATION_VERSION } from '@/app/(public)/free-roofing-takeoff-builder/public-contract';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';

const MAX_BODY_BYTES = 32_000;

export async function POST(request: Request) {
  const clientIp = getClientIP(request.headers);
  const allowed = await checkRateLimit(`public-roof-takeoff:${clientIp}`, 120, 60 * 60 * 1000);
  if (!allowed) {
    return Response.json({ success: false, errors: [{ field: 'request', message: 'Too many calculations. Please try again later.' }] }, { status: 429 });
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ success: false, errors: [{ field: 'body', message: 'Request body is too large.' }] }, { status: 413 });
  }

  let input: PublicRoofTakeoffInput;
  try {
    input = await request.json() as PublicRoofTakeoffInput;
  } catch {
    return Response.json({ success: false, errors: [{ field: 'body', message: 'Request body must be valid JSON.' }] }, { status: 400 });
  }

  const result = calculatePublicRoofTakeoff(input);
  if (!result.success) return Response.json(result, { status: 422 });

  const origin = new URL(request.url).origin;
  const populatedQuery = toResultQuery({ ...input, mode: result.mode, units: result.units });
  const token = createResultToken(populatedQuery, ROOF_TAKEOFF_CALCULATION_VERSION);
  result.resultUrl = buildResultUrl(token, origin);
  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
