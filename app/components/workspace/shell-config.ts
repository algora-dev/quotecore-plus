import type { Feature } from '@/app/lib/billing/features';
import type { QcIconName } from '../ui/v2/QcIcon';

export type ShellMode = 'expanded' | 'rail' | 'hidden';
export interface ShellNavItem {
  key: string; label: string; href: string; icon: QcIconName;
  group: 'work' | 'library' | 'utility'; gatedBy?: Feature; copilot?: string;
}
/** Existing destinations only. No new Jobs route or duplicate quote data model. */
export function workspaceNavigation(slug: string, supplier: boolean, assistant: boolean): ShellNavItem[] {
  const b = `/${slug}`;
  return [
    { key: 'home', label: 'Home', href: b, icon: 'home', group: 'work' },
    { key: 'quotes', label: 'Quotes', href: `${b}/quotes`, icon: 'quote', group: 'work', copilot: 'nav-quotes' },
    { key: 'orders', label: 'Orders', href: `${b}/material-orders`, icon: 'orders', group: 'work', gatedBy: 'material_orders', copilot: 'nav-orders' },
    { key: 'invoices', label: 'Invoices', href: `${b}/invoices`, icon: 'invoice', group: 'work', gatedBy: 'invoices', copilot: 'nav-invoices' },
    { key: 'pricing', label: 'Pricing Library', href: `${b}/components`, icon: 'pricing', group: 'library' },
    { key: 'resources', label: 'Resources', href: `${b}/resources`, icon: 'library', group: 'library', copilot: 'nav-resources' },
    ...(supplier ? [{ key: 'supplier', label: 'Supplier', href: `${b}/supplier`, icon: 'supplier' as const, group: 'library' as const }] : []),
    ...(assistant ? [{ key: 'assistant', label: 'Smart Assistant', href: `${b}/assistant`, icon: 'assistant' as const, group: 'utility' as const }] : []),
    { key: 'tutorials', label: 'Tutorials', href: `${b}/tutorials`, icon: 'help', group: 'utility' },
    { key: 'account', label: 'Account', href: `${b}/account`, icon: 'account', group: 'utility' },
  ];
}
export function shellRoute(pathname: string, slug: string) {
  const segments = pathname.slice(`/${slug}`.length).split('/').filter(Boolean);
  const [section, record, detail] = segments;
  const takeoff = section === 'quotes' && !!record && detail === 'takeoff';
  const builder = section === 'quotes' && !!record && record !== 'new' &&
    (!detail || ['build', 'blank-build', 'customer-edit', 'labor-sheet'].includes(detail));
  const editor = builder || (section === 'material-orders' && record === 'create');
  const focused = (section === 'quotes' && record === 'new');
  const label = !section ? 'Home' : section === 'quotes' && detail === 'summary' ? 'Job space' : takeoff ? 'Digital takeoff' :
    builder ? (detail === 'customer-edit' ? 'Customer quote editor' : detail === 'labor-sheet' ? 'Labour sheet' : 'Quote builder') :
    ({ quotes: 'Quotes', 'material-orders': 'Orders', orders: 'Orders', invoices: 'Invoices',
      components: 'Pricing Library', resources: 'Resources', assistant: 'Smart Assistant', account: 'Account',
      tutorials: 'Tutorials', inbox: 'Message Center', supplier: 'Supplier' } as Record<string, string>)[section] ?? 'Resources';
  return { width: takeoff ? 'immersive' : editor ? 'editor' : focused ? 'focused' : 'wide',
    defaultMode: (takeoff ? 'hidden' : editor ? 'rail' : 'expanded') as ShellMode, label };
}
export function navIsActive(item: ShellNavItem, pathname: string, slug: string) {
  if (item.key === 'home') return pathname === `/${slug}` || pathname === `/${slug}/`;
  if (item.key === 'orders' && pathname.startsWith(`/${slug}/orders`)) return true;
  if (item.key === 'resources' && /^\/(attachments|catalogs|templates|drawings)(\/|$)/.test(pathname.slice(`/${slug}`.length))) return true;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
