'use server';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient, requireUser } from '@/app/lib/supabase/server';
export async function setRequiredPassword(formData: FormData) { const password = String(formData.get('password') ?? ''); const confirm = String(formData.get('confirmPassword') ?? ''); if (password.length < 8) return { error: 'Password must be at least 8 characters.' }; if (password !== confirm) return { error: 'Passwords do not match.' }; await requireUser(); const supabase = await createSupabaseServerClient(); const { error } = await supabase.auth.updateUser({ password, data: { must_change_password: false } }); if (error) return { error: error.message }; redirect('/'); }
