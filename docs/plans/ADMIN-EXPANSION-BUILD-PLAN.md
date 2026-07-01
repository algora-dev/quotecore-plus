# Admin Area Expansion - Build Plan

> **Bundle scope:** 4 new admin features + supporting DB migration + nav updates.
> **Target branch:** `development`
> **Pre-build audit:** Gerald ✅ (report: `workspace-gerald/audits/quotecore-plus-admin-expansion-2026-07-01/04-report.md`)
> **Post-build audit:** Gerald re-audit before merge
> **Estimated effort:** 3-5 days
>
> ---
>
> **Gerald pre-build audit findings (2026-07-01) - ALL ADDRESSED BELOW:**
> - **H-01:** Impersonation reworked - no client-held admin session backup. Opaque session id cookie + server-side resolution. (Feature 6)
> - **H-02:** Audit schema corrected - all examples use `writeAudit()` helper with `admin_user_id`, `admin_email_snapshot`, etc. (Shared Audit Pattern)
> - **H-03:** Storage deletion follows existing `deleteAttachment()` pattern - triggers are primary accounting, no manual recompute. (Feature 4)
> - **M-01:** Rate-limit access uses `createAdminClient()` (service role). (Feature 3)
> - **M-02:** Plan editing uses server-side field allowlist, rejects unknown keys. (Feature 7a)
> - **M-03:** Announcement dismissal scoped to localStorage for this build. (Feature 7c)
> - **M-04:** Cron trigger uses server-side registry with per-route method/header/source. (Feature 7b)

---

## Overview

Add four admin sections that eliminate the most common "ask Gavin to run SQL" scenarios:

| # | Feature | Route | What it does |
|---|---------|-------|--------------|
| 3 | **Rate-limit viewer/reset** | `/admin/rate-limits` | View all rate-limit buckets, see hit counts, reset (zero out) a bucket |
| 4 | **Storage browser** | `/admin/users/[userId]/storage` (tab on user profile) | Browse per-user files (attachments, drawings), delete files, free up storage |
| 6 | **Impersonate user** | `/admin/users/[userId]` (button) | Log in as a user to see their exact view. Full audit logging. |
| 7 | **App-wide settings panel** | `/admin/settings` | View/edit app config: plan table (limits/prices/features), cron status, global announcement banner |

---

## Shared Audit Pattern (Gerald H-02)

All new admin server actions MUST use the existing `writeAudit()` helper. The current production signature (from `app/admin/(dashboard)/users/[userId]/actions.ts:71`):

```typescript
async function writeAudit(
  admin: ReturnType<typeof createAdminClient>,
  adminProfile: { id: string; email: string },
  actionType: string,
  targetCompanyId: string | null,
  targetUserId: string | null,
  targetEmail: string | null,
  targetCompanyName: string | null,
  reason: string | null,
  details: Record<string, unknown> | null,
): Promise<void>
```

**Action:** Extract `writeAudit()` to a shared module: `app/lib/admin/audit.ts`. Export it. All new admin actions import from there. The existing `actions.ts` in the users folder updates its import.

**`admin_actions` table columns (production schema):** `admin_user_id`, `target_company_id`, `target_user_id`, `admin_email_snapshot`, `target_user_email_snapshot`, `target_company_name_snapshot`, `action_type`, `reason`, `details` (jsonb), `created_at`.

**New action_types:** `reset_rate_limit`, `reset_all_rate_limits`, `delete_attachment`, `toggle_archive_attachment`, `impersonation_start`, `impersonation_end`, `update_plan`, `trigger_cron`, `retry_scheduled_message`, `update_announcement`.

---

## Existing Architecture (context for Gerald)

### Admin auth & layout
- **`requireAdmin()`** in `app/lib/supabase/server.ts` - checks `is_admin = true` on profile, redirects to `/admin/login` if not admin.
- **Layout:** `app/admin/(dashboard)/layout.tsx` - wraps all `/admin/*` pages (except `/admin/login`) with the admin shell (header + sidebar).
- **Nav:** `app/admin/(dashboard)/AdminNav.tsx` - sidebar items. Add new sections here.
- **Existing pages:** Dashboard, Admin accounts, Support tickets, Suppressions, Users (list + profile).

### Existing admin patterns to follow
- **User list:** `/admin/users/page.tsx` + `UsersPanel.tsx` (client component, search input, server action for search).
- **User profile:** `/admin/users/[userId]/page.tsx` (server component, fetches data) + `UserProfile.tsx` (client component with sections) + `actions.ts` (server actions).
- **Admin accounts:** `/admin/admins/` - create/revoke admin logins.
- **Server actions pattern:** Each action returns `{ ok: true, message } | { ok: false, error }`. Client wraps in `runAction()` with pending state + notice/error display.
- **Audit logging:** `admin_actions` table. All admin mutations MUST log via `writeAudit()` helper (see Shared Audit Pattern below).

