import { roofTakeoffSchema } from '@/app/(public)/free-roofing-takeoff-builder/schema';

export const dynamic = 'force-static';

export function GET() {
  return Response.json(roofTakeoffSchema, {
    headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
  });
}
