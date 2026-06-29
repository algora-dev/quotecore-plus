
'use server'

import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/database.types';
import { ensureCompanyHasCollection } from '@/app/lib/data/ensure-company-has-collection';

type SignupInput = {
  companyName: string;
  fullName: string;
  email: string;
  password: string;
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error('Missing Supabase admin environment variables.');
  }

  return createClient<Database>(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function signupWithCompany(input: SignupInput) {
  
  
  const companyName = input.companyName.trim();
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!companyName || !fullName || !email || !password) {
    return { ok: false, error: 'All fields are required.' };
  }

  if (password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }

  const supabaseAdmin = getAdminClient();

  // Pre-check: if the email is already registered, fail fast with a friendly
  // message. createUser will also catch this, but checking first avoids
  // any partial state and gives a cleaner error.
  try {
    const { data: existingUsers } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .limit(1)
      .maybeSingle();
    if (existingUsers) {
      return { ok: false, error: 'An account with this email already exists. Try logging in instead.' };
    }
  } catch {
    // If the pre-check fails (e.g. RLS issue), fall through to createUser
    // which will catch the duplicate anyway.
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: {
      full_name: fullName,
      role: 'owner',
    },
  });

  if (authError || !authData.user) {
    const msg = authError?.message ?? 'Failed to create auth user.';
    // Friendlier message for the most common case: email already exists.
    if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already been registered')) {
      return { ok: false, error: 'An account with this email already exists. Try logging in instead.' };
    }
    return { ok: false, error: msg };
  }

  const userId = authData.user.id;

  const slugBase = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50);

  const companySlug = `${slugBase || 'company'}-${userId.slice(0, 8)}`;

  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .insert({
      name: companyName,
      slug: companySlug,
      default_currency: 'NZD',
      default_tax_rate: 15.0,
    })
    .select('id')
    .single();

  if (companyError || !company) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return { ok: false, error: companyError?.message ?? 'Failed to create company.' };
  }

  const { error: profileError } = await supabaseAdmin
    .from('users')
    .insert({
      id: userId,
      company_id: company.id,
      email,
      full_name: fullName,
      role: 'owner',
    });

  if (profileError) {
    await supabaseAdmin.from('companies').delete().eq('id', company.id);
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return { ok: false, error: profileError.message };
  }

  // Phase 3: bootstrap the "My Components" collection so this company has
  // a default container before we seed components into it. Service-role RPC
  // under a per-company advisory lock + partial unique index, idempotent.
  // Non-fatal: signup must still succeed if this fails. If the bootstrap
  // misses, the components seed still works (collection_id falls back to
  // NULL) and the collection can be created later via Phase 5 fallback.
  let bootstrapCollectionId: string | null = null;
  try {
    bootstrapCollectionId = await ensureCompanyHasCollection(
      company.id,
      supabaseAdmin,
    );
  } catch (err) {
    console.error('[signupWithCompany] ensureCompanyHasCollection failed:', err);
  }

  // Seed the canonical starter components into the new company. Non-fatal:
  // signup must still succeed if this fails - the user can always create
  // their own components manually.
  // NOTE: component seeding is intentionally NOT done here. The user picks
  // their trade in the onboarding step that runs AFTER signup, so seeding here
  // would always seed the default trade (roofing) regardless of their choice.
  // completeOnboarding() seeds the correct trade's set once the trade is known.
  // (bootstrapCollectionId is still created here so the collection exists.)
  void bootstrapCollectionId;

  // Email confirmation is required — Supabase sends a confirmation email
  // with a secure link to /auth/callback. The user must click it before
  // they can sign in. The welcome email is sent AFTER confirmation (in
  // the auth callback) so we know the email address is valid.
  redirect('/login?signup=pending');
}



