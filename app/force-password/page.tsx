import { redirect } from 'next/navigation';
import { requireUser } from '@/app/lib/supabase/server';
import { ForcePasswordForm } from './ForcePasswordForm';
export const dynamic = 'force-dynamic';
export default async function ForcePasswordPage() { const user = await requireUser(); if (user.user_metadata?.must_change_password !== true) redirect('/'); return <ForcePasswordForm />; }
