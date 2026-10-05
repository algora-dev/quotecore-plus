/** C65: deterministic parent destinations for workspace navigation.
 * Never use browser history as the only way out of a direct/bookmarked link.
 * No routing, refresh, persistence, or stateful-workspace exit behaviour lives here.
 */
export interface WorkspaceReturn { href: string; label: string }

export function workspaceReturn(pathname: string, slug: string): WorkspaceReturn | null {
  const base = `/${slug}`;
  if (pathname !== base && !pathname.startsWith(`${base}/`)) return null;
  const [section, record, detail] = pathname.slice(base.length).split('/').filter(Boolean);
  if (!section) return null;
  const home = { href: base, label: 'Home' };
  const resources = { href: `${base}/resources`, label: 'Resources' };
  const documents = { href: `${base}/resources/document-templates`, label: 'Document templates' };
  if (section === 'resources') {
    if (!record) return home;
    if (['document-templates', 'message-templates', 'catalogs', 'attachments'].includes(record)) return resources;
    return documents;
  }
  if (['customer-quote-templates', 'templates'].includes(section)) return documents;
  if (section === 'components') return resources;
  if (section === 'supplier-directory') return record ? { href: `${base}/supplier-directory`, label: 'Supplier directory' } : resources;
  if (section === 'drawings') return record ? { href: `${base}/drawings`, label: 'Drawings & images' } : resources;
  if (section === 'catalogs') return resources;
  if (section === 'account') return record ? { href: `${base}/account`, label: 'Account' } : home;
  if (section === 'material-orders' || section === 'orders') {
    if (!record) return home;
    if (record === 'order-from-quote' && detail) return { href: `${base}/material-orders/order-from-quote`, label: 'Choose a quote' };
    return { href: `${base}/material-orders`, label: 'Orders' };
  }
  if (section === 'invoices') return record ? { href: `${base}/invoices`, label: 'Invoices' } : home;
  if (section === 'quotes') return record ? { href: `${base}/quotes`, label: 'Quotes' } : home;
  return home;
}

/** These pages already own a back/close handler or origin-aware breadcrumb.
 * In particular, never bypass a Takeoff, drawing, Builder or Studio dirty guard.
 */
export function ownsWorkspaceExit(pathname: string, slug: string): boolean {
  const [section, record, detail] = pathname.slice(`/${slug}`.length).split('/').filter(Boolean);
  if (section === 'assistant' || (section === 'account' && record === 'smart-assistant')) return true;
  if (section === 'quotes' && record && !['new', 'create'].includes(record)) return true;
  if (section === 'drawings' && record) return true;
  if (section === 'material-orders' && (record === 'create' || detail === 'preview')) return true;
  if (section === 'invoices' && record && !['new-from-quote', 'invoice-from-quote'].includes(record)) return true;
  return false;
}
