import type { NextRequest } from 'next/server';
import { assertSameOrigin, requireDemoRequest, readSmallJson, demoJson, demoErrorResponse } from '@/app/lib/demo/http';
import { isRecord } from '@/app/lib/demo/model';
import { DemoError } from '@/app/lib/demo/errors';
import { sendDemoQuote } from '@/app/lib/demo/self-send.server';
export const runtime = 'nodejs';
/** Single-action demo self-send: { email } -> the visitor's own demo quote is
 * emailed to that address. No verification step (owner 2026-10-04); the send
 * allowance (3 per 24h) and rate limits are the abuse controls. */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const { context } = await requireDemoRequest(request);
    const body = await readSmallJson(request);
    if (!isRecord(body) || typeof body.email !== 'string' || Object.keys(body).some(key => key !== 'email')) throw new DemoError('Enter your email address.');
    return demoJson(await sendDemoQuote(context, body.email));
  } catch (error) { return demoErrorResponse(error); }
}
