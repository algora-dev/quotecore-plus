
'use server'

import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

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

  return createClient(url, serviceRole, {
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

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: 'owner',
    },
  });

  if (authError || !authData.user) {
    return { ok: false, error: authError?.message ?? 'Failed to create auth user.' };
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

  redirect('/login?signup=success');
}



