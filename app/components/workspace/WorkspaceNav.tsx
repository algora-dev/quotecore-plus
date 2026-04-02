"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavKey = 'overview' | 'components' | 'templates' | 'quotes';

const makeNavItems = (slug: string) => {
  const base = `/${slug}`;
  return [
    { key: 'overview' as NavKey, href: base, label: 'Overview' },
    { key: 'components' as NavKey, href: `${base}/components`, label: 'Components' },
    { key: 'templates' as NavKey, href: `${base}/templates`, label: 'Templates' },
    { key: 'quotes' as NavKey, href: `${base}/quotes`, label: 'Quotes' },
  ];
};

export function WorkspaceNav({ workspaceSlug }: { workspaceSlug: string }) {
  const pathname = usePathname();
  const items = makeNavItems(workspaceSlug);

  return (
    <nav className="flex flex-wrap items-center gap-2 text-sm">
      {items.map((item) => {
        const isActive =
          item.href === pathname ||
          (item.key !== 'overview' && pathname?.startsWith(`${item.href}`));
        return (
          <Link
            key={item.key}
            href={item.href}
            prefetch={false}
            className={`rounded-full px-3 py-1 transition ${
              isActive
                ? 'bg-slate-900 text-white'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
