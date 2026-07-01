'use server';

import { requireAdmin } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { writeAudit } from '@/app/lib/admin/audit';
import type { Database } from '@/app/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PlanRow = Database['public']['Tables']['subscription_plans']['Row'];

export type PlanData = Pick<
  PlanRow,
  | 'code' | 'display_name' | 'tagline' | 'price_cents_monthly' | 'price_cents_monthly_original'
  | 'active' | 'coming_soon' | 'sort_order'
  | 'feat_activity_card' | 'feat_attachment_library' | 'feat_catalogs' | 'feat_digital_takeoff'
  | 'feat_email_send' | 'feat_flashings' | 'feat_followups' | 'feat_invoices'
  | 'feat_material_orders' | 'feat_message_center'
  | 'flashing_limit' | 'included_seats' | 'monthly_ai_tokens'
  | 'monthly_invoice_limit' | 'monthly_material_order_limit' | 'monthly_quote_limit'
  | 'storage_limit_bytes' | 'attachment_limit' | 'catalog_limit' | 'component_limit'
  | 'stripe_price_id_test' | 'stripe_price_id_live'
>;

export interface AnnouncementConfig {
  active: boolean;
  message: string;
  type: 'info' | 'warning' | 'maintenance';
  starts_at: string | null;
  ends_at: string | null;
  dismissible: boolean;
}

export interface CronJobInfo {
  name: string;
  path: string;
  method: 'GET';
  source: 'vercel' | 'supabase_pg_cron';
  schedule: string;
}

export interface CronStatusData {
  jobs: CronJobInfo[];
  scheduledMessageStats: { pending: number; claimed: number; failed: number; sent: number };
  rateLimitCount: number;
  lastDispatchLog: { id: string; status: string; started_at: string; finished_at: string | null; error: string | null } | null;
  failedMessages: { id: string; recipient_email: string; trigger_event: string; failed_error: string; fire_at: string }[];
}

export type SettingsDataResult =
  | { ok: true; plans: PlanData[]; announcement: AnnouncementConfig; cronStatus: CronStatusData }
  | { ok: false; error: string };

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Server-side allowlist for plan updates (Gerald M-02)
// ---------------------------------------------------------------------------

const PLAN_EDITABLE_FIELDS = [
  'display_name', 'tagline', 'price_cents_monthly', 'price_cents_monthly_original',
  'active', 'coming_soon', 'sort_order',
  'feat_activity_card', 'feat_attachment_library', 'feat_catalogs', 'feat_digital_takeoff',
  'feat_email_send', 'feat_flashings', 'feat_followups', 'feat_invoices',
  'feat_material_orders', 'feat_message_center',
  'flashing_limit', 'included_seats', 'monthly_ai_tokens',
  'monthly_invoice_limit', 'monthly_material_order_limit', 'monthly_quote_limit',
  'storage_limit_bytes', 'attachment_limit', 'catalog_limit', 'component_limit',
] as const;

// ---------------------------------------------------------------------------
// CRON_REGISTRY (Gerald M-04: hardcoded, never derived from client input)
// ---------------------------------------------------------------------------

const CRON_REGISTRY: CronJobInfo[] = [
  { name: 'prune_rate_limits', path: '/api/cron/prune-rate-limits', method: 'GET', source: 'vercel', schedule: 'Daily 4:17 AM' },
  { name: 'sweep_orphan_objects', path: '/api/cron/sweep-orphan-objects', method: 'GET', source: 'vercel', schedule: 'Daily 5:33 AM' },
  { name: 'expire_trials', path: '/api/cron/expire-trials', method: 'GET', source: 'vercel', schedule: 'Daily 6:09 AM' },
  { name: 'process_billing_lifecycle', path: '/api/cron/process-billing-lifecycle', method: 'GET', source: 'vercel', schedule: 'Daily 6:22 AM' },
  { name: 'expire_quotes', path: '/api/cron/expire-quotes', method: 'GET', source: 'vercel', schedule: 'Every hour' },
  { name: 'dispatch_scheduled_messages', path: '/api/cron/dispatch-scheduled-messages', method: 'GET', source: 'supabase_pg_cron', schedule: 'Every 30 min (Vercel)' },
];

// ---------------------------------------------------------------------------
// getSettingsData
// ---------------------------------------------------------------------------

