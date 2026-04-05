import { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { LogoutButton } from '@/app/components/auth/LogoutButton';
import { LanguageSwitcher } from '@/app/components/auth/LanguageSwitcher';
import { WorkspaceNav } from '@/app/components/workspace/WorkspaceNav';
import { loadCompanyContext } from '@/app/lib/data/company-context';

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const { company } = await loadCompanyContext();
  const slug = company.slug;

  if (slug !== workspaceSlug) {
    redirect(`/${slug}`);
  }

  const workspaceLabel = company.name ? company.name.slice(0, 10) : 'Workspace';
  const languageLabel = (company.default_language ?? 'en').toUpperCase();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href={`/${slug}`} prefetch={false} className="flex items-center">
              <img src="/logo.png" alt="QuoteCore" className="h-8" />
            </Link>
            <div className="flex items-center gap-3">
              <LanguageSwitcher currentLanguage={languageLabel} />
              <Link
                href={`/${slug}/settings`}
                prefetch={false}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <span aria-hidden="true">👤</span>
                {workspaceLabel}
              </Link>
              <LogoutButton />
            </div>
          </div>

          <WorkspaceNav workspaceSlug={slug} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
