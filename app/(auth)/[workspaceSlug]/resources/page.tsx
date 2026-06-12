import Link from 'next/link';
import { redirect } from 'next/navigation';

/**
 * Resource Library hub — a cards landing page (styled like the dashboard).
 * Each card links to its own sub-route so URLs are clean and the AI assistant
 * can tell exactly which section the user is on.
 *
 * Components & Drawings/Images are "redirect" cards to their existing pages.
 * The four template sections + Catalogs + Attachments each have a sub-route.
 *
 * Back-compat: old `/resources?tab=X` links redirect to the matching sub-route.
 */

const TAB_TO_SUBROUTE: Record<string, string> = {
  quote: 'quote-templates',
  customer: 'quote-header-templates',
  email: 'message-templates',
  order: 'order-header-templates',
  catalogs: 'catalogs',
  attachments: 'attachments',
};

export default async function ResourcesHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { workspaceSlug } = await params;
  const { tab } = await searchParams;

  // Back-compat: legacy ?tab= links land on the matching sub-route.
  if (tab && TAB_TO_SUBROUTE[tab]) {
    redirect(`/${workspaceSlug}/resources/${TAB_TO_SUBROUTE[tab]}`);
  }

  const base = `/${workspaceSlug}`;

  const cards = [
    {
      title: 'Components',
      description: 'Add and manage reusable components for quoting',
      href: `${base}/components`,
      copilot: 'resources-card-components',
      icon: (
        <svg className="w-6 h-6 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      title: 'Drawings & Images',
      description: 'Draw or upload drawings and images for components and orders',
      href: `${base}/flashings`,
      copilot: 'resources-card-drawings',
      icon: (
        <svg className="w-6 h-6 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
    },
    {
      title: 'Catalogs',
      description: 'Upload supplier price lists and search them when quoting',
      href: `${base}/resources/catalogs`,
      copilot: 'resources-card-catalogs',
      icon: (
        <svg className="w-6 h-6 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      title: 'Attachments',
      description: 'Upload files once and reuse them across quotes and orders',
      href: `${base}/resources/attachments`,
      copilot: 'resources-card-attachments',
      icon: (
        <svg className="w-6 h-6 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
      ),
    },
    {
      title: 'Quote Templates',
      description: 'Reusable quote layouts to speed up quoting',
      href: `${base}/resources/quote-templates`,
      copilot: 'resources-card-quote-templates',
      icon: (
        <svg className="w-6 h-6 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      title: 'Quote Header Templates',
      description: 'Customer-facing quote header layouts',
      href: `${base}/resources/quote-header-templates`,
      copilot: 'resources-card-quote-header-templates',
      icon: (
        <svg className="w-6 h-6 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      ),
    },
    {
      title: 'Message Templates',
      description: 'Pre-written quote emails with auto-filling placeholders',
      href: `${base}/resources/message-templates`,
      copilot: 'resources-card-message-templates',
      icon: (
        <svg className="w-6 h-6 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      title: 'Order Header Templates',
      description: 'Reusable header/footer layouts for supplier orders',
      href: `${base}/resources/order-header-templates`,
      copilot: 'resources-card-order-header-templates',
      icon: (
        <svg className="w-6 h-6 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      title: 'Invoice Templates',
      description: 'Header, payment details, and footer templates for invoices',
      href: `${base}/resources/invoice-templates`,
      copilot: 'resources-card-invoice-templates',
      icon: (
        <svg className="w-6 h-6 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
    },
  ];

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Resource Library</h1>
          <p className="text-sm text-slate-500 mt-1">Everything you use to build quotes and orders, in one place.</p>
        </div>
        <Link
          href={`${base}/tutorials`}
          data-copilot="resources-tutorials-link"
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(0,0,0,0.25)]"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          Tutorials
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            data-copilot={card.copilot}
            className="block p-5 bg-white border border-slate-200 rounded-xl hover:border-orange-200 hover:bg-orange-50/30 hover:shadow-[0_0_12px_rgba(255,107,53,0.08)] transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-orange-50 group-hover:bg-orange-100 transition-colors flex-shrink-0">
                {card.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900">{card.title}</h3>
                <p className="text-sm text-slate-500 mt-0.5">{card.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
