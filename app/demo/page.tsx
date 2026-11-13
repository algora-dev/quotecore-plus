import Link from 'next/link';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/app/lib/supabase/database.types';
import { authCookieOptions } from '@/app/lib/supabase/cookie-config';
import { getDemoControl } from '@/app/lib/demo/control';
import { appUrl } from '@/lib/app-url';
import { DemoLauncher } from './DemoLauncher';
import { DemoWelcomeModal } from './DemoWelcomeModal';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { isFreeWorkspaceCompany } from '@/app/lib/billing/free-workspace';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Guided Walkthrough | QuoteCore+',
  description:
    'Launch the optional QuoteCore+ Guided Walkthrough from your Free Workspace and learn the core roofing workflow using isolated fictional data.',
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The walkthrough still uses its isolated anonymous demo identity internally,
 * but entry is now gated by a real QuoteCore+ account. This preserves the
 * sandbox/security model while matching the public promise: create a Free
 * Workspace first, then use the optional Guided Walkthrough from there.
 */
async function requireRealWorkspaceAccount() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const host = headerStore.get('host') || '';
  const client = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: authCookieOptions(host),
      cookies: {
        getAll: () => cookieStore.getAll(),
        // Server Components cannot reliably mutate auth cookies. Middleware
        // owns refresh persistence; this read client only establishes entry.
        setAll: () => {},
      },
    },
  );

  const { data: { user }, error } = await client.auth.getUser();
  const appBase = appUrl(host);
  if (error || !user || user.is_anonymous) {
    redirect(`${appBase}/signup?source=guided-walkthrough`);
  }

  const { data: profile } = await client
    .from('users')
    .select('company_id, email')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.company_id) {
    redirect(`${appBase}/onboarding`);
  }

  return { host, appBase, userId: user.id, userEmail: profile.email ?? '', companyId: profile.company_id };
}

export default async function DemoEntryPage() {
  const { appBase, userId, userEmail, companyId } = await requireRealWorkspaceAccount();
  const control = await getDemoControl();

  if (!control.demoEnabled) {
    return (
      <main className="flex min-h-[78vh] items-center justify-center bg-[var(--qc-bg-app)] px-4 py-10">
        <div data-qc-ui="v2" className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Guided Walkthrough temporarily unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">
            Your Free Workspace is unaffected. You can keep using your own jobs and come back to the walkthrough later.
          </p>
          <Link
            href={appBase || '/'}
            className="qc-flow-control qc-button mt-4 inline-flex min-h-11 items-center rounded-xl bg-[linear-gradient(135deg,#FF641F_0%,#FF8A3D_55%,#FFB36B_100%)] px-6 py-3 font-semibold text-[#191B20]"
          >
            Back to my workspace
          </Link>
        </div>
      </main>
    );
  }

  // Demo-first welcome flow (owner 2026-11-13): free accounts that have
  // never started a demo and never saw the old free-entry modal get the
  // welcome (founder video) + tips sequence over the launcher, once each.
  // Best-effort: the modal is cosmetic - never let it block the demo.
  // (JSX is constructed outside the try/catch per react-hooks/error-boundaries.)
  let welcomeStep: 'welcome' | 'tips' | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const looseAdmin = createAdminClient() as unknown as { from(table: string): any };
    const [{ data: stamps }, freeWorkspace, { count: demoCount }] = await Promise.all([
      looseAdmin.from('companies')
        .select('welcome_modal_seen_at, demo_tips_seen_at, free_entry_modal_seen_at')
        .eq('id', companyId)
        .maybeSingle(),
      isFreeWorkspaceCompany(companyId),
      looseAdmin.from('demo_sessions').select('id', { count: 'exact', head: true })
        .or(`owner_user_id.eq.${userId},owner_email.eq.${userEmail}`),
    ]);
    const stampRow = stamps as
      | { welcome_modal_seen_at?: string; demo_tips_seen_at?: string; free_entry_modal_seen_at?: string }
      | null;
    if (freeWorkspace && Number(demoCount ?? 0) === 0 && !stampRow?.free_entry_modal_seen_at) {
      welcomeStep = !stampRow?.welcome_modal_seen_at
        ? 'welcome'
        : !stampRow?.demo_tips_seen_at ? 'tips' : null;
    }
  } catch { /* welcome flow only */ }

  return (
    <main className="flex min-h-[78vh] items-center justify-center bg-[var(--qc-bg-app)] px-4 py-10">
      {welcomeStep ? <DemoWelcomeModal initialStep={welcomeStep} /> : null}
      <DemoLauncher appHomeHref={appBase || '/'} />
    </main>
  );
}
