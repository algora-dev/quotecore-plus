import 'server-only';
import { randomUUID } from 'node:crypto';
import { getResendClient } from '@/app/lib/email/client';
import { checkRateLimit } from '@/app/lib/security/rateLimit';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { consumeDemoResource, demoBudgetConfig } from './budget';
import { demoCustomerToken } from './customer.server';
import { demoHmac } from './identity';
import { DemoError } from './errors';
import { recordDemoEventBestEffort } from './progress';
import type { ActiveDemoContext } from './model';
/** Owner decision 2026-10-04: no email-ownership verification. The demo send
 * limit (3 per 24h, session + IP scoped) and per-recipient rate limits are the
 * only abuse controls. All content is server-authored; nothing user-editable. */
function enabled(context: ActiveDemoContext): string {
  if (process.env.DEMO_SELF_SEND_ENABLED !== 'true') throw new DemoError('Self-send is switched off. You can still open the customer preview.', 503, 'demo_send_off');
  if (!context.tutorialState.acknowledgements['takeoff.saved']) throw new DemoError('Save your customer quote first.', 409);
  const configured = process.env.DEMO_PUBLIC_ORIGIN; let origin: URL;
  try { origin = new URL(configured ?? ''); } catch { throw new DemoError('The public demo origin has not been configured.', 503); }
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new DemoError('A secure public demo origin is required.', 503);
  return origin.origin;
}
function emailAddress(value: unknown): string {
  if (typeof value !== 'string') throw new DemoError('Enter your email address.'); const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(email)) throw new DemoError('Enter a valid email address.'); return email;
}
async function deliver(to: string, subject: string, html: string, text: string, idempotencyKey: string): Promise<void> {
  const client = getResendClient(); if (!client) throw new DemoError('Email delivery is not configured on this deployment.', 503);
  if (!await checkRateLimit('demo:mail:global', 60, 3_600_000, { failClosed: true })) throw new DemoError('Demo delivery is temporarily at capacity.', 429);
  // Deliberate, narrow exception to normal demo egress suppression. All caller
  // content is constructed here; never accept user HTML, subject, sender or link.
  const result = await client.emails.send({ from: 'QuoteCore+ Demo <info@quote-core.com>', to, subject, html, text, replyTo: 'info@quote-core.com', tags: [{ name: 'purpose', value: 'requested-demo-only' }] }, { idempotencyKey });
  if (result.error || !result.data?.id) throw new DemoError('The delivery provider did not confirm acceptance. This allowance remains reserved; no background retry was scheduled.', 502, 'demo_delivery_unconfirmed');
}
/** Sends the visitor's own demo quote link to the address they entered.
 * Single action: enter email, press send. Counters cap use at 3 sends per 24h. */
export async function sendDemoQuote(context: ActiveDemoContext, value: unknown): Promise<{ acceptedByProvider: true }> {
  const origin = enabled(context);
  const token = await demoCustomerToken(context); // throws 'Save your customer quote first.' when unsaved
  const email = emailAddress(value);
  if (!await checkRateLimit(`demo:mail:recipient:${demoHmac(email)}`, 3, 86_400_000, { failClosed: true })) throw new DemoError('Please wait before sending another demo quote to this address.', 429);
  await consumeDemoResource(context, 'quote-sends', 1, demoBudgetConfig().sends);
  const db = createAdminClient(); const id = randomUUID();
  const stored = await db.from('demo_usage').insert({ id, demo_session_id: context.sessionId, ip_hmac: context.ipHmac, action_type: 'quote-send', action_variant: demoHmac(email), reservation_credits: 0, status: 'reserved' });
  if (stored.error) throw new DemoError('Could not record the demo send.', 503);
  const href = `${origin}/demo/quote/${token}`;
  await deliver(email, 'QuoteCore+ Demo (NOT A REAL QUOTE)',
    `<h1>DEMO - NOT A REAL QUOTE</h1><p>You requested this fictional QuoteCore+ demonstration. No contract, order or payment is involved.</p><p><a href="${href}">Open your demo customer quote</a></p><p>The link expires when this demo ends or is reset. The customer response buttons affect only your fictional sandbox.</p><p>This requested delivery is not a marketing subscription.</p>`,
    `DEMO - NOT A REAL QUOTE. You requested this fictional QuoteCore+ demonstration. No contract or payment is involved. Open: ${href}\nThe link expires with the demo. No marketing subscription was created.`,
    `qcp-demo-quote-${id}`);
  await db.from('demo_usage').update({ status: 'settled', settled_at: new Date().toISOString() }).eq('id', id).eq('status', 'reserved');
  await recordDemoEventBestEffort(context.companyId, 'email.sent', context.tutorialState.seed.guided_roof_job);
  return { acceptedByProvider: true };
}
