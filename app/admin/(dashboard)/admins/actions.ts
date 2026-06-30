'use server';

/**
 * Admin user management actions.
 * ==============================
 * Create new admin logins, change passwords, and revoke admin access.
 * All gated behind requireAdmin(). Uses service-role client for everything.
 *
 * Auth user creation/password-change goes through the Supabase Auth Admin API
 * (createAdminClient().auth.admin.*) which talks to GoTrue directly and
 * bypasses RLS. The `users.is_admin` flag is the app-level gate that
 * `/admin/login` checks.
 */

import { requireAdmin } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

// --------------- Types ---------------

export interface AdminUser {
  id: string;
  email: string;
  fullName: string | null;
  isAdmin: boolean;
  createdAt: string;
  companyName: string | null;
}

export type ListAdminsResult =
  | { ok: true; admins: AdminUser[] }
  | { ok: false; error: string };

export type CreateAdminResult =
  | { ok: true; summary: string }
  | { ok: false; error: string };

export type ChangePasswordResult =
  | { ok: true; summary: string }
  | { ok: false; error: string };

export type RevokeAdminResult =
  | { ok: true; summary: string }
  | { ok: false; error: string };

// --------------- Actions ---------------

/**
 * List all users with is_admin = true, plus any user who is NOT admin
 * but shares a company with an admin (so the admin list page can show
 * context). Actually we just list all is_admin=true users.
 */
export async function listAdmins(): Promise<ListAdminsResult> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('users')
    .select('id, email, full_name, is_admin, created_at, company_id')
    .eq('is_admin', true)
    .order('created_at', { ascending: true });

  if (error) return { ok: false, error: error.message };

  // Resolve company names for context.
  const companyIds = Array.from(new Set((data ?? []).map((u) => u.company_id).filter(Boolean))) as string[];
  let companyMap: Record<string, string> = {};
  if (companyIds.length > 0) {
    const { data: companies } = await admin
      .from('companies')
      .select('id, name')
      .in('id', companyIds);
    companyMap = Object.fromEntries((companies ?? []).map((c) => [c.id, c.name]));
  }

  const admins: AdminUser[] = (data ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    fullName: u.full_name ?? null,
    isAdmin: !!u.is_admin,
    createdAt: u.created_at,
    companyName: u.company_id ? (companyMap[u.company_id] ?? null) : null,
  }));

  return { ok: true, admins };
}

/**
 * Create a new admin user.
 *
 * Flow:
 *   1. Check if a `users` row already exists for this email (existing app user).
 *      - If yes: just flip is_admin = true. Set a password on the auth user.
 *      - If no: create a new auth user with the password, then create a
 *        `users` row. The new user needs a company — we create a dedicated
 *        "QuoteCore+ Admin" company for admin-only accounts so they don't
 *        pollute real tenant data.
 *   2. Set is_admin = true.
 *
 * Password requirements: min 8 chars. The caller validates.
 */
export async function createAdmin(
  email: string,
  password: string,
  fullName?: string,
): Promise<CreateAdminResult> {
  const adminProfile = await requireAdmin();

  const cleanEmail = (email ?? '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  if (!password || password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }

  const admin = createAdminClient();

  // Check if the email already exists as an app user.
  const { data: existingUser } = await admin
    .from('users')
    .select('id, email, company_id, is_admin')
    .ilike('email', cleanEmail)
    .maybeSingle();

  if (existingUser) {
    // Existing app user — set password on their auth account + flip is_admin.
    const { error: pwError } = await admin.auth.admin.updateUserById(existingUser.id, { password });
    if (pwError) {
      return { ok: false, error: `Could not set password: ${pwError.message}` };
    }

    const { error: flipError } = await admin
      .from('users')
      .update({ is_admin: true })
      .eq('id', existingUser.id);
    if (flipError) {
      return { ok: false, error: `Could not grant admin: ${flipError.message}` };
    }

    console.log(`[admin/create-admin] Promoted existing user ${existingUser.email} to admin by ${adminProfile.email}`);
    return { ok: true, summary: `Granted admin access to ${cleanEmail} and set their password.` };
  }

  // No existing user — create a fresh auth user + company + users row.
  // First check if the auth user already exists (e.g. deleted company but auth row remains).
  const { data: existingAuthList, error: listErr } = await admin.auth.admin.listUsers();
  const existingAuth = (listErr ? [] : (existingAuthList?.users ?? []) as { id: string; email?: string }[])
    .find((u) => (u.email ?? '').toLowerCase() === cleanEmail);

  let authUserId: string;

  if (existingAuth) {
    // Auth user exists but no `users` row — set password and reuse.
    authUserId = existingAuth.id;
    const { error: pwError } = await admin.auth.admin.updateUserById(authUserId, { password });
    if (pwError) {
      return { ok: false, error: `Could not set password: ${pwError.message}` };
    }
  } else {
    // Create a brand-new auth user.
    const { data: newAuth, error: createErr } = await admin.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true, // auto-confirm so they can log in immediately
    });
    if (createErr || !newAuth.user) {
      return { ok: false, error: `Could not create login: ${createErr?.message ?? 'Unknown error'}` };
    }
    authUserId = newAuth.user.id;
  }

  // Create a dedicated admin company (so the user row has a valid company_id FK).
  const { data: company, error: coErr } = await admin
    .from('companies')
    .insert({ name: 'QuoteCore+ Admin', plan_code: 'free', subscription_status: 'active' })
    .select('id')
    .single();
  if (coErr || !company) {
    // Roll back the auth user if company creation fails.
    await admin.auth.admin.deleteUser(authUserId).catch(() => {});
    return { ok: false, error: `Could not create admin workspace: ${coErr?.message ?? 'Unknown error'}` };
  }

  // Create the users row.
  const { error: userErr } = await admin
    .from('users')
    .insert({
      id: authUserId,
      company_id: company.id,
      email: cleanEmail,
      full_name: fullName || null,
      role: 'owner',
      is_admin: true,
    });
  if (userErr) {
    // Roll back company + auth user.
    await admin.from('companies').delete().eq('id', company.id).then(() => {}, () => {});
    await admin.auth.admin.deleteUser(authUserId).then(() => {}, () => {});
    return { ok: false, error: `Could not create user record: ${userErr.message}` };
  }

  console.log(`[admin/create-admin] Created new admin ${cleanEmail} (auth=${authUserId}) by ${adminProfile.email}`);
  return { ok: true, summary: `Created admin account for ${cleanEmail}.` };
}