### DB tables relevant to this plan
- **`rate_limits`** - `bucket_key` (text PK), `count`, `window_start`, `updated_at`. No company FK (bucket_key encodes the scope).
- **`scheduled_messages`** - full scheduled message lifecycle. Status: `pending | claimed | sent | failed | cancelled`.
- **`company_attachments`** - `id`, `company_id`, `name`, `file_name`, `file_size`, `mime_type`, `storage_path`, `archived_at`.
- **`subscription_plans`** - plan config table (limits, features, prices, Stripe IDs). All columns are editable.
- **`admin_actions`** - audit log (see Shared Audit Pattern for full schema).

---

## Feature 3: Rate-Limit Viewer/Reset

### Route: `/admin/rate-limits`

### What it does
- Lists all rows in `rate_limits` table.
- Shows `bucket_key`, `count`, `window_start`, `updated_at`.
- Search/filter by bucket_key (text contains).
- "Reset" button per row → sets `count = 0` and `window_start = now()`.
- Batch "Reset all" for filtered results.

### Files to create
| File | Type | Purpose |
|------|------|---------|
| `app/admin/(dashboard)/rate-limits/page.tsx` | Server | Fetch rate_limits (paginated, 100 rows), pass to client |
| `app/admin/(dashboard)/rate-limits/RateLimitsPanel.tsx` | Client | Table + search + reset buttons |
| `app/admin/(dashboard)/rate-limits/actions.ts` | Server actions | `resetRateLimit(bucket_key)`, `resetAllRateLimits(filter?)` |

### Server actions (Gerald M-01: service-role client)
```typescript
// resetRateLimit(bucketKey)
// - const adminProfile = await requireAdmin();
// - const admin = createAdminClient();  // service-role (Gerald M-01)
// - UPDATE rate_limits SET count = 0, window_start = now(), updated_at = now() WHERE bucket_key = $1
// - writeAudit(admin, adminProfile, 'reset_rate_limit', null, null, null, null, null, { bucketKey })
// - Return { ok: true, message: 'Rate limit reset' }

// resetAllRateLimits(filter?)
// - const adminProfile = await requireAdmin();
// - const admin = createAdminClient();
// - UPDATE rate_limits SET count = 0, window_start = now(), updated_at = now()
//     WHERE ($filter IS NULL OR bucket_key ILIKE '%' || $filter || '%')
// - writeAudit(admin, adminProfile, 'reset_all_rate_limits', null, null, null, null, null, { filter, count })
// - Return { ok: true, message: `Reset ${count} rate limits` }
```

### RLS & client access (Gerald M-01)
- `rate_limits` has RLS enabled but NO user-facing policies. Use `createAdminClient()` (service role) for both reads and resets. Do NOT add user-facing RLS policies.

### Security considerations
- **Read access:** Only `is_admin = true` users (enforced by `requireAdmin()` in layout + server action).
- **Write access (reset):** Server action verifies `is_admin` before executing. Logs to `admin_actions` via `writeAudit()`.
- **No PII exposure:** `bucket_key` may contain user IDs but no emails/names. Safe to display.

---

## Feature 4: Storage Browser (per-user tab)

### Route: `/admin/users/[userId]?tab=storage` (tab on existing user profile)

### What it does
- New tab on the existing user profile page: "Storage & Files".
- Shows storage summary: `storage_used_bytes` vs `storage_limit_bytes + storage_topup_bytes` (progress bar).
- Lists all `company_attachments` for the user's company: file name, size, type, created date, archived status.
- Delete file button per row → deletes from Supabase Storage + removes DB row.
- Archive/unarchive toggle per row.
- Shows storage usage recalculation after delete.

### Files to create/modify
| File | Type | Purpose |
|------|------|---------|
| `app/admin/(dashboard)/users/[userId]/actions.ts` | Modified | Add `listAttachments(companyId)`, `deleteAttachment(attachmentId, storagePath)`, `toggleArchiveAttachment(attachmentId)` |
| `app/admin/(dashboard)/users/[userId]/UserProfile.tsx` | Modified | Add "Storage & Files" tab section |
| `app/admin/(dashboard)/users/[userId]/StorageTab.tsx` | Client (new) | Storage progress bar + file table + delete/archive actions |

