import { requireAdmin } from '@/app/lib/supabase/server';
import { getUserProfile } from './actions';
import { UserProfile } from './UserProfile';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminUserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requireAdmin();
  const { userId } = await params;

  const res = await getUserProfile(userId);
  if (!res.ok) {
    if (res.error.includes('not found')) notFound();
    throw new Error(res.error);
  }

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{res.data.user.email}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {res.data.user.fullName ?? 'No name set'} · {res.data.company.name}
        </p>
      </div>

      <UserProfile data={res.data} />
    </section>
  );
}
