import { BackButton } from '@/app/components/BackButton';
import { AccountSidebar } from './AccountSidebar';

/**
 * Shared shell for /account/* pages.
 *
 * Layout contract per Shaun's spec:
 *   - Left sidebar is sticky and does NOT scroll independently of the
 *     viewport. Only the main content column scrolls.
 *   - Mobile (<768px): sidebar collapses to a horizontal scroll strip above
 *     the content. Implemented via Tailwind responsive utilities in the
 *     AccountSidebar component itself; this layout just stacks vs splits.
 *
 * We rely on the parent route (workspace) to provide the global page chrome
 * (top nav, etc.). The header here is local to /account.
 */
export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <BackButton />

        <header>
          <h1 className="text-3xl font-semibold text-slate-900">Account</h1>
          <p className="text-slate-500 mt-1">Manage your account, company, security, and preferences.</p>
        </header>

        <div className="flex flex-col md:flex-row md:items-start gap-6">
          <aside className="w-full md:w-56 lg:w-60 md:flex-shrink-0">
            <AccountSidebar slug={workspaceSlug} />
          </aside>
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
