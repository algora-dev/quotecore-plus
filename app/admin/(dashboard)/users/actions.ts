'use server';

/**
 * Admin "Delete Account" actions.
 * ================================
 * A full, irreversible tenant wipe so a test/abandoned account can sign up
 * again with the system knowing nothing about them. There is NO self-service
 * delete in the app; this is the admin-only path.
 *
 * Why this is company-level, not user-level:
 *   "An account" in QuoteCore+ = a company (tenant) + its user(s) + all data.
 *   Deleting the `companies` row CASCADEs to `public.users` and every
 *   company-scoped child table (quotes, invoices, components, messages, ...).
 *   But two things do NOT cascade and must be removed explicitly:
 *     1. `auth.users` rows  -> NO FK from public.users to auth.users, so the
 *        login survives a company delete and keeps the email "taken".
 *     2. Storage objects    -> keyed by `${companyId}/...` path, not FK'd.
 *
 * Order matters:
 *   storage  -> auth users -> company row
 *   (storage + auth first while we can still resolve paths/ids; the company
 *    cascade is last and also clears the RESTRICT-guarded scheduled_messages
 *    + public.users in one shot.)
 *
 * Gating: requireAdmin() (users.is_admin). Service-role client for everything.
 */

import { requireAdmin } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

const STORAGE_BUCKETS = ['company-logos', 'QUOTE-DOCUMENTS'] as const;

export interface AccountRow {
  companyId: string;
  companyName: string;
  planCode: string | null;
  subscriptionStatus: string | null;
  users: { id: string; email: string; fullName: string | null; isAdmin: boolean }[];
}

export type ListAccountsResult =
  | { ok: true; accounts: AccountRow[] }
  | { ok: false; error: string };

/**
 * List all company accounts with user + plan info. Used to populate the
 * admin user list. Returns up to 500 rows; client filters by search term.
 */
export async function listAccounts(): Promise<ListAccountsResult> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: companies, error: coErr } = await admin
    .from('companies')
    .select('id, name, plan_code, subscription_status')
    .order('name', { ascending: true })
    .limit(500);
  if (coErr) return { ok: false, error: coErr.message };

  const companyIds = (companies ?? []).map((c) => c.id);
  if (companyIds.length === 0) return { ok: true, accounts: [] };

  const { data: allUsers } = await admin
    .from('users')
    .select('id, email, full_name, is_admin, company_id')
    .in('company_id', companyIds);

  const accounts: AccountRow[] = (companies ?? []).map((co) => ({
    companyId: co.id,
    companyName: co.name,
    planCode: co.plan_code ?? null,
    subscriptionStatus: co.subscription_status ?? null,
    users: (allUsers ?? [])
      .filter((u) => u.company_id === co.id)
      .map((u) => ({ id: u.id, email: u.email, fullName: u.full_name ?? null, isAdmin: !!u.is_admin })),
  }));

  return { ok: true, accounts };
}

export interface AccountMatch {
  companyId: string;
  companyName: string;
  companySlug: string | null;
  planCode: string | null;
  subscriptionStatus: string | null;
  stripeCustomerId: string | null;
  users: { id: string; email: string; isAdmin: boolean }[];
  counts: {
    quotes: number;
    invoices: number;
    materialOrders: number;
    components: number;
    outboundMessages: number;
  };
}

export type LookupResult =
  | { ok: true; matches: AccountMatch[] }
  | { ok: false; error: string };

export type DeleteResult =
  | { ok: true; summary: string }
  | { ok: false; error: string };

/**
 * Find every company that has a user matching the given email (case-
 * insensitive). Returns enough context for the admin to confirm the right
 * tenant before deleting. Read-only.
 */
/**
 * Bulk wipe: delete multiple company tenants in one action.
 * Confirmation guard: `confirmWord` must equal "DELETE" (case-sensitive).
 * Self-protection: any company containing the calling admin is silently skipped.
 */
