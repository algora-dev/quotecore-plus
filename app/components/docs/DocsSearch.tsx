'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { SearchEntry } from '@/app/lib/docs/tree';

interface Props {
  index: SearchEntry[];
  base?: string;
}

/**
 * Lightweight client-side search. Substring + token match across title and
 * description. Good enough for ~50 pages; we can swap in Algolia later without
 * touching the UI.
 */
export function DocsSearch({ index, base = '/docs' }: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const tokens = needle.split(/\s+/).filter(Boolean);
    return index
      .map((e) => {
        const hay = `${e.title} ${e.description} ${e.section}`.toLowerCase();
        let score = 0;
        for (const t of tokens) {
          const i = hay.indexOf(t);
          if (i === -1) return null;
          score += t.length + (e.title.toLowerCase().includes(t) ? 5 : 0);
        }
        return { entry: e, score };
      })
      .filter(Boolean)
      .sort((a, b) => b!.score - a!.score)
      .slice(0, 8) as { entry: SearchEntry; score: number }[];
  }, [q, index]);

  return (
    <div ref={ref} className="relative">
      <input
        type="search"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search docs..."
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
      />
      {open && q && results.length > 0 ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          <ul>
            {results.map(({ entry }) => (
              <li key={entry.slug || 'index'} className="border-b border-slate-100 last:border-b-0">
                <Link
                  href={`${base}/${entry.slug}`}
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 hover:bg-slate-50"
                >
                  <p className="text-sm font-semibold text-slate-900">{entry.title}</p>
                  {entry.section ? <p className="text-[11px] uppercase tracking-wide text-slate-500">{entry.section}</p> : null}
                  {entry.description ? <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{entry.description}</p> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {open && q && results.length === 0 ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-lg">
          No matches.
        </div>
      ) : null}
    </div>
  );
}