export async function getSettingsData(): Promise<SettingsDataResult> {
  await requireAdmin();
  const admin = createAdminClient();

  // Fetch plans
  const { data: plans, error: plansErr } = await admin
    .from('subscription_plans')
    .select('code, display_name, tagline, price_cents_monthly, price_cents_monthly_original, active, coming_soon, sort_order, feat_activity_card, feat_attachment_library, feat_catalogs, feat_digital_takeoff, feat_email_send, feat_flashings, feat_followups, feat_invoices, feat_material_orders, feat_message_center, flashing_limit, included_seats, monthly_ai_tokens, monthly_invoice_limit, monthly_material_order_limit, monthly_quote_limit, storage_limit_bytes, attachment_limit, catalog_limit, component_limit, stripe_price_id_test, stripe_price_id_live')
    .order('sort_order');

  if (plansErr) {
    return { ok: false, error: plansErr.message };
  }

  // Fetch announcement
  const { data: setting } = await admin
    .from('app_settings')
    .select('value')
    .eq('key', 'global_announcement')
    .single();

  const announcement: AnnouncementConfig = (setting?.value as unknown as AnnouncementConfig) ?? {
    active: false, message: '', type: 'info', starts_at: null, ends_at: null, dismissible: true,
  };

  // Scheduled message stats
  const { count: pendingCount } = await admin
    .from('scheduled_messages')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  const { count: claimedCount } = await admin
    .from('scheduled_messages')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'claimed');

  const { count: failedCount } = await admin
    .from('scheduled_messages')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'failed');

  const { count: sentCount } = await admin
    .from('scheduled_messages')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent');

  // Rate limit count
  const { count: rlCount } = await admin
    .from('rate_limits')
    .select('bucket_key', { count: 'exact', head: true });

  // Last dispatch log
  const { data: lastLog } = await admin
    .from('cron_execution_log')
    .select('id, status, started_at, finished_at, error')
    .eq('job_name', 'dispatch_scheduled_messages')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Failed messages (10 most recent)
  const { data: failedMsgs } = await admin
    .from('scheduled_messages')
    .select('id, recipient_email, trigger_event, failed_error, fire_at')
    .eq('status', 'failed')
    .order('fire_at', { ascending: false })
    .limit(10);

  return {
    ok: true,
    plans: (plans ?? []) as PlanData[],
    announcement,
    cronStatus: {
      jobs: CRON_REGISTRY,
      scheduledMessageStats: {
        pending: pendingCount ?? 0,
        claimed: claimedCount ?? 0,
        failed: failedCount ?? 0,
        sent: sentCount ?? 0,
      },
      rateLimitCount: rlCount ?? 0,
      lastDispatchLog: lastLog as CronStatusData['lastDispatchLog'],
      failedMessages: (failedMsgs ?? []) as CronStatusData['failedMessages'],
    },
  };
}

// ---------------------------------------------------------------------------
// updatePlan (Gerald M-02: server-side allowlist)
// ---------------------------------------------------------------------------

export async function updatePlan(
  planCode: string,
  fields: Record<string, unknown>,
  priceChangeAcknowledged: boolean,
): Promise<ActionResult> {
  const adminProfile = await requireAdmin();
  const admin = createAdminClient();

  // Reject unknown keys
  const allowedSet = new Set<string>(PLAN_EDITABLE_FIELDS);
  const submittedKeys = Object.keys(fields);
  const unknownKeys = submittedKeys.filter((k) => !allowedSet.has(k));

  if (unknownKeys.length > 0) {
    return { ok: false, error: `Unknown fields not allowed: ${unknownKeys.join(', ')}` };
  }

  // Check price change
  if ('price_cents_monthly' in fields && !priceChangeAcknowledged) {
    return { ok: false, error: 'Price change requires acknowledgement. Check the box to confirm you have updated the Stripe Price.' };
  }

  // Fetch current values for audit diff
  const { data: current } = await admin
    .from('subscription_plans')
    .select('display_name, tagline, price_cents_monthly, price_cents_monthly_original, active, coming_soon, sort_order, feat_activity_card, feat_attachment_library, feat_catalogs, feat_digital_takeoff, feat_email_send, feat_flashings, feat_followups, feat_invoices, feat_material_orders, feat_message_center, flashing_limit, included_seats, monthly_ai_tokens, monthly_invoice_limit, monthly_material_order_limit, monthly_quote_limit, storage_limit_bytes, attachment_limit, catalog_limit, component_limit')
    .eq('code', planCode)
    .single();

  const changedFields: Record<string, { from: unknown; to: unknown }> = {};
  if (current) {
    for (const key of submittedKeys) {
      const oldVal = (current as Record<string, unknown>)[key];
      const newVal = fields[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changedFields[key] = { from: oldVal, to: newVal };
      }
    }
  }

  if (Object.keys(changedFields).length === 0) {
    return { ok: true, message: 'No changes detected.' };
  }

  const { error } = await admin
    .from('subscription_plans')
    .update(fields)
    .eq('code', planCode);

  if (error) {
    return { ok: false, error: error.message };
  }

  await writeAudit(
    admin,
    adminProfile,
    'update_plan',
    null,
    null,
    null,
    null,
    null,
    { planCode, changedFields },
  );

  return { ok: true, message: `Plan "${planCode}" updated (${Object.keys(changedFields).length} field${Object.keys(changedFields).length !== 1 ? 's' : ''})` };
}

