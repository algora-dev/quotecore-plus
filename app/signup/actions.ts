'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';

type SignupInput = {
  companyName: string;
  fullName: string;
  email: string;
  password: string;
};

/**
 * Email/password signup — TWO-STAGE FLOW (Gerald M-01).
 *
 * Stage 1 (here): create the Supabase auth user via `signUp()`, which
 *   automatically sends the confirmation email instantly. Company name
 *   and full name are stored in user_metadata so they survive until the
 *   confirmation callback. NO company, NO profile, NO workspace state
 *   is created until the email is confirmed.
 *
 * Stage 2 (in /auth/callback): after the user clicks the confirmation link,
 *   the callback creates the company + profile from the stored metadata
 *   and redirects to onboarding.
 *
 * IMPORTANT: We use `supabase.auth.signUp()` (not admin.createUser + resend)
 * because signUp sends the confirmation email automatically and instantly
 * as part of the signup. The previous admin.createUser + resend approach
 * was unreliable — the resend endpoint could delay or fail silently,
 * leaving users waiting 5-15 minutes for a confirmation email.
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

  const supabase = await createSupabaseServerClient();

  // Use signUp() — this automatically sends the confirmation email
  // instantly. No need for a separate resend call.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        company_name: companyName,
        role: 'owner',
      },
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('user already registered')) {
      return { ok: false, error: 'An account with this email already exists. Try logging in instead.' };
    }
    return { ok: false, error: error.message };
  }

  // If the user somehow already has a session (e.g. email was already
  // confirmed), data.session will be non-null. In that case they're
  // already logged in — redirect to their workspace or onboarding.
  if (data.session) {
    redirect('/onboarding');
  }

  redirect('/login?signup=pending');
}
