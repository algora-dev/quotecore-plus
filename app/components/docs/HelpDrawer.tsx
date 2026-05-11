'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { pathnameToDocSlug } from '@/app/lib/docs/route-mapping';

interface DrawerTreePage { slug: string; title: string; status: 'published' | 'coming-soon' }
interface DrawerTreeSection { id: string; title: string; pages: DrawerTreePage[] }
interface DrawerSearchEntry { slug: string; title: string; description: string; section: string }
interface DrawerTree {
  root: { slug: string; title: string } | null;
  sections: DrawerTreeSection[];
  searchIndex: DrawerSearchEntry[];
}

interface DrawerDoc {
  slug: string;
  title: string;
  description: string;
  section: string;
  sectionTitle: string;
  status: 'published' | 'coming-soon';
  html: string;
}

/**
 * In-app help panel.
 *
 * Anchored to the LEFT of the viewport. Two independent scroll panes:
 *   - nav (sections + pages, like GitBook — always visible)
 *   - content (the doc itself)
 * The app underneath stays fully interactive (no backdrop, no body-scroll lock).
 *
 * Width is user-resizable via a drag handle on the panel's right edge. An
 * "expand" button toggles full-width (panel covers the whole viewport for
 * focused reading) and back to the split layout. Sizing preferences are
 * persisted to localStorage.
 *
 * Default split is roughly 50% panel / 50% app, with the panel split internally
 * as 15% / 35% of viewport width (i.e. ~30% / ~70% of the panel itself).
 */

const STORAGE_WIDTH = 'qc.helpPanel.widthVw';
const STORAGE_EXPANDED = 'qc.helpPanel.expanded';
const DEFAULT_WIDTH_VW = 50;
const MIN_WIDTH_VW = 28;
const MAX_WIDTH_VW = 92;

