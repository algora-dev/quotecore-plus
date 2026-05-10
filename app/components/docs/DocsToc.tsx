'use client';

import { useEffect, useState } from 'react';
import type { TocEntry } from '@/app/lib/docs/loader';

interface Props {
  entries: TocEntry[];
}

/**
 * Right-rail table of contents. Highlights the current section as you scroll
 * by checking which heading is closest to the top of the viewport.
 */
export function DocsToc({ entries }: Props) {
  const [activeId, setActiveId] = useState<string | null>(entries[0]?.id ?? null);

  useEffect(() => {
    if (entries.length === 0) return;
    function update() {
      const ids = entries.map((e) => e.id);
      let current: string | null = ids[0] ?? null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top - 120 <= 0) current = id;
      }
      setActiveId(current);
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">On this page</p>
      <ul className="space-y-1">
        {entries.map((e) => (
          <li key={e.id} className={e.depth === 3 ? 'pl-3' : ''}>
            <a
              href={`#${e.id}`}
              className={[
                'block rounded px-2 py-1 leading-snug transition-colors',
                activeId === e.id
                  ? 'bg-orange-50 text-orange-700'
                  : 'text-slate-600 hover:text-slate-900',
              ].join(' ')}
            >
              {e.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