/**
 * Change the password for an existing admin user.
 */
export async function changeAdminPassword(
  targetUserId: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  await requireAdmin();

  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }

  const admin = createAdminClient();

  // Verify the target is actually an admin (don't let us reset passwords
  // for arbitrary non-admin users through this endpoint).
  const { data: target } = await admin
    .from('users')
    .select('id, email, is_admin')
    .eq('id', targetUserId)
    .maybeSingle();
  if (!target) {
    return { ok: false, error: 'User not found.' };
  }
  if (!target.is_admin) {
    return { ok: false, error: 'This user is not an admin. Use the admin management page to manage admin passwords.' };
  }

  const { error } = await admin.auth.admin.updateUserById(targetUserId, { password: newPassword });
  if (error) {
    return { ok: false, error: `Could not update password: ${error.message}` };
  }

  console.log(`[admin/change-password] Password changed for ${target.email}`);
  return { ok: true, summary: `Password updated for ${target.email}.` };
}

/**
 * Revoke admin access for a user.
 *
 * - Sets is_admin = false (they can no longer access /admin).
 * - Optionally deletes the auth user entirely if `deleteUser` is true.
 * - Self-protection: cannot revoke your own admin access.
 */
export async function revokeAdmin(
  targetUserId: string,
  deleteUser: boolean,
): Promise<RevokeAdminResult> {
  const adminProfile = await requireAdmin();

  if (!targetUserId) {
    return { ok: false, error: 'Missing user id.' };
  }

  // Prevent self-revoke.
  if (targetUserId === adminProfile.id) {
    return { ok: false, error: 'You cannot revoke your own admin access.' };
  }

  const admin = createAdminClient();

  const { data: target, error: targetErr } = await admin
    .from('users')
    .select('id, email, is_admin, company_id')
    .eq('id', targetUserId)
    .maybeSingle();
  if (targetErr || !target) {
    return { ok: false, error: 'User not found.' };
  }

  if (!target.is_admin && !deleteUser) {
    return { ok: false, error: 'This user is already not an admin.' };
  }

  if (deleteUser) {
    // Delete the auth user, the users row, and the admin company (if it's
    // the dedicated admin workspace). This fully removes the login.
    const { error: userDelErr } = await admin.from('users').delete().eq('id', targetUserId);
    if (userDelErr) {
      return { ok: false, error: `Could not remove user record: ${userDelErr.message}` };
    }

    await admin.auth.admin.deleteUser(targetUserId).catch(() => {});

    // Clean up the admin company if it has no users left.
    if (target.company_id) {
      const { count } = await admin
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', target.company_id);
      if ((count ?? 0) === 0) {
        await admin.from('companies').delete().eq('id', target.company_id).then(() => {}, () => {});
      }
    }

    console.log(`[admin/revoke] Fully deleted admin ${target.email} by ${adminProfile.email}`);
    return { ok: true, summary: `Deleted admin account for ${target.email}.` };
  } else {
    // Just flip is_admin to false.
    const { error: flipErr } = await admin
      .from('users')
      .update({ is_admin: false })
      .eq('id', targetUserId);
    if (flipErr) {
      return { ok: false, error: `Could not revoke admin: ${flipErr.message}` };
    }

    console.log(`[admin/revoke] Revoked admin for ${target.email} by ${adminProfile.email}`);
    return { ok: true, summary: `Revoked admin access for ${target.email}.` };
  }
}
