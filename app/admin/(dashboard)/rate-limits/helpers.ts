/**
 * Rate-limit bucket registry and severity helpers.
 *
 * This module is NOT a server action file — it's plain utility code
 * safe to import from both server and client components.
 */

export type BucketSeverity = 'red' | 'yellow' | 'green';

/**
 * Known rate-limit bucket patterns and their max values.
 * Used to compute traffic-light severity (green/yellow/red).
 * Unknown buckets default to a generic threshold.
 */
const RATE_LIMIT_REGISTRY: { pattern: RegExp; max: number; label: string }[] = [
  { pattern: /^recovery-lookup-ip:/, max: 5, label: 'Recovery lookup (IP)' },
  { pattern: /^recovery-lookup-email:/, max: 3, label: 'Recovery lookup (email)' },
  { pattern: /^recovery-verify-ip:/, max: 5, label: 'Recovery verify (IP)' },
  { pattern: /^recovery-verify-user:/, max: 3, label: 'Recovery verify (user)' },
  { pattern: /^email-change:/, max: 3, label: 'Email change (IP)' },
  { pattern: /^revision:/, max: 5, label: 'Quote revision (IP)' },
  { pattern: /^impersonate:/, max: 10, label: 'Impersonation (admin)' },
  { pattern: /^invoice-dispute:/, max: 3, label: 'Invoice dispute (IP)' },
  { pattern: /^invoice-payment-sent:/, max: 5, label: 'Invoice payment sent (IP)' },
  { pattern: /^attachment-download-ip:/, max: 60, label: 'Attachment download (IP)' },
  { pattern: /^message-reply-token:/, max: 10, label: 'Message reply (token)' },
  { pattern: /^order-respond-ip:/, max: 30, label: 'Order respond (IP)' },
  { pattern: /^order-respond-order:/, max: 10, label: 'Order respond (order)' },
  { pattern: /^assistant-chat-user:/, max: 30, label: 'AI Assistant (user)' },
  { pattern: /^assistant-chat-company:/, max: 120, label: 'AI Assistant (company)' },
  { pattern: /^assistant-chat-ip:/, max: 60, label: 'AI Assistant (IP)' },
];

export function getBucketMeta(key: string): { max: number; label: string } {
  for (const entry of RATE_LIMIT_REGISTRY) {
    if (entry.pattern.test(key)) {
      return { max: entry.max, label: entry.label };
    }
  }
  return { max: 10, label: 'Unknown' };
}

export function getSeverity(count: number, max: number): BucketSeverity {
  if (max === 0) return 'green';
  const pct = (count / max) * 100;
  if (pct >= 80) return 'red';
  if (pct >= 50) return 'yellow';
  return 'green';
}

export type RateLimitRowWithMeta = {
  bucket_key: string;
  count: number;
  window_start: string;
  updated_at: string;
  max: number;
  label: string;
  severity: BucketSeverity;
  pct: number;
};
