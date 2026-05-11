'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { pathnameToDocSlug } from '@/app/lib/docs/route-mapping';
import {
  useHelpDrawer,
  HELP_DRAWER_MAX_WIDTH_VW,
  HELP_DRAWER_MIN_WIDTH_VW,
} from './HelpDrawerContext';

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
 * In-app help drawer.
 *
 * Exports two pieces:
 *   - `<HelpDrawerTrigger>`: the small button in the workspace header. Opens
 *     the drawer via shared context.
 *   - `<HelpDrawerPanel>`: the actual side panel. Mounts fixed on the LEFT
 *     edge of the viewport and co-occupies space with the app via the
 *     `<HelpDrawerLayout>` margin offset.
 *
 * Both are client components that read the shared `useHelpDrawer()` context.
 *
 * The panel always reserves its column rather than overlaying \u2014 the app
 * shrinks to share screen space, and the user can browse nav/content while
 * still seeing all the app chrome (top nav, account menu, etc.).
 *
 * Width is user-resizable up to a hard cap of 35% of the viewport so the app
 * never loses more than a third of its horizontal real estate.
 */

export function HelpDrawerTrigger() {
  const { openDrawer } = useHelpDrawer();
  return (
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
  );
}

export function HelpDrawerPanel() {
  const { open, closeDrawer, widthVw, setWidthVw, commitWidth } = useHelpDrawer();
  const pathname = usePathname();
  const [tree, setTree] = useState<DrawerTree | null>(null);
  const [slug, setSlug] = useState<string>('');
  const [doc, setDoc] = useState<DrawerDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [query, setQuery] = useState('');
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  // When the drawer is first opened, pick the doc that matches the current
  // pathname. If the user navigates the app afterwards the doc does NOT
  // auto-change \u2014 they keep the page they were reading. (This matches the
  // behaviour Shaun asked for: read help while navigating the app.)
  useEffect(() => {
    if (!open) return;
    if (slug !== '' || doc !== null) return; // already loaded a doc
    setSlug(pathnameToDocSlug(pathname));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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

  // Esc to close. NOTE: no body-scroll lock \u2014 the app underneath must stay
  // scrollable and clickable while the drawer is open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closeDrawer(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeDrawer]);

  const onPickSlug = useCallback((next: string) => {
    setSlug(next);
  }, []);

  const onFeedback = useCallback((kind: 'up' | 'down') => {
    setFeedback(kind);
    if (typeof window !== 'undefined') {
      window.console.info('[help-drawer] feedback', { slug: doc?.slug, kind });
    }
  }, [doc?.slug]);

  // Drag-to-resize: handle on the panel's right edge. Mouse X is the desired
  // drawer width because the drawer is anchored to the viewport's left.
  const onDragStart = useCallback((e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const next = (e.clientX / window.innerWidth) * 100;
    setWidthVw(next);
  }, [setWidthVw]);

  const onDragEnd = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    commitWidth();
  }, [commitWidth]);

  // Search across the loaded index. No-op when the box is empty.
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

  if (!open) return null;

  // Effective width is already clamped by the context's setter, but we
  // belt-and-brace here in case stored values predate the cap change.
  const effectiveWidth = Math.min(HELP_DRAWER_MAX_WIDTH_VW, Math.max(HELP_DRAWER_MIN_WIDTH_VW, widthVw));

  return (
    <div
      className="fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-slate-200 bg-white shadow-xl"
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
            onClick={closeDrawer}
            className="rounded p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            aria-label="Close help"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      </div>

      {/* Body: two independent scroll panes side-by-side. */}
      <div className="flex min-h-0 flex-1">
        {/* Nav pane \u2014 always visible, GitBook-style. Search at the top. */}
        <aside
          className="h-full w-[42%] min-w-[160px] max-w-[260px] overflow-y-auto border-r border-slate-200 bg-slate-50/60 px-3 py-4"
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
          className="h-full flex-1 overflow-y-auto px-5 py-5"
        >
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : !doc ? (
            <p className="text-sm text-slate-500">No help page available.</p>
          ) : (
            <article>
              {doc.sectionTitle ? (
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{doc.sectionTitle}</p>
              ) : null}
              <h2 className="mb-1 text-xl font-bold text-slate-900">{doc.title}</h2>
              {doc.description ? (
                <p className="mb-4 text-sm text-slate-600">{doc.description}</p>
              ) : null}
              {doc.status === 'coming-soon' ? (
                <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-900">
                  This feature is coming soon.
                </div>
              ) : null}
              <div className="docs-prose docs-prose--compact" dangerouslySetInnerHTML={{ __html: doc.html }} />

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

      {/* Drag handle pinned to the panel's right edge. */}
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
    </div>
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

/**
 * Backwards-compat default export so any caller still importing `HelpDrawer`
 * keeps working. New layout code should use `<HelpDrawerTrigger>` +
 * `<HelpDrawerPanel>` directly, mounted in separate positions.
 */
export function HelpDrawer() {
  return (
    <>
      <HelpDrawerTrigger />
      <HelpDrawerPanel />
    </>
  );
}
