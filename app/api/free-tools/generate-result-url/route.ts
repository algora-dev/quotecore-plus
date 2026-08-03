import { NextResponse } from 'next/server';
import { createResultToken } from '@/app/(public)/free-roofing-takeoff-builder/result-token';
import { toResultQuery, type PublicRoofTakeoffInput } from '@/app/(public)/free-roofing-takeoff-builder/public-contract';
import { ROOF_TAKEOFF_CALCULATION_VERSION } from '@/app/(public)/free-roofing-takeoff-builder/public-contract';

/**
 * POST /api/free-tools/generate-result-url
 * Generates a signed result URL from takeoff input data.
 * Client-side code can't use Node's crypto module, so this endpoint
 * handles token creation server-side.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const publicInput: PublicRoofTakeoffInput = {
      mode: body.mode ?? 'actual',
      units: body.units ?? 'metric',
      pitchDegrees: body.pitchDegrees,
      area: body.area,
      ridge: body.ridge,
      hips: body.hips,
      valleys: body.valleys,
      barges: body.barges,
      spouting: body.spouting,
      supplier: body.supplier,
      country: body.country,
    };

    const query = toResultQuery(publicInput);
    const token = createResultToken(query, ROOF_TAKEOFF_CALCULATION_VERSION);

    // Build absolute URL
    const origin = new URL(request.url).origin;
    const resultUrl = `${origin}/free-roofing-takeoff-builder/result/${token}`;

    return NextResponse.json({ ok: true, resultUrl });
  } catch (err) {
    console.error('[generate-result-url] Error:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to generate result URL' },
      { status: 500 },
    );
  }
}
