"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavKey = 'components' | 'quotes' | 'material-orders';

const makeNavItems = (slug: string) => {
  const base = `/${slug}`;
  return [
    { key: 'components' as NavKey, href: `${base}/components`, label: 'Components' },
    { key: 'quotes' as NavKey, href: `${base}/quotes`, label: 'Quotes' },
    { key: 'material-orders' as NavKey, href: `${base}/material-orders`, label: 'Material Orders' },
  ];
};

export function WorkspaceNav({ workspaceSlug }: { workspaceSlug: string }) {
  const pathname = usePathname();
  const items = makeNavItems(workspaceSlug);

  return (
    <nav className="flex flex-wrap items-center gap-2 text-sm">
      {items.map((item) => {
        const isActive = pathname?.startsWith(`${item.href}`);
        return (
          <Link
            key={item.key}
            href={item.href}
            prefetch={false}
            className={`rounded-full px-3 py-1 transition-all duration-200 ease-in-out ${
              isActive
                ? 'bg-black text-white border-2 border-black'
                : 'text-slate-600 border-2 border-transparent pill-shimmer'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