### Server actions (Gerald H-03: follow existing `deleteAttachment()` pattern from `attachments/actions.ts:269`)
```typescript
// listAttachments(companyId)
// - const admin = createAdminClient();
// - SELECT id, name, file_name, file_size, mime_type, storage_path, archived_at, created_at
//     FROM company_attachments WHERE company_id = $1 ORDER BY created_at DESC
// - Return to client for rendering

// adminDeleteAttachment(attachmentId, targetCompanyId)
// - const adminProfile = await requireAdmin();
// - const admin = createAdminClient();
// - SELECT storage_path, file_name, file_size FROM company_attachments
//     WHERE id = $1 AND company_id = $targetCompanyId  ← company scoping
// - If no row: return { ok: false, error: 'Attachment not found' }
// - Remove storage object: admin.storage.from(BUCKETS.QUOTE_DOCUMENTS).remove([storagePath])
//   (storage trigger decrements storage_used_bytes automatically - DO NOT manually recompute)
// - Null email_templates.attachment_id WHERE attachment_id = $1 AND company_id = $targetCompanyId
//   (same as existing deleteAttachment in attachments/actions.ts)
// - DELETE FROM company_attachments WHERE id = $1 AND company_id = $targetCompanyId
// - writeAudit(admin, adminProfile, 'delete_attachment', targetCompanyId, null, null, null, null,
//     { attachmentId, fileName, fileSizeBytes, storagePath })
// - Return { ok: true, message: 'File deleted' }

// adminToggleArchiveAttachment(attachmentId, targetCompanyId)
// - const adminProfile = await requireAdmin();
// - const admin = createAdminClient();
// - Toggle archived_at (set to now() if NULL, set to NULL if set)
// - Company-scoped: WHERE id = $1 AND company_id = $targetCompanyId
// - writeAudit(admin, adminProfile, 'toggle_archive_attachment', targetCompanyId, null, null, null, null,
//     { attachmentId, archived: $newState })
// - Return { ok: true }
```

### Storage accounting (Gerald H-03)
- **Triggers are primary accounting.** The storage trigger on `company_attachments` handles `storage_used_bytes` increment/decrement. The admin delete action must NOT manually recompute or overwrite `storage_used_bytes`.
- **Delete order matches existing pattern:** (1) fetch row with company scoping, (2) remove storage object, (3) null email_template references, (4) delete DB row. The trigger fires on step 4.
- **No manual recompute.** Reconciliation, if ever needed, would be a separate audited action - NOT part of the delete flow.

### Security considerations
- **Company scoping:** `adminDeleteAttachment` selects with `WHERE id = $1 AND company_id = $targetCompanyId`. Reject if no row. Same pattern as existing `deleteAttachment()` in `attachments/actions.ts:269`.
- **Storage deletion:** Uses `createAdminClient()` (service role). Never expose service role key to client.
- **Audit:** Every delete/archive logged to `admin_actions` via `writeAudit()`.
- **No cascade deletes:** Email template references nulled explicitly. Quotes/orders show "file missing" - safe failure mode.

---

## Feature 6: Impersonate User

### Route: `/admin/users/[userId]` (button on user profile)

### What it does
- Admin clicks "Log in as this user" on the user profile page.
- System creates an impersonation session: admin is now authenticated AS the target user.
- Admin sees exactly what the user sees (their workspace, quotes, settings, etc.).
- A persistent banner shows "You are impersonating [user email]. Exit impersonation."
- "Exit impersonation" returns to the admin's own session.
- Every impersonation start/exit is logged to `admin_actions`.

### Implementation approach (Gerald H-01: server-side overlay, no client-held admin session)

**Session mechanism:** Keep the admin's real Supabase auth session intact. Store only an opaque impersonation session id in an httpOnly cookie. Resolve the target profile server-side on each request.

