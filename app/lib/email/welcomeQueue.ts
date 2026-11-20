/**
 * Welcome email queue (owner 2026-11-20).
 *
 * Lifecycle:
 *  1. provisionFreeWorkspace() (complete-signin.ts) enqueues a row at the
 *     moment a Free Workspace is provisioned - the single choke point both
 *     signup paths (Google OAuth first sign-in + email/password confirmation
 *     click) run through, so fire_at = provision + 5 min matches the owner's
 *     spec exactly.
 *  2. The scheduled-messages cron route (every minute via Supabase pg_cron;
 *     the every-30-min vercel.json backup entry) calls sweepWelcomeEmails()
 *     after its own sweep. Rows are claimed atomically (claim_due_welcome_emails RPC,
 *     FOR UPDATE SKIP LOCKED) so overlapping sweeps can never double-send.
 *
 * Gating:
 *  - WELCOME_EMAIL_ENABLED env ('1'/'true') gates sending. Rows still queue
 *    while the flag is off; once enabled, anything older than 48h is marked
 *    skipped_stale instead of sending an ancient "welcome".
 *  - Internal/test addresses never receive it (skipped_test) - protects
 *    e2e signups and agent-created accounts from emailing fake domains.
 */

import 'server-only';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { getUnsubscribeHmacSecret } from '@/app/lib/marketing/adminSecrets';
import { buildOutreachUnsubscribeUrl } from './renderOutreach';
import { sendEmail } from './send';
import { renderWelcomeEmail, WELCOME_EMAIL_FROM, WELCOME_EMAIL_REPLY_TO, WELCOME_EMAIL_SUBJECT } from './templates/welcome';

/** Same classification the 2026-11-17 is_test_account seed used, plus the demo-visitor pattern. */
const TEST_EMAIL_TESTS: ((email: string) => boolean)[] = [
  (e) => e.startsWith('visitor-') && e.endsWith('@demo.invalid'),
  (e) => e.endsWith('@quotecore.test'),
  (e) => e.endsWith('@quotecore.invalid'),
  (e) => e.endsWith('@quote-core.invalid'),
  (e) => e.endsWith('@demo.invalid'),
  (e) => e.endsWith('@example.com'),
  (e) => e.endsWith('@t3play.com'),
  (e) => e.endsWith('@quotecoreapp.com'),
  (e) => e.startsWith('gavin.probe+'),
];

export function isInternalTestEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return TEST_EMAIL_TESTS.some((t) => t(e));
}

export function welcomeEmailEnabled(): boolean {
  const v = process.env.WELCOME_EMAIL_ENABLED;
  return v === '1' || v === 'true';
}

type EnqueueInput = {
  userId: string;
  companyId: string;
  email: string;
  firstName: string | null;
};

/** Best-effort enqueue; never throws (a queue miss must not break sign-in). */
export async function enqueueWelcomeEmail(input: EnqueueInput): Promise<void> {
  try {
    if (!input.email.trim()) {
      console.error('[welcome-email] enqueue skipped: no email on user');
      return;
    }
    const admin = createAdminClient();
    const fireAt = new Date(Date.now() + 5 * 60_000).toISOString();
    // welcome_email_queue is not in the generated DB types (regen pending).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from('welcome_email_queue')
      .upsert(
        {
          user_id: input.userId,
          company_id: input.companyId,
          email: input.email.trim().toLowerCase(),
          first_name: input.firstName?.trim() || null,
          fire_at: fireAt,
        },
        { onConflict: 'user_id', ignoreDuplicates: true },
      );
    if (error) console.error('[welcome-email] enqueue failed:', error.message);
  } catch (err) {
    console.error('[welcome-email] enqueue threw:', err instanceof Error ? err.message : err);
  }
}

export type WelcomeSweepResult = {
  disabled?: boolean;
  claimed: number;
  sent: number;
  skipped: number;
  failed: number;
};

const STALE_AFTER_MS = 48 * 60 * 60_000;
const MAX_ATTEMPTS = 3;

/** Claim + send all due welcome emails. Called every minute by the cron route. */
export async function sweepWelcomeEmails(): Promise<WelcomeSweepResult> {
  const result: WelcomeSweepResult = { claimed: 0, sent: 0, skipped: 0, failed: 0 };
  if (!welcomeEmailEnabled()) {
    result.disabled = true;
    return result;
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = admin as any;

  const { data: rows, error } = await client.rpc('claim_due_welcome_emails', { p_limit: 10 });
  if (error) throw new Error(`claim failed: ${error.message}`);
  const claimed = (rows ?? []) as {
    id: string;
    email: string;
    first_name: string | null;
    fire_at: string;
    attempts: number;
  }[];
  result.claimed = claimed.length;

  for (const row of claimed) {
    const finish = (status: string, patch: Record<string, unknown> = {}) => {
      // Fire-and-forget terminal write; claimed rows stuck in 'sending' are
      // recoverable manually but the RPC claim + attempt cap bounds risk.
      client
        .from('welcome_email_queue')
        .update({ status, ...patch })
        .eq('id', row.id)
        .then(({ error: e }: { error: { message: string } | null }) => {
          if (e) console.error(`[welcome-email] status write failed (${row.id}):`, e.message);
        });
    };

    if (isInternalTestEmail(row.email)) {
      result.skipped += 1;
      finish('skipped_test');
      continue;
    }
    if (Date.parse(row.fire_at) < Date.now() - STALE_AFTER_MS) {
      result.skipped += 1;
      finish('skipped_stale');
      continue;
    }

    const secret = await getUnsubscribeHmacSecret();
    if (!secret) {
      result.failed += 1;
      finish(row.attempts >= MAX_ATTEMPTS ? 'failed' : 'pending', {
        last_error: 'unsubscribe_hmac_secret unavailable',
      });
      continue;
    }

    const unsubscribeUrl = buildOutreachUnsubscribeUrl(row.email, secret);
    const rendered = renderWelcomeEmail({ firstName: row.first_name, unsubscribeUrl });

    const send = await sendEmail({
      to: row.email,
      subject: WELCOME_EMAIL_SUBJECT,
      html: rendered.html,
      text: rendered.text,
      from: WELCOME_EMAIL_FROM,
      replyTo: WELCOME_EMAIL_REPLY_TO,
      tags: [{ name: 'type', value: 'welcome_v1' }],
    });

    if (send.ok) {
      result.sent += 1;
      finish('sent', { sent_at: new Date().toISOString(), resend_id: send.id });
    } else {
      result.failed += 1;
      finish(row.attempts >= MAX_ATTEMPTS ? 'failed' : 'pending', { last_error: send.error });
    }
  }

  return result;
}
