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
            className={`rounded-full px-3 py-1 transition-all duration-200 ease-in-out ${
              isActive
                ? 'bg-black text-white border-2 border-black'
                : 'text-slate-600 border-2 border-transparent hover:border-orange-500 hover:shadow-[0_0_8px_rgba(255,107,53,0.3)] hover:scale-102'
            }`}
            style={!isActive ? { transform: 'scale(1)' } : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