**Why not JWT session swap (Gerald H-01):** Swapping the Supabase auth cookie to a service-role-signed JWT bypasses Supabase's session assumptions, weakens MFA enforcement, and requires storing the admin's session backup in a client cookie - all high-risk. The overlay approach is safer and still gives a true user view (RLS is enforced because we load the target user's profile and company context server-side).

#### Flow
1. Admin clicks "Impersonate" on `/admin/users/[userId]` → `startImpersonation(targetUserId)` server action.
2. Server action:
   - Verifies admin via `requireAdmin()`.
   - Verifies target user exists, is NOT `is_admin` (block admin-to-admin).
   - Rate-limits: `consume_rate_limit('impersonate:' + adminProfile.id, 10, 3600)` (10/hour per admin).
   - Inserts a row into `admin_impersonation_sessions`: `id`, `admin_user_id`, `target_user_id`, `started_at`, `exit_token`.
   - Sets an httpOnly cookie: `qcp_impersonation` = the session `id` (opaque UUID, NOT a JWT, NOT the admin's session token).
   - Cookie attributes: `httpOnly: true`, `secure: true` (prod), `sameSite: 'lax'`, `path: '/'`, `maxAge: 1800` (30 min hard limit).
   - Does NOT touch the admin's Supabase auth cookie. The admin's real session stays active.
   - Optionally sends notification email to target user.
   - Redirects to `/` (workspace home) to show the target user's view.
3. On every request, `getCurrentProfile()` in `server.ts` checks for the `qcp_impersonation` cookie:
   - If present, read the session id.
   - Query `admin_impersonation_sessions` by id WHERE `ended_at IS NULL` AND `started_at > now() - interval '30 minutes'`.
   - If active: load the TARGET user's profile (by `target_user_id`) instead of the admin's.
   - Attach metadata: `profile.isImpersonating = true`, `profile.impersonationAdminUserId`, `profile.impersonationAdminEmail`, `profile.impersonationSessionId`.
   - If session not found or expired: ignore the cookie. The admin's real session takes over.
4. The root layout renders `ImpersonationBanner` when `profile.isImpersonating` is true.
5. "Exit impersonation" → `endImpersonation()` server action:
   - Reads `qcp_impersonation` cookie → session id.
   - `UPDATE admin_impersonation_sessions SET ended_at = now() WHERE id = $1`.
   - Deletes the `qcp_impersonation` cookie.
   - Redirects to `/admin/users/[targetUserId]`.
6. The admin's Supabase auth session was never modified, so no "restore" step is needed.

#### What about RLS?
- The admin's auth session is still the admin's. But `getCurrentProfile()` returns the target user's profile. All downstream data fetching uses `profile.company_id` to scope queries. RLS policies that check `company_id` membership work correctly.
- **Limitation:** If a query uses `auth.uid()` in RLS (not `company_id`), the admin's `auth.uid()` won't match the target user. This is a known trade-off. For QuoteCore+, most RLS is company-scoped. Gerald should verify which tables use `auth.uid()` in RLS.

### DB migration (Gerald H-01: no admin_session_backup column)
```sql
CREATE TABLE admin_impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  exit_token UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_impersonation_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_can_read_own_sessions ON admin_impersonation_sessions
  FOR SELECT USING (auth.uid() = admin_user_id);
CREATE POLICY admin_can_insert_own_sessions ON admin_impersonation_sessions
  FOR INSERT WITH CHECK (auth.uid() = admin_user_id);
CREATE POLICY admin_can_update_own_sessions ON admin_impersonation_sessions
  FOR UPDATE USING (auth.uid() = admin_user_id);
-- No DELETE policy - sessions are never deleted, only marked ended_at.
```

### Files to create/modify
| File | Type | Purpose |
|------|------|---------|
| `app/admin/(dashboard)/users/[userId]/actions.ts` | Modified | Add `startImpersonation(targetUserId)`, `endImpersonation()` |
| `app/admin/(dashboard)/users/[userId]/UserProfile.tsx` | Modified | Add "Impersonate" button (with confirm modal) |
| `app/lib/supabase/server.ts` | Modified | `getProfile()` checks for impersonation cookie, loads target user if active |
| `app/components/ImpersonationBanner.tsx` | Client (new) | Persistent banner with "Exit impersonation" button |
| `app/(app)/layout.tsx` or root layout | Modified | Render `ImpersonationBanner` when `isImpersonating` |

### Server actions (Gerald H-01: no JWT, no admin session backup)
```typescript
// startImpersonation(targetUserId, opts?: { notifyUser?: boolean })
// - const adminProfile = await requireAdmin();
// - const admin = createAdminClient();
// - Rate limit: consume_rate_limit('impersonate:' + adminProfile.id, 10, 3600)
// - SELECT id, email, is_admin FROM users WHERE id = $targetUserId
// - If not found: return { ok: false, error: 'User not found' }
// - If is_admin: return { ok: false, error: 'Cannot impersonate an admin' }
// - INSERT INTO admin_impersonation_sessions (admin_user_id, target_user_id) VALUES ($adminProfile.id, $targetUserId)
//   → returns session.id
// - Set cookie: qcp_impersonation = session.id  (httpOnly, secure, sameSite=lax, maxAge=1800)
// - If opts.notifyUser: send notification email to target user
// - writeAudit(admin, adminProfile, 'impersonation_start', null, targetUserId, targetEmail, null, null, { sessionId, notifyUser })
// - Return { ok: true, redirect: '/' }

// endImpersonation()
// - Read qcp_impersonation cookie → sessionId
// - const admin = createAdminClient();
// - SELECT admin_user_id, target_user_id FROM admin_impersonation_sessions WHERE id = $sessionId AND ended_at IS NULL
// - If not found: just clear the cookie, return { ok: true, redirect: '/admin' }
// - UPDATE admin_impersonation_sessions SET ended_at = now() WHERE id = $sessionId
// - Delete qcp_impersonation cookie
// - writeAudit(admin, { id: adminUserId, email: adminEmail }, 'impersonation_end', null, targetUserId, targetEmail, null, null, { sessionId })
// - Return { ok: true, redirect: '/admin/users/' + targetUserId }
```

### Security considerations (Gerald H-01 addressed)

1. **Admin-to-admin impersonation:** BLOCKED. Server action rejects if target user `is_admin = true`.

2. **No client-held admin session (Gerald H-01):** The admin's Supabase auth session is never modified. Only an opaque session id UUID is stored in the `qcp_impersonation` cookie. There is no `admin_session_backup` cookie. If the cookie is tampered with, the session id won't match a DB row and impersonation is ignored - the admin's real session takes over.

3. **Session expiry:** 30-minute hard limit via DB check (`started_at > now() - interval '30 minutes'`). Cookie also has `maxAge: 1800`. If both expire, the admin's real session takes over automatically.

4. **Impersonation banner:** MUST be visible on EVERY page. Rendered in the root layout when `profile.isImpersonating` is true. If the banner fails to render, the admin can still navigate to `/admin` and exit manually.

5. **Audit trail:** Every impersonation start AND end logged to `admin_actions` via `writeAudit()`. Session row in `admin_impersonation_sessions` also tracks start/end times.

6. **Cookie cleanup on logout:** If admin logs out while impersonating, the `qcp_impersonation` cookie must be cleared and the session marked as ended.

7. **Rate limiting:** Limit impersonation starts to 10/hour per admin via `consume_rate_limit()`.

8. **Target user notification:** Optional. If "Notify user" checkbox is checked, send an email to the target user after impersonation ends. Default: checked.

9. **RLS limitation:** The admin's `auth.uid()` stays their own. Data scoped by `company_id` works correctly. Data scoped by `auth.uid()` (user-level) will show the admin's user, not the target's. This is a known trade-off.

---

## Feature 7: App-Wide Settings Panel

### Route: `/admin/settings`

### What it does

Three sub-sections (tabbed):

#### 7a. Plan Management
- Edit `subscription_plans` table from the UI.
- Editable fields: `display_name`, `tagline`, `price_cents_monthly`, `price_cents_monthly_original`, `active`, `coming_soon`, `sort_order`, all `feat_*` booleans, all limit fields (`monthly_quote_limit`, `storage_limit_bytes`, `component_limit`, etc.), `monthly_ai_tokens`, `included_seats`.
- **NOT editable from this panel:** `stripe_price_id_test`, `stripe_price_id_live`, `stripe_launch_coupon_id`, `code`. These are Stripe-coupled and dangerous. Show as read-only. Changes to Stripe prices require the full price-change procedure (MEMORY.md PRICING section).
- Save → server action updates the row. Audit logged.
- **Price change guard:** If `price_cents_monthly` is changed, show a warning: "Changing the display price without updating the Stripe Price ID will cause a drift. Only change this if you've already created the new Stripe Price. Run check-price-drift after." The server action should NOT allow `price_cents_monthly` to change without also changing `stripe_price_id_test` - OR require a "I understand the risk" confirmation checkbox.

#### 7b. Cron Job Status
- Shows all Vercel cron jobs (from `vercel.json`) with their schedules.
- Shows last execution time + status (if we can detect it - see below).
- Shows the scheduled messages queue: count of `scheduled_messages` by status (`pending`, `claimed`, `failed`).
- Shows count of `rate_limits` rows.
- **Manual trigger button** for each cron job (sends a GET to the cron URL with the CRON_SECRET). Useful for testing.
- **Failed scheduled messages:** List the 10 most recent `failed` scheduled messages with error details + "Retry" button (sets status back to `pending`).

#### 7c. Global Announcement Banner
- New table `app_settings` (key-value) or a `global_announcements` table.
- Admin can create/edit/delete an announcement banner that shows to ALL users in the app.
- Fields: `message` (text), `type` (info/warning/maintenance), `active` (boolean), `starts_at`, `ends_at`, `dismissible` (boolean).
- The banner renders at the top of the app (above the main nav) for all users when active and within the date range.

### DB migration
```sql
-- App settings table (key-value for general config)
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT/UPDATE/DELETE policies for non-admins - server actions use service role.
-- Admins access via server actions with is_admin check.

-- Seed default announcement key
INSERT INTO app_settings (key, value, updated_by_user_id)
VALUES ('global_announcement', '{"active": false, "message": "", "type": "info", "starts_at": null, "ends_at": null, "dismissible": true}', NULL)
ON CONFLICT (key) DO NOTHING;
```

### Files to create
| File | Type | Purpose |
|------|------|---------|
| `app/admin/(dashboard)/settings/page.tsx` | Server | Fetch plan table + cron status + announcement, pass to client |
| `app/admin/(dashboard)/settings/SettingsPanel.tsx` | Client | Tabbed interface (Plans / Crons / Announcement) |
| `app/admin/(dashboard)/settings/PlanManagementTab.tsx` | Client | Editable plan table |
| `app/admin/(dashboard)/settings/CronStatusTab.tsx` | Client | Cron job list + manual trigger + scheduled messages queue |
| `app/admin/(dashboard)/settings/AnnouncementTab.tsx` | Client | Announcement banner editor |
| `app/admin/(dashboard)/settings/actions.ts` | Server actions | `updatePlan(planCode, fields)`, `triggerCronJob(path)`, `retryScheduledMessage(id)`, `updateAnnouncement(config)` |
| `app/components/GlobalAnnouncementBanner.tsx` | Client (new) | Renders announcement banner app-wide when active |
| `app/(app)/layout.tsx` | Modified | Fetch announcement from `app_settings`, render banner |

### Server actions (Gerald M-02: server-side allowlist; M-04: cron registry)
```typescript
// updatePlan(planCode, fields)
// - const adminProfile = await requireAdmin();
// - const admin = createAdminClient();
// - ALLOWLIST (server-side, reject unknown keys):
//     const ALLOWED = ['display_name','tagline','price_cents_monthly','price_cents_monthly_original',
//       'active','coming_soon','sort_order','feat_activity_card','feat_attachment_library','feat_catalogs',
//       'feat_digital_takeoff','feat_email_send','feat_flashings','feat_followups','feat_invoices',
//       'feat_material_orders','feat_message_center','flashing_limit','included_seats','monthly_ai_tokens',
//       'monthly_invoice_limit','monthly_material_order_limit','monthly_quote_limit','storage_limit_bytes',
//       'attachment_limit','catalog_limit','component_limit'];
// - Reject if any key in fields is not in ALLOWED.
// - NEVER allow: stripe_price_id_test, stripe_price_id_live, stripe_launch_coupon_id, code.
// - If price_cents_monthly is changing: require fields._priceChangeAcknowledged === true, else reject.
// - UPDATE subscription_plans SET <allowlisted fields> WHERE code = $planCode
// - writeAudit(admin, adminProfile, 'update_plan', null, null, null, null, null, { planCode, changedFields })
// - Return { ok: true, message: 'Plan updated' }

// triggerCronJob(jobName)  ← Gerald M-04: server-side registry
// - const adminProfile = await requireAdmin();
// - const admin = createAdminClient();
// - CRON_REGISTRY (server-side, hardcoded - never derived from client input):
//     [
//       { name: 'prune_rate_limits', path: '/api/cron/prune-rate-limits', method: 'GET', source: 'vercel' },
//       { name: 'sweep_orphan_objects', path: '/api/cron/sweep-orphan-objects', method: 'GET', source: 'vercel' },
//       { name: 'expire_trials', path: '/api/cron/expire-trials', method: 'GET', source: 'vercel' },
//       { name: 'process_billing_lifecycle', path: '/api/cron/process-billing-lifecycle', method: 'GET', source: 'vercel' },
//       { name: 'expire_quotes', path: '/api/cron/expire-quotes', method: 'GET', source: 'vercel' },
//       { name: 'dispatch_scheduled_messages', path: '/api/cron/dispatch-scheduled-messages', method: 'GET', source: 'supabase_pg_cron' },
//     ]
// - Look up job by name. If not found, reject.
// - Fetch: GET <app_url><path> with header Authorization: Bearer <CRON_SECRET>
// - writeAudit(admin, adminProfile, 'trigger_cron', null, null, null, null, null, { jobName, path, responseStatus })
// - Return { ok: true, message: 'Cron job triggered', result: <response> }

// retryScheduledMessage(id)
// - const adminProfile = await requireAdmin();
// - const admin = createAdminClient();
// - UPDATE scheduled_messages SET status = 'pending', failed_error = NULL, fire_at = now()
//     WHERE id = $1 AND status = 'failed'
// - writeAudit(admin, adminProfile, 'retry_scheduled_message', null, null, null, null, null, { id })
// - Return { ok: true, message: 'Message queued for retry' }

// updateAnnouncement(config)
// - const adminProfile = await requireAdmin();
// - const admin = createAdminClient();
// - Validate config: { active: boolean, message: string (max 500 chars), type: 'info'|'warning'|'maintenance', starts_at: string|null, ends_at: string|null, dismissible: boolean }
// - UPSERT INTO app_settings (key, value, updated_by_user_id) VALUES ('global_announcement', $config::jsonb, $adminProfile.id)
// - writeAudit(admin, adminProfile, 'update_announcement', null, null, null, null, null, { config })
// - Return { ok: true, message: 'Announcement updated' }
```

### Security considerations

1. **Plan management - Stripe price guard (Gerald M-02):** The `stripe_price_id_*`, `stripe_launch_coupon_id`, and `code` columns are NOT in the server-side allowlist. The server action rejects any request containing keys outside the allowlist. Changing `price_cents_monthly` requires an explicit `_priceChangeAcknowledged` flag.

2. **Cron trigger - CRON_SECRET (Gerald M-04):** The CRON_SECRET env var is only accessible server-side. The server action uses a hardcoded CRON_REGISTRY (never derived from client input) to resolve the job path and method. The secret is never sent to the client.

3. **Announcement - XSS risk:** The announcement message is rendered as text (not HTML) in the banner component. No `dangerouslySetInnerHTML`. Tailwind classes only.

4. **`app_settings` table - no RLS for regular users (Gerald M-02):** Regular users cannot read or write this table directly (no RLS policies). The announcement is fetched server-side in the layout and passed as a prop. No client-side fetching of `app_settings`.

5. **Announcement dismissal (Gerald M-03):** `localStorage` only for this build. No DB column. A `users.announcement_dismissed_at` column can be added in a future migration if cross-device dismissal is needed.

6. **Cron status visibility:** `cron_execution_log` table for scheduled messages dispatch only. The dispatch route writes a row at start + updates on finish. Other crons use the "Trigger now" button without history.

---

## DB Migration Summary

**Single migration file:** `supabase/migrations/20260701120000_admin_expansion.sql`

```sql
-- 1. admin_impersonation_sessions table (Feature 6)
CREATE TABLE admin_impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  exit_token UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_impersonation_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_can_read_own_sessions ON admin_impersonation_sessions
  FOR SELECT USING (auth.uid() = admin_user_id);
CREATE POLICY admin_can_insert_own_sessions ON admin_impersonation_sessions
  FOR INSERT WITH CHECK (auth.uid() = admin_user_id);
CREATE POLICY admin_can_update_own_sessions ON admin_impersonation_sessions
  FOR UPDATE USING (auth.uid() = admin_user_id);
-- No DELETE policy - sessions are never deleted, only marked ended_at.

-- 2. app_settings table (Feature 7)
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
-- No policies - access is service-role only (server actions with is_admin check).

INSERT INTO app_settings (key, value, updated_by_user_id)
VALUES ('global_announcement', '{"active": false, "message": "", "type": "info", "starts_at": null, "ends_at": null, "dismissible": true}'::jsonb, NULL)
ON CONFLICT (key) DO NOTHING;

-- 3. cron_execution_log table (Feature 7b - for scheduled messages dispatch)
CREATE TABLE cron_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running', -- running | success | failed
  error TEXT,
  details JSONB
);

ALTER TABLE cron_execution_log ENABLE ROW LEVEL SECURITY;
-- No policies - service-role only.

-- 4. Add admin_action_types for new features (documentation, not enforced)
-- Existing admin_actions table covers all new actions via action_type text column.
-- New action_types: 'reset_rate_limit', 'reset_all_rate_limits', 'delete_attachment',
-- 'toggle_archive_attachment', 'impersonation_start', 'impersonation_end',
-- 'update_plan', 'trigger_cron', 'retry_scheduled_message', 'update_announcement'
```

---

## Nav Updates

**`AdminNav.tsx`** - add two new items:

```typescript
const ADMIN_NAV = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Admin accounts', href: '/admin/admins' },
  { label: 'Support tickets', href: '/admin/support-tickets' },
  { label: 'Suppressions', href: '/admin/suppressions' },
  { label: 'Users', href: '/admin/users' },
  { label: 'Rate limits', href: '/admin/rate-limits' },         // NEW
  { label: 'Settings', href: '/admin/settings' },               // NEW
  { label: 'Companies', href: '/admin/companies', soon: true },
];
```

---

## Build Order (recommended sequence)

1. **DB migration** - apply first, regen types.
2. **Feature 3: Rate-limit viewer** - simplest, no dependencies. Quick win.
3. **Feature 7: App-wide settings** - medium complexity, high value. Plan management + announcement banner.
4. **Feature 4: Storage browser** - adds tab to existing user profile. Medium complexity.
5. **Feature 6: Impersonate user** - highest complexity, highest risk. Build last so all other admin work is stable.
6. **Full `next build`** - must pass before shipping.
7. **Add smoke test items** to `docs/smoke-tests/CHECKLIST.md`.

---

## Design system compliance

All new UI MUST follow `docs/DESIGN_SYSTEM.md`:
- **Buttons:** `rounded-full`, primary = `bg-black`, accent = `bg-[#FF6B35]`.
- **Table rows:** `rounded-xl border bg-white hover:bg-orange-50/40 hover:border-orange-200`.
- **Status badges:** `rounded-full px-2.5 py-1 text-xs` with dot.
- **Filter tabs:** `rounded-full border text-xs`, active = `bg-slate-900`.
- **Modal overlay:** `backdrop-blur-sm bg-black/40`.
- **Inputs/selects:** `rounded-lg focus:border-orange-500 focus:outline-none`.
- **Icons:** Heroicons outline 24×24.
- **Empty state:** `rounded-xl border-dashed border-slate-200 px-6 py-12`.

Reference components: `UsersPanel.tsx`, `UserProfile.tsx`, `ConfirmModal.tsx`.

---

## Security summary for Gerald

| Feature | Risk level | Key concerns |
|---------|-----------|--------------|
| Rate-limit viewer | LOW | Read-only + simple reset. No cross-tenant data. Admin-gated. Service-role client. |
| Storage browser | MEDIUM | Deleting files affects user data. Company scoping on every query. Storage trigger is primary accounting (no manual recompute). |
| Impersonate user | HIGH | Opaque session cookie, admin-to-admin block, banner visibility, audit trail, 30-min expiry, cookie cleanup on logout. RLS limitation (auth.uid stays admin's). |
| App-wide settings | MEDIUM | Plan edits affect billing. Server-side allowlist prevents Stripe field mutation. Announcement XSS (text-only rendering). Cron secret never exposed. Hardcoded CRON_REGISTRY. |

### What Gerald should re-audit post-build
1. **Impersonation overlay** - `getCurrentProfile()` cookie check, session resolution, admin-to-admin block, banner enforcement, session expiry, cookie cleanup on logout.
2. **Storage delete company scoping** - verify `WHERE id = $1 AND company_id = $targetCompanyId` on every query.
3. **Plan update allowlist** - verify server action rejects unknown keys. Verify `stripe_price_id_*` and `code` are never updateable.
4. **`app_settings` RLS** - verify no client-side access path exists. All access through server actions with `is_admin` check.
5. **Cron trigger** - verify CRON_SECRET is never sent to the client. CRON_REGISTRY is hardcoded. Server-side fetch only.
6. **Audit completeness** - every mutating server action calls `writeAudit()` with correct snapshots.

---

## Out of scope (explicitly excluded)

- Quotes/Orders/Invoices browser (not requested by Shaun in this round).
- Scheduled messages full dashboard (only the failed-retry surface in Settings > Crons is included; a dedicated dashboard can come later).
- Feature flags / entitlements unified panel (the plan management tab covers most of this).
- Companies page (already marked "Soon" in nav).
- Super-admin role / granular admin permissions (future).

---

## Open questions for Shaun (none blocking - build can proceed with defaults)

1. **Impersonation TTL:** 30 min hard limit (default). Enough for most support sessions. Can be extended later if needed.
2. **Target user notification:** Email the user after impersonation? (Default: yes, toggleable per-impersonation via checkbox.)
3. **Cron execution log:** `cron_execution_log` table for scheduled messages dispatch only (default). Other crons use trigger button without history.
4. **Announcement banner dismissal:** `localStorage` only for this build (default - Gerald M-03). No DB column. Cross-device dismissal can come later.

---

## File manifest

### New files (16)
```
app/lib/admin/audit.ts                                     - shared writeAudit() helper (Gerald H-02)
app/admin/(dashboard)/rate-limits/page.tsx
app/admin/(dashboard)/rate-limits/RateLimitsPanel.tsx
app/admin/(dashboard)/rate-limits/actions.ts
app/admin/(dashboard)/settings/page.tsx
app/admin/(dashboard)/settings/SettingsPanel.tsx
app/admin/(dashboard)/settings/PlanManagementTab.tsx
app/admin/(dashboard)/settings/CronStatusTab.tsx
app/admin/(dashboard)/settings/AnnouncementTab.tsx
app/admin/(dashboard)/settings/actions.ts
app/admin/(dashboard)/users/[userId]/StorageTab.tsx
app/components/GlobalAnnouncementBanner.tsx
app/components/ImpersonationBanner.tsx
supabase/migrations/20260701120000_admin_expansion.sql
docs/plans/ADMIN-EXPANSION-BUILD-PLAN.md  (this file)
docs/smoke-tests/CHECKLIST.md  (updated - add items)
```

### Modified files (6)
```
app/admin/(dashboard)/AdminNav.tsx                          - add Rate limits + Settings nav items
app/admin/(dashboard)/users/[userId]/actions.ts             - import shared writeAudit; add storage + impersonation actions
app/admin/(dashboard)/users/[userId]/UserProfile.tsx        - add Storage tab + Impersonate button
app/lib/supabase/server.ts                                  - getCurrentProfile() impersonation cookie check
app/(app)/layout.tsx                                        - render announcement banner + impersonation banner
app/api/cron/dispatch-scheduled-messages/route.ts           - write cron_execution_log rows (start + finish)
```

---

*End of build plan v2. Gerald pre-build audit findings incorporated. Re-audit required post-build before merge.*
