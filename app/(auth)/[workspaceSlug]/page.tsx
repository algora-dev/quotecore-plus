import Link from 'next/link';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import { createSupabaseServerClient, getCurrentProfile } from '@/app/lib/supabase/server';

export default async function WorkspaceHome({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const { company } = await loadCompanyContext();
  const profile = await getCurrentProfile();
  const supabase = await createSupabaseServerClient();

  // Load unread alert count
  const { count: unreadAlerts } = await supabase
    .from('alerts')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', company.id)
    .eq('is_read', false);

  // Load user name
  const { data: user } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', profile.id)
    .single();

  const firstName = user?.full_name?.split(' ')[0] || 'there';

  const actions = [
    {
      title: 'Job Manager',
      description: 'Manage quotes and jobs start to finish',
      href: null,
      comingSoon: true,
      icon: (
        <svg className="w-6 h-6 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
    {
      title: 'Quotes',
      description: 'Create or manage quotes',
      href: `/${workspaceSlug}/quotes`,
      icon: (
        <svg className="w-6 h-6 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      title: 'Orders',
      description: 'Order materials for quoted or custom jobs',
      href: `/${workspaceSlug}/material-orders`,
      icon: (
        <svg className="w-6 h-6 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      title: 'Components',
      description: 'Add new components for quoting',
      href: `/${workspaceSlug}/components`,
      icon: (
        <svg className="w-6 h-6 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      title: 'Flashings',
      description: 'Add new drawings for orders',
      href: `/${workspaceSlug}/flashings`,
      icon: (
        <svg className="w-6 h-6 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
    },
    {
      title: 'Templates',
      description: 'Add or edit all templates',
      href: `/${workspaceSlug}/templates`,
      icon: (
        <svg className="w-6 h-6 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      ),
    },
  ];

  return (
    <section className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Welcome back, {firstName}</h1>
        <p className="text-sm text-slate-500 mt-1">What would you like to do?</p>
      </div>

      {/* Alert banner */}
      {(unreadAlerts ?? 0) > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-orange-200 bg-orange-50">
          <div className="flex-shrink-0">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100">
              <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-800">
              You have {unreadAlerts} unread notification{unreadAlerts !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-orange-600">Check the bell icon above to view them.</p>
          </div>
        </div>
      )}

      {/* Action cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {actions.map((action) => {
          const content = (
            <>
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-orange-50 group-hover:bg-orange-100 transition-colors flex-shrink-0">
                  {action.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{action.title}</h3>
                    {action.comingSoon && (
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 text-slate-500">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">{action.description}</p>
                </div>
              </div>
            </>
          );

          if (action.href) {
            return (
              <Link
                key={action.title}
                href={action.href}
                className="block p-5 bg-white border border-slate-200 rounded-xl hover:border-orange-200 hover:bg-orange-50/30 hover:shadow-[0_0_12px_rgba(255,107,53,0.08)] transition-all group"
              >
                {content}
              </Link>
            );
          }

          return (
            <div
              key={action.title}
              className="block p-5 bg-white border border-slate-200 rounded-xl opacity-75"
            >
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
