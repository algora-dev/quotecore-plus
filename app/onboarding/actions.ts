'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

export async function completeOnboarding(formData: FormData) {
  const companyName = String(formData.get('companyName') || '').trim();
  const fullName = String(formData.get('fullName') || '').trim();

  if (!companyName || !fullName) {
    throw new Error('Company name and your name are required.');
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('Not authenticated. Please sign in again.');
  }

  const supabaseAdmin = createAdminClient();

  // Check if user already has a profile with company
  const { data: existingProfile } = await supabaseAdmin
    .from('users')
    .select('id, company_id')
    .eq('id', user.id)
    .single();

  if (existingProfile?.company_id) {
    // Already has company — just redirect
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('slug')
      .eq('id', existingProfile.company_id)
      .single();

    redirect(`/${company?.slug || 'workspace'}`);
  }

  // Create company
  const slugBase = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50);

  const companySlug = `${slugBase || 'company'}-${user.id.slice(0, 8)}`;

  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .insert({
      name: companyName,
      slug: companySlug,
      default_currency: 'NZD',
      default_tax_rate: 15.0,
      onboarding_completed_at: new Date().toISOString(),
    })
    .select('id, slug')
    .single();

  if (companyError || !company) {
    throw new Error(companyError?.message || 'Failed to create company');
  }

  if (existingProfile) {
    // Update existing profile with company
    await supabaseAdmin
      .from('users')
      .update({ company_id: company.id, full_name: fullName })
      .eq('id', user.id);
  } else {
    // Create new profile
    await supabaseAdmin
      .from('users')
      .insert({
        id: user.id,
        company_id: company.id,
        email: user.email || '',
        full_name: fullName,
        role: 'owner',
      });
  }

  redirect(`/${company.slug}`);
}
