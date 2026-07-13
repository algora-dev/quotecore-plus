import { NextResponse } from 'next/server';

/**
 * Returns the visitor's country code from Vercel's x-vercel-ip-country header.
 * Falls back to 'GB' when the header is absent (local dev, non-Vercel hosting).
 */
export function GET(req: Request) {
  const country = req.headers.get('x-vercel-ip-country') || 'GB';
  return NextResponse.json({ country });
}