export async function deleteAccounts(
  companyIds: string[],
  confirmWord: string,
): Promise<DeleteResult> {
  const adminProfile = await requireAdmin();

  if (!companyIds || companyIds.length === 0)
    return { ok: false, error: 'No accounts selected.' };
  if (confirmWord !== 'DELETE')
    return { ok: false, error: 'Type DELETE (all caps) to confirm.' };

  const admin = createAdminClient();
  const results: string[] = [];
  const failures: string[] = [];

  for (const companyId of companyIds) {
    // Re-use the single-delete logic by calling the same steps.
    const { data: company } = await admin
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .maybeSingle();
    if (!company) { failures.push(`${companyId}: not found`); continue; }

    const { data: users } = await admin
      .from('users')
      .select('id, email')
      .eq('company_id', companyId);
    const userList = users ?? [];

    // Self-protection.
    if (userList.some((u) => u.id === adminProfile.id)) {
      failures.push(`${company.name}: skipped (your own account)`);
      continue;
    }

    let storageRemoved = 0;
    for (const bucket of STORAGE_BUCKETS) {
      try {
        const paths = await listCompanyStoragePaths(admin, bucket, companyId);
        if (paths.length > 0) {
          for (let i = 0; i < paths.length; i += 100) {
            await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
            storageRemoved += paths.slice(i, i + 100).length;
          }
        }
      } catch { /* best-effort */ }
    }

    for (const u of userList) {
      await admin.auth.admin.deleteUser(u.id).catch(() => {});
    }

    const { error: delErr } = await admin.from('companies').delete().eq('id', companyId);
    if (delErr) {
      failures.push(`${company.name}: company row failed — ${delErr.message}`);
      continue;
    }

    console.log(`[admin/delete-accounts] WIPED ${companyId} (${company.name}) users=${userList.length} storage=${storageRemoved} by admin=${adminProfile.id}`);
    results.push(company.name);
  }

  if (results.length === 0 && failures.length > 0)
    return { ok: false, error: `All deletions failed: ${failures.join('; ')}` };

  const summary = `Deleted ${results.length} account(s): ${results.join(', ')}.` +
    (failures.length ? ` ${failures.length} skipped/failed: ${failures.join('; ')}` : '');
  return { ok: true, summary };
}

export async function lookupAccount(rawEmail: string): Promise<LookupResult> {
  await requireAdmin();

  const email = (rawEmail ?? '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'Enter a valid email address.' };
  }

  const admin = createAdminClient();

  // Find matching user rows first (a user lives on exactly one company).
  const { data: userRows, error: userErr } = await admin
    .from('users')
    .select('id, email, is_admin, company_id')
    .ilike('email', email);
  if (userErr) {
    return { ok: false, error: `User lookup failed: ${userErr.message}` };
  }
  if (!userRows || userRows.length === 0) {
    return { ok: false, error: `No account found for "${email}".` };
  }

  const companyIds = Array.from(new Set(userRows.map((u) => u.company_id).filter(Boolean))) as string[];
  if (companyIds.length === 0) {
    return { ok: false, error: 'Matching user has no company; nothing to delete here.' };
  }

  const { data: companies, error: coErr } = await admin
    .from('companies')
    .select('id, name, slug, plan_code, subscription_status, stripe_customer_id')
    .in('id', companyIds);
  if (coErr) {
    return { ok: false, error: `Company lookup failed: ${coErr.message}` };
  }

  // All users on each matched company (a company can have >1 user).
  const { data: allCompanyUsers } = await admin
    .from('users')
    .select('id, email, is_admin, company_id')
    .in('company_id', companyIds);

  const matches: AccountMatch[] = [];
  for (const co of companies ?? []) {
    const usersForCo = (allCompanyUsers ?? []).filter((u) => u.company_id === co.id);

    const [qR, iR, oR, cR, mR] = await Promise.all([
      admin.from('quotes').select('id', { count: 'exact', head: true }).eq('company_id', co.id),
      admin.from('invoices').select('id', { count: 'exact', head: true }).eq('company_id', co.id),
      admin.from('material_orders').select('id', { count: 'exact', head: true }).eq('company_id', co.id),
      admin.from('component_library').select('id', { count: 'exact', head: true }).eq('company_id', co.id),
      admin.from('outbound_messages').select('id', { count: 'exact', head: true }).eq('company_id', co.id),
    ]);
    const quotes = qR.count ?? 0;
    const invoices = iR.count ?? 0;
    const materialOrders = oR.count ?? 0;
    const components = cR.count ?? 0;
    const outboundMessages = mR.count ?? 0;

    matches.push({
      companyId: co.id,
      companyName: co.name,
      companySlug: co.slug ?? null,
      planCode: co.plan_code ?? null,
      subscriptionStatus: co.subscription_status ?? null,
      stripeCustomerId: co.stripe_customer_id ?? null,
      users: usersForCo.map((u) => ({ id: u.id, email: u.email, isAdmin: !!u.is_admin })),
      counts: { quotes, invoices, materialOrders, components, outboundMessages },
    });
  }

  return { ok: true, matches };
}

/**
 * Recursively list every storage object under a `${companyId}/` prefix and
 * return the full paths, so we can remove them. Supabase list is per-folder,
 * so we walk one level deep (company paths are `${companyId}/<file>` and
 * `${companyId}/<sub>/<file>`).
 */
