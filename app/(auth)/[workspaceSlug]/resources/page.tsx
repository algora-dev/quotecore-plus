import Link from 'next/link';
import { redirect } from 'next/navigation';
import { QcLibrary } from '@/app/components/ui/v2/QcLibrary';
import { QcJourneyHeader } from '@/app/components/ui/v2/QcJourney';
import { QcIcon, type QcIconName } from '@/app/components/ui/v2/QcIcon';

const TAB_TO_SUBROUTE: Record<string, string> = {
  quote: 'document-templates?type=quote&kind=quote-structure',
  customer: 'document-templates?type=quote&kind=quote-header', email: 'message-templates',
  order: 'document-templates?type=order', catalogs: 'catalogs', attachments: 'attachments',
};

export default async function ResourcesHubPage({ params, searchParams }: {
  params: Promise<{ workspaceSlug: string }>; searchParams: Promise<{ tab?: string }>;
}) {
  const { workspaceSlug } = await params;
  const { tab } = await searchParams;
  if (tab && TAB_TO_SUBROUTE[tab]) redirect(`/${workspaceSlug}/resources/${TAB_TO_SUBROUTE[tab]}`);
  const base = `/${workspaceSlug}`;
  const groups: { title: string; cards: { title: string; description: string; href: string; icon: QcIconName; copilot: string; external?: boolean }[] }[] = [
    { title: 'Templates', cards: [
      { title: 'Document templates', description: 'Quote headers and structures, order details, invoices and payment options. One named library.', href: `${base}/resources/document-templates`, icon: 'file', copilot: 'resources-card-document-templates' },
      { title: 'Message templates', description: 'Reusable named messages for sending quotes, invoices and orders.', href: `${base}/resources/message-templates`, icon: 'mail', copilot: 'resources-card-message-templates' },
    ] },
    { title: 'Pricing & suppliers', cards: [
      { title: 'Pricing Library', description: 'Manage Smart Components™, material costs, labour and estimating defaults.', href: `${base}/components`, icon: 'pricing', copilot: 'resources-card-components' },
      { title: 'Catalogues', description: 'Upload supplier price lists, map their columns and create components.', href: `${base}/resources/catalogs`, icon: 'library', copilot: 'resources-card-catalogs' },
      { title: 'Supplier directory', description: 'Find available supplier libraries and manage the ones you follow.', href: `${base}/supplier-directory`, icon: 'supplier', copilot: 'resources-card-suppliers' },
    ] },
    { title: 'Files & tools', cards: [
      { title: 'Drawings & images', description: 'Create or upload images for components and orders.', href: `${base}/drawings`, icon: 'edit', copilot: 'resources-card-drawings' },
      { title: 'Attachments', description: 'Store files once and reuse them when sending documents.', href: `${base}/resources/attachments`, icon: 'folder', copilot: 'resources-card-attachments' },
      { title: 'Calculators', description: 'Roofing, construction, concrete and landscaping calculators. Opens in a new tab.', href: '/free-tools', icon: 'measure', copilot: 'resources-card-calculators', external: true },
    ] },
  ];
  return <QcLibrary>
    <QcJourneyHeader title="Resources" description="Set up once. Reuse across your jobs, documents and pricing.">
      <Link href={`${base}/tutorials`} className="qc-button qc-flow-control" data-copilot="resources-tutorials-link"><QcIcon name="help" />Tutorials</Link>
    </QcJourneyHeader>
    {groups.map(group => <section key={group.title} className="qc-library-hub-section" aria-label={group.title}>
      <h2 className="qc-flow-section-title" style={{ marginBottom: 12 }}>{group.title}</h2>
      <div className="qc-library-hub-grid">{group.cards.map(card => <Link key={card.href} href={card.href}
        target={card.external ? '_blank' : undefined} rel={card.external ? 'noopener noreferrer' : undefined}
        data-copilot={card.copilot} className="qc-flow-card qc-flow-control qc-library-hub-card">
        <span className="qc-library-result-icon"><QcIcon name={card.icon} /></span>
        <span><strong>{card.title}</strong><p>{card.description}</p></span>
      </Link>)}</div>
    </section>)}
  </QcLibrary>;
}
