import 'server-only';
import { createHmac } from 'node:crypto';
import { DemoError } from './errors';
export function demoHmac(value: string): string {
  const secret = process.env.DEMO_IP_HMAC_SECRET;
  if (!secret || secret.length < 32) throw new DemoError('The demo needs its server-side security configuration.', 503, 'demo_configuration');
  return createHmac('sha256', secret).update(value).digest('hex');
}
export function ipHmacFor(ip: string | null): string { return demoHmac(`ip:${ip?.trim() || 'unknown'}`); }
export function requestIp(headers: Headers): string {
  return headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
    || headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown';
}
