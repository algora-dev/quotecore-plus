'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/database.types';

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

/**
 * Email/password signup — TWO-STAGE FLOW (Gerald M-01).
 *
 * Stage 1 (here): create ONLY the Supabase auth user (email_confirm: false).
 *   Company name + full name are stored in user_metadata so they survive
 *   until the confirmation callback. NO company, NO profile, NO workspace
 *   state is created until the email is confirmed.
 *
 * Stage 2 (in /auth/callback): after the user clicks the confirmation link,
 *   the callback creates the company + profile from the stored metadata,
 *   sends the welcome email, and redirects to onboarding.
 *
 * This prevents abandoned/unverified workspaces and matches Shaun's
 * requirement: "sign up should not allow the user to log in at all until
 * they confirm their email."
 */
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

  // Create auth user ONLY. No company, no profile. Company name and full
  // name are stored in user_metadata so the confirmation callback can
  // create the workspace state after the email is verified.
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: {
      full_name: fullName,
      company_name: companyName,
      role: 'owner',
    },
  });

  if (authError || !authData.user) {
    const msg = authError?.message ?? 'Failed to create auth user.';
    if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already been registered')) {
      return { ok: false, error: 'An account with this email already exists. Try logging in instead.' };
    }
    return { ok: false, error: msg };
  }

  // Supabase sends a confirmation email with a secure link to /auth/callback.
  // The user must click it before they can sign in. Company/profile are
  // created in the callback after confirmation.
  redirect('/login?signup=pending');
}
