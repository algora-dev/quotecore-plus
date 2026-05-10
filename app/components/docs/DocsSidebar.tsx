'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { DocTree } from '@/app/lib/docs/tree';

interface Props {
  tree: DocTree;
  /** Optional URL prefix - "/docs" for the public site, "" for inline drawer use. */
  base?: string;
  /** Compact mode shrinks padding and font sizes for the in-app drawer. */
  compact?: boolean;
}

export function DocsSidebar({ tree, base = '/docs', compact = false }: Props) {
  const pathname = usePathname() || '';

  // Active slug = whatever's after the base prefix.
  const activeSlug = (() => {
    if (!pathname.startsWith(base)) return '';
    const rest = pathname.slice(base.length).replace(/^\//, '');
    return rest;
  })();

  return (
    <nav aria-label="Documentation" className={compact ? 'text-sm' : 'text-sm'}>
      <ul className="space-y-6">
        {/* Root link */}
        <li>
          <Link
            href={base || '/docs'}
            className={[
              'block rounded px-2 py-1 font-semibold',
              activeSlug === '' ? 'bg-orange-50 text-orange-700' : 'text-slate-900 hover:bg-slate-100',
            ].join(' ')}
          >
            Welcome
          </Link>
        </li>

        {tree.sections.map((section) => (
          <li key={section.id}>
            <p className={[
              'mb-2 px-2 font-semibold uppercase tracking-wide',
              compact ? 'text-[10px] text-slate-500' : 'text-xs text-slate-500',
            ].join(' ')}>
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.pages.map((page) => {
                const href = `${base || '/docs'}/${page.slug}`;
                const isActive = page.slug === activeSlug;
                return (
                  <li key={page.slug}>
                    <Link
                      href={href}
                      className={[
                        'block rounded px-2 py-1 leading-snug',
                        isActive
                          ? 'bg-orange-50 text-orange-700'
                          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
                      ].join(' ')}
                    >
                      <span>{page.frontmatter.title}</span>
                      {page.frontmatter.status === 'coming-soon' ? (
                        <span className="ml-2 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">
                          Soon
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Mobile sidebar - hamburger that toggles the same nav as a slide-down panel.
 */
export function DocsSidebarMobile({ tree, base = '/docs' }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden border-b border-slate-200 bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-slate-900"
        aria-expanded={open}
        aria-controls="docs-mobile-nav"
      >
        <span>Browse docs</span>
        <svg className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" />
        </svg>
      </button>
      {open ? (
        <div id="docs-mobile-nav" className="border-t border-slate-200 px-4 py-4">
          <DocsSidebar tree={tree} base={base} compact />
        </div>
      ) : null}
    </div>
  );
}
