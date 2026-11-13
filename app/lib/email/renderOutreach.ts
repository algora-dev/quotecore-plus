import 'server-only';
import { buildUnsubscribeToken } from '@/app/lib/marketing/unsubscribeToken';

/**
 * Outreach email rendering (owner 2026-11-13): DB-stored templates
 * (outreach_templates) with simple {{var}} substitution. Supported vars:
 * {{first_name}}, {{company_name}}, {{unsubscribe_url}}.
 */
export function renderOutreachVars(
  html: string,
  vars: { firstName?: string | null; companyName?: string | null; unsubscribeUrl: string },
): string {
  return html
    .replaceAll('{{first_name}}', vars.firstName?.trim() || 'there')
    .replaceAll('{{company_name}}', vars.companyName?.trim() || 'your business')
    .replaceAll('{{unsubscribe_url}}', vars.unsubscribeUrl);
}

/** Matches app/api/admin/unsubscribe-link: same base + HMAC token scheme. */
export function buildOutreachUnsubscribeUrl(email: string, hmacSecret: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://app.quote-core.com';
  return `${base}/unsubscribe/${buildUnsubscribeToken(email.toLowerCase(), hmacSecret)}`;
}