// ---------------------------------------------------------------------------
// triggerCronJob (Gerald M-04: server-side registry)
// ---------------------------------------------------------------------------

export async function triggerCronJob(jobName: string): Promise<ActionResult> {
  const adminProfile = await requireAdmin();
  const admin = createAdminClient();

  const job = CRON_REGISTRY.find((j) => j.name === jobName);
  if (!job) {
    return { ok: false, error: `Unknown cron job: ${jobName}` };
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return { ok: false, error: 'CRON_SECRET is not configured' };
  }

  // Determine the app URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.quote-core.com';

  let responseStatus = 0;
  let responseBody = '';

  try {
    const resp = await fetch(`${appUrl}${job.path}`, {
      method: job.method,
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    });
    responseStatus = resp.status;
    responseBody = await resp.text();
  } catch (err) {
    responseStatus = 0;
    responseBody = err instanceof Error ? err.message : 'fetch failed';
  }

  await writeAudit(
    admin,
    adminProfile,
    'trigger_cron',
    null,
    null,
    null,
    null,
    null,
    { jobName, path: job.path, responseStatus, responseBody: responseBody.slice(0, 500) },
  );

  if (responseStatus >= 200 && responseStatus < 300) {
    return { ok: true, message: `Triggered "${jobName}" (${responseStatus})` };
  }

  return { ok: false, error: `Trigger failed (${responseStatus}): ${responseBody.slice(0, 200)}` };
}

// ---------------------------------------------------------------------------
// retryScheduledMessage
// ---------------------------------------------------------------------------

export async function retryScheduledMessage(id: string): Promise<ActionResult> {
  const adminProfile = await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from('scheduled_messages')
    .update({
      status: 'pending',
      failed_error: null,
      fire_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'failed');

  if (error) {
    return { ok: false, error: error.message };
  }

  await writeAudit(
    admin,
    adminProfile,
    'retry_scheduled_message',
    null,
    null,
    null,
    null,
    null,
    { id },
  );

  return { ok: true, message: 'Message queued for retry' };
}

// ---------------------------------------------------------------------------
// updateAnnouncement
// ---------------------------------------------------------------------------

export async function updateAnnouncement(config: AnnouncementConfig): Promise<ActionResult> {
  const adminProfile = await requireAdmin();
  const admin = createAdminClient();

  // Validate
  if (config.message.length > 500) {
    return { ok: false, error: 'Message must be 500 characters or less' };
  }
  if (!['info', 'warning', 'maintenance'].includes(config.type)) {
    return { ok: false, error: 'Invalid announcement type' };
  }

  const { error } = await admin
    .from('app_settings')
    .upsert({
      key: 'global_announcement',
      value: config as unknown as import('@/app/lib/supabase/database.types').Json,
      updated_at: new Date().toISOString(),
      updated_by_user_id: adminProfile.id,
    }, { onConflict: 'key' });

  if (error) {
    return { ok: false, error: error.message };
  }

  await writeAudit(
    admin,
    adminProfile,
    'update_announcement',
    null,
    null,
    null,
    null,
    null,
    { config },
  );

  return { ok: true, message: 'Announcement updated' };
}

// ---------------------------------------------------------------------------
// getAnnouncement (for app layout — no admin check)
// ---------------------------------------------------------------------------

export async function getAnnouncement(): Promise<AnnouncementConfig | null> {
  const admin = createAdminClient();

  const { data } = await admin
    .from('app_settings')
    .select('value')
    .eq('key', 'global_announcement')
    .single();

  if (!data?.value) return null;

  const config = data.value as unknown as AnnouncementConfig;

  // Check if active and within date range
  if (!config.active) return null;

  const now = new Date();
  if (config.starts_at && new Date(config.starts_at) > now) return null;
  if (config.ends_at && new Date(config.ends_at) < now) return null;

  return config;
}