export function HelpDrawer() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<DrawerTree | null>(null);
  const [slug, setSlug] = useState<string>('');
  const [doc, setDoc] = useState<DrawerDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [widthVw, setWidthVw] = useState<number>(DEFAULT_WIDTH_VW);
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  // Hydrate stored preferences on mount.
  useEffect(() => {
    try {
      const w = Number(window.localStorage.getItem(STORAGE_WIDTH));
      if (Number.isFinite(w) && w >= MIN_WIDTH_VW && w <= MAX_WIDTH_VW) setWidthVw(w);
      const e = window.localStorage.getItem(STORAGE_EXPANDED);
      if (e === '1') setExpanded(true);
    } catch {
      // localStorage may be unavailable (private mode, SSR mismatch); fine.
    }
  }, []);

  const openDrawer = useCallback(() => {
    setSlug(pathnameToDocSlug(pathname));
    setOpen(true);
  }, [pathname]);

  // Load tree once when the panel first opens.
  useEffect(() => {
    if (!open || tree) return;
    let cancelled = false;
    fetch('/api/docs/tree').then(async (r) => {
      if (!r.ok || cancelled) return;
      const json: DrawerTree = await r.json();
      if (!cancelled) setTree(json);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [open, tree]);

  // Load the doc whenever the active slug changes while the panel is open.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const target = slug ? `/api/docs/${slug}` : '/api/docs';
    (async () => {
      setLoading(true);
      setFeedback(null);
      try {
        const r = await fetch(target);
        if (cancelled) return;
        if (!r.ok) { setDoc(null); return; }
        const json: DrawerDoc = await r.json();
        if (cancelled) return;
        setDoc(json);
        requestAnimationFrame(() => {
          contentScrollRef.current?.scrollTo({ top: 0 });
        });
      } catch {
        if (!cancelled) setDoc(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, slug]);

  // Esc to close. NOTE: we deliberately DO NOT lock body scroll — the app
  // underneath must stay scrollable and clickable while the panel is open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const onPickSlug = useCallback((next: string) => {
    setSlug(next);
  }, []);

  // Search state lives in the drawer (not the nav) so picking a result can
  // also clear the box without the nav owning a ref into the search UI.
  const [query, setQuery] = useState('');
  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || !tree) return [];
    const tokens = needle.split(/\s+/).filter(Boolean);
    return tree.searchIndex
      .map((e) => {
        const hay = `${e.title} ${e.description} ${e.section}`.toLowerCase();
        let score = 0;
        for (const t of tokens) {
          if (hay.indexOf(t) === -1) return null;
          score += t.length + (e.title.toLowerCase().includes(t) ? 5 : 0);
        }
        return { entry: e, score };
      })
      .filter((x): x is { entry: DrawerSearchEntry; score: number } => x !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [query, tree]);

  const onFeedback = useCallback((kind: 'up' | 'down') => {
    setFeedback(kind);
    if (typeof window !== 'undefined') {
      window.console.info('[help-drawer] feedback', { slug: doc?.slug, kind });
    }
  }, [doc?.slug]);

  // Drag-to-resize. The handle lives on the panel's right edge. Mouse X gives
  // us the desired panel width directly because the panel is anchored to the
  // left of the viewport.
  const onDragStart = useCallback((e: React.PointerEvent) => {
    if (expanded) return; // resizing is a no-op while expanded
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, [expanded]);

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const next = (e.clientX / window.innerWidth) * 100;
    const clamped = Math.min(MAX_WIDTH_VW, Math.max(MIN_WIDTH_VW, next));
    setWidthVw(clamped);
  }, []);

  const onDragEnd = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    try { window.localStorage.setItem(STORAGE_WIDTH, String(widthVw)); } catch {}
  }, [widthVw]);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      try { window.localStorage.setItem(STORAGE_EXPANDED, next ? '1' : '0'); } catch {}
      return next;
    });
  }, []);

  const effectiveWidth = expanded ? 100 : widthVw;

  return (
    <>
      <button
        type="button"
        onClick={openDrawer}
        className="flex items-center gap-1.5 rounded-full border border-transparent px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
        title="Open help"
        aria-label="Open help"
        data-help-trigger
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span className="hidden sm:inline">Help</span>
      </button>

      {open ? (
        // Fixed positioning at top:0, left:0 only — we explicitly do NOT cover
        // the whole viewport. The app to the right stays interactive.
        <div
          ref={panelRef}
          className="fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-slate-200 bg-white shadow-2xl"
          style={{ width: `${effectiveWidth}vw` }}
          role="dialog"
          aria-label="Help"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-900">
              {doc?.title ?? 'Help'}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleExpanded}
                className="rounded p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                aria-label={expanded ? 'Collapse help panel' : 'Expand help panel'}
                title={expanded ? 'Collapse (show app)' : 'Expand (full width)'}
              >
                {expanded ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                )}
              </button>
              {doc ? (
                <Link
                  href={`/docs/${doc.slug}`}
                  target="_blank"
                  className="hidden sm:inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  title="Open in full page"
                >
                  Open full page
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 3h7v7M10 14L21 3M21 14v7h-7M3 10V3h7M3 14L14 3" /></svg>
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                aria-label="Close help"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          </div>

          {/* Body: two independent scroll panes side-by-side. */}
          <div className="flex min-h-0 flex-1">
            {/* Nav pane — always visible (GitBook-style). Search lives at the
                top of this column so users can jump straight to a page without
                hunting through the sections list. */}
            <aside
              className="h-full w-[30%] min-w-[180px] max-w-[320px] overflow-y-auto border-r border-slate-200 bg-slate-50/60 px-3 py-4"
            >
              <div className="relative mb-4">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search help..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  aria-label="Search help"
                />
                {query.trim() ? (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-white shadow-sm">
                    {searchResults.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-slate-500">No matches.</p>
                    ) : (
                      <ul>
                        {searchResults.map(({ entry }) => (
                          <li key={entry.slug || 'index'} className="border-b border-slate-100 last:border-b-0">
                            <button
                              type="button"
                              onClick={() => { onPickSlug(entry.slug); setQuery(''); }}
                              className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                            >
                              <p className="text-sm font-semibold text-slate-900">{entry.title}</p>
                              {entry.section ? (
                                <p className="text-[10px] uppercase tracking-wide text-slate-500">{entry.section}</p>
                              ) : null}
                              {entry.description ? (
                                <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{entry.description}</p>
                              ) : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
              <DrawerNav tree={tree} active={slug} onPick={onPickSlug} />
            </aside>

            {/* Content pane. */}
            <div
              ref={contentScrollRef}
              className="h-full flex-1 overflow-y-auto px-6 py-5"
            >
              {loading ? (
                <p className="text-sm text-slate-500">Loading...</p>
              ) : !doc ? (
                <p className="text-sm text-slate-500">No help page available.</p>
              ) : (
                <article className="mx-auto max-w-3xl">
                  {doc.sectionTitle ? (
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{doc.sectionTitle}</p>
                  ) : null}
                  <h2 className="mb-1 text-2xl font-bold text-slate-900">{doc.title}</h2>
                  {doc.description ? (
                    <p className="mb-4 text-sm text-slate-600">{doc.description}</p>
                  ) : null}
                  {doc.status === 'coming-soon' ? (
                    <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-900">
                      This feature is coming soon.
                    </div>
                  ) : null}
                  <div className="docs-prose" dangerouslySetInnerHTML={{ __html: doc.html }} />

                  {/* Feedback row */}
                  <div className="mt-8 flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs text-slate-600">Was this helpful?</p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onFeedback('up')}
                        className={[
                          'rounded p-1.5',
                          feedback === 'up' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:text-slate-900 hover:bg-white',
                        ].join(' ')}
                        aria-label="Helpful"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22V11" /></svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => onFeedback('down')}
                        className={[
                          'rounded p-1.5',
                          feedback === 'down' ? 'bg-rose-100 text-rose-700' : 'text-slate-500 hover:text-slate-900 hover:bg-white',
                        ].join(' ')}
                        aria-label="Not helpful"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3zM17 2v13" /></svg>
                      </button>
                    </div>
                  </div>
                </article>
              )}
            </div>
          </div>

          {/* Drag handle pinned to the panel's right edge. Hidden when fully
              expanded since there's nothing to resize against. */}
          {!expanded ? (
            <div
              role="separator"
              aria-label="Resize help panel"
              aria-orientation="vertical"
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
              className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-orange-200/60 active:bg-orange-300/70"
              style={{ touchAction: 'none' }}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function DrawerNav({
  tree,
  active,
  onPick,
}: {
  tree: DrawerTree | null;
  active: string;
  onPick: (slug: string) => void;
}) {
  if (!tree) return <p className="text-sm text-slate-500">Loading index...</p>;
  return (
    <nav className="text-sm">
      <ul className="space-y-5">
        {tree.root ? (
          <li>
            <button
              type="button"
              onClick={() => onPick('')}
              className={[
                'block w-full rounded px-2 py-1 text-left font-semibold',
                active === '' ? 'bg-orange-50 text-orange-700' : 'text-slate-900 hover:bg-slate-100',
              ].join(' ')}
            >
              {tree.root.title}
            </button>
          </li>
        ) : null}
        {tree.sections.map((s) => (
          <li key={s.id}>
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{s.title}</p>
            <ul className="space-y-0.5">
              {s.pages.map((p) => (
                <li key={p.slug}>
                  <button
                    type="button"
                    onClick={() => onPick(p.slug)}
                    className={[
                      'block w-full rounded px-2 py-1 text-left leading-snug',
                      p.slug === active
                        ? 'bg-orange-50 text-orange-700'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
                    ].join(' ')}
                  >
                    <span>{p.title}</span>
                    {p.status === 'coming-soon' ? (
                      <span className="ml-2 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">Soon</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
