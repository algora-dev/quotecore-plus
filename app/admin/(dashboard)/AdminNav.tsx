'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Admin sidebar. Add new sections here as they ship. Each item highlights
 * itself based on `usePathname()`.
 */
const ADMIN_NAV: { label: string; href: string; soon?: boolean }[] = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Admin accounts', href: '/admin/admins' },
  { label: 'Support tickets', href: '/admin/support-tickets' },
  { label: 'Suppressions', href: '/admin/suppressions' },
  { label: 'Delete account', href: '/admin/users' },
  { label: 'Companies', href: '/admin/companies', soon: true },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="bg-white rounded-xl border border-slate-200 p-2">
      <ul className="space-y-0.5">
        {ADMIN_NAV.map((item) => {
          const active = pathname === item.href;
          const isComingSoon = item.soon;
          const cls = [
            'flex items-center justify-between rounded-lg px-3 py-2 text-sm',
            active
              ? 'bg-slate-900 text-white'
              : isComingSoon
                ? 'text-slate-400 cursor-not-allowed'
                : 'text-slate-700 hover:bg-slate-50',
          ].join(' ');
          if (isComingSoon) {
            return (
              <li key={item.href}>
                <span className={cls}>
                  {item.label}
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    Soon
                  </span>
                </span>
              </li>
            );
          }
          return (
            <li key={item.href}>
              <Link href={item.href} className={cls}>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