async function listCompanyStoragePaths(
  admin: ReturnType<typeof createAdminClient>,
  bucket: string,
  companyId: string,
): Promise<string[]> {
  const paths: string[] = [];
  const { data: top } = await admin.storage.from(bucket).list(companyId, { limit: 1000 });
  for (const entry of top ?? []) {
    // A "folder" has no id/metadata; recurse one level. A file has an id.
    if (entry.id === null) {
      const sub = `${companyId}/${entry.name}`;
      const { data: subFiles } = await admin.storage.from(bucket).list(sub, { limit: 1000 });
      for (const f of subFiles ?? []) {
        if (f.id !== null) paths.push(`${sub}/${f.name}`);
      }
    } else {
      paths.push(`${companyId}/${entry.name}`);
    }
  }
  return paths;
}

/**
 * FULL irreversible wipe of a company tenant.
 *
 * Safety:
 *   - requireAdmin().
 *   - `confirmEmail` must exactly match one of the company's user emails
 *     (case-insensitive) — the typed-confirmation guard.
 *   - Refuses to delete the calling admin's own company (self-protection).
 */
export async function deleteAccount(
  companyId: string,
  confirmEmail: string,
): Promise<DeleteResult> {
  const adminProfile = await requireAdmin();

  if (!companyId) return { ok: false, error: 'Missing company id.' };
  const typed = (confirmEmail ?? '').trim().toLowerCase();
  if (!typed) return { ok: false, error: 'Type the account email to confirm.' };

  const admin = createAdminClient();

  // Re-load the company + its users server-side (never trust the client).
  const { data: company, error: coErr } = await admin
    .from('companies')
    .select('id, name')
    .eq('id', companyId)
    .maybeSingle();
  if (coErr || !company) {
    return { ok: false, error: 'Company not found (already deleted?).' };
  }

  const { data: users } = await admin
    .from('users')
    .select('id, email, company_id')
    .eq('company_id', companyId);
  const userList = users ?? [];

  // Self-protection: don't let an admin nuke their own tenant.
  if (userList.some((u) => u.id === adminProfile.id)) {
    return { ok: false, error: 'You cannot delete your own account from here.' };
  }

  // Typed-confirmation must match one of this company's user emails.
  const emails = userList.map((u) => (u.email ?? '').toLowerCase());
  if (!emails.includes(typed)) {
    return {
      ok: false,
      error: 'Confirmation email does not match a user on this account.',
    };
  }

  const errors: string[] = [];

  // 1. STORAGE — remove all objects under `${companyId}/` in each bucket.
  let storageRemoved = 0;
  for (const bucket of STORAGE_BUCKETS) {
    try {
      const paths = await listCompanyStoragePaths(admin, bucket, companyId);
      if (paths.length > 0) {
        // remove() handles up to a large batch; chunk to be safe.
        for (let i = 0; i < paths.length; i += 100) {
          const chunk = paths.slice(i, i + 100);
          const { error } = await admin.storage.from(bucket).remove(chunk);
          if (error) errors.push(`storage(${bucket}): ${error.message}`);
          else storageRemoved += chunk.length;
        }
      }
    } catch (e) {
      errors.push(`storage(${bucket}): ${e instanceof Error ? e.message : 'list failed'}`);
    }
  }

  // 2. AUTH USERS — delete each auth.users row (no FK from public.users, so
  //    the company cascade below would otherwise leave the login alive).
  let authDeleted = 0;
  for (const u of userList) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    // "User not found" is fine (already gone) — only flag real failures.
    if (error && !/not found/i.test(error.message)) {
      errors.push(`auth(${u.email}): ${error.message}`);
    } else {
      authDeleted += 1;
    }
  }

  // 3. COMPANY ROW — cascades public.users + all company-scoped child tables
  //    (incl. the RESTRICT-guarded scheduled_messages, which die in the same
  //    cascade as their creating users).
  const { error: delErr } = await admin.from('companies').delete().eq('id', companyId);
  if (delErr) {
    // Company delete failed AFTER auth/storage removal — surface loudly.
    errors.push(`company: ${delErr.message}`);
    console.error(
      `[admin/delete-account] PARTIAL: company ${companyId} (${company.name}) row delete FAILED after auth/storage removal. admin=${adminProfile.id}. err=${delErr.message}`,
    );
    return {
      ok: false,
      error: `Partial deletion. Storage + auth were removed but the company row failed: ${delErr.message}. Re-run or finish manually.`,
    };
  }

  console.log(
    `[admin/delete-account] WIPED company=${companyId} (${company.name}) ` +
      `users=${authDeleted} storageObjects=${storageRemoved} ` +
      `by admin=${adminProfile.id} (${adminProfile.email})` +
      (errors.length ? ` | non-fatal errors: ${errors.join('; ')}` : ''),
  );

  const summary =
    `Deleted "${company.name}" — ${authDeleted} login(s), ${storageRemoved} file(s), ` +
    `and all company data.` +
    (errors.length ? ` Note: ${errors.length} non-fatal cleanup warning(s) logged.` : '');

  return { ok: true, summary };
}
