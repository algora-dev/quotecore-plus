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

/** First path segment is the workspace slug, e.g. /acme/quotes -> "acme". */
function workspaceSlugFromPath(pathname: string): string {
  const seg = pathname.split('/').filter(Boolean)[0];
  return seg ?? '';
}

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
      data-assistant-id="nav-help"
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

/**
 * Distinguishes "the slug doesn't exist" from "the request itself failed"
 * so the UI can show the right message + a Retry button only when retrying
 * would actually help (Gerald audit L-02). `null` means no error.
 */
type DocError = { kind: 'not-found' } | { kind: 'network'; detail: string } | null;

export function HelpDrawerPanel() {
  const { open, closeDrawer, widthVw, setWidthVw, commitWidth } = useHelpDrawer();
  const pathname = usePathname();
  const [tree, setTree] = useState<DrawerTree | null>(null);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [treeReload, setTreeReload] = useState(0);
  const [slug, setSlug] = useState<string>('');
  const [doc, setDoc] = useState<DrawerDoc | null>(null);
  const [docError, setDocError] = useState<DocError>(null);
  const [docReload, setDocReload] = useState(0);
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

  // Load tree once when the panel first opens. Retried on demand via the
  // `treeReload` counter (incremented by the "Try again" button).
  useEffect(() => {
    if (!open || tree) return;
    let cancelled = false;
    setTreeError(null);
    (async () => {
      try {
        const r = await fetch('/api/docs/tree');
        if (cancelled) return;
        if (!r.ok) {
          setTreeError(`Could not load the help index (HTTP ${r.status}).`);
          return;
        }
        const json: DrawerTree = await r.json();
        if (!cancelled) setTree(json);
      } catch (err) {
        if (!cancelled) {
          setTreeError(
            err instanceof Error ? err.message : 'Could not reach the help service.'
          );
        }
      }
    })();
    return () => { cancelled = true; };
  }, [open, tree, treeReload]);

  // Load the doc whenever the active slug changes while the panel is open.
  // Distinguishes 404 (real not-found, retry won't help) from any other
  // failure (network/5xx, retry might help) so the UI shows the right CTA
  // (Gerald audit L-02).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const target = slug ? `/api/docs/${slug}` : '/api/docs';
    (async () => {
      setLoading(true);
      setFeedback(null);
      setDocError(null);
      try {
        const r = await fetch(target);
        if (cancelled) return;
        if (!r.ok) {
          setDoc(null);
          if (r.status === 404) {
            setDocError({ kind: 'not-found' });
          } else {
            setDocError({ kind: 'network', detail: `HTTP ${r.status}` });
          }
          return;
        }
        const json: DrawerDoc = await r.json();
        if (cancelled) return;
        setDoc(json);
        requestAnimationFrame(() => {
          contentScrollRef.current?.scrollTo({ top: 0 });
        });
      } catch (err) {
        if (!cancelled) {
          setDoc(null);
          setDocError({
            kind: 'network',
            detail: err instanceof Error ? err.message : 'fetch failed',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, slug, docReload]);

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

  /**
   * Record a helpful/not-helpful vote against the currently-loaded doc.
   * Persists to `docs_feedback` via /api/docs/feedback so we have real
   * telemetry on which pages are landing well (Gerald audit M-04). The
   * write is best-effort - a failed POST just logs a warning and the UI
   * still shows the vote as recorded locally, because vote persistence is
   * never worth interrupting the user with a toast.
   */
  const onFeedback = useCallback((kind: 'up' | 'down') => {
    setFeedback(kind);
    if (typeof window === 'undefined') return;
    const slug = doc?.slug ?? '';
    void fetch('/api/docs/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        vote: kind,
        appPath: window.location.pathname,
      }),
      keepalive: true,
    }).catch((err) => {
      window.console.warn('[help-drawer] feedback POST failed:', err);
    });
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

          {/* Tutorials entry — prominent button under Search, above the doc tree.
              Takes the user to the /tutorials onboarding hub and closes the drawer. */}
          <Link
            href={`/${workspaceSlugFromPath(pathname)}/tutorials`}
            onClick={closeDrawer}
            data-assistant-id="help-drawer-tutorials"
            className="mb-4 flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-sm font-semibold text-orange-800 hover:bg-orange-100 hover:border-orange-300 hover:shadow-[0_0_8px_rgba(255,107,53,0.12)] transition-all"
          >
            <svg className="h-5 w-5 flex-shrink-0 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span>Tutorials — new here? Start here</span>
          </Link>

          <DrawerNav
            tree={tree}
            treeError={treeError}
            onRetry={() => setTreeReload((n) => n + 1)}
            active={slug}
            onPick={onPickSlug}
          />
        </aside>

        {/* Content pane. */}
        <div
          ref={contentScrollRef}
          className="h-full flex-1 overflow-y-auto px-5 py-5"
        >
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : !doc ? (
            docError?.kind === 'network' ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm">
                <p className="font-semibold text-rose-900">Couldn&apos;t load this help page.</p>
                <p className="mt-1 text-rose-800">
                  {docError.detail}. Check your connection and try again.
                </p>
                <button
                  type="button"
                  onClick={() => setDocReload((n) => n + 1)}
                  className="mt-3 inline-flex items-center gap-1 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                >
                  Try again
                </button>
              </div>
            ) : docError?.kind === 'not-found' ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">This help page isn&apos;t available.</p>
                <p className="mt-1 text-slate-600">
                  Try picking another topic from the sidebar.
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No help page available.</p>
            )
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
  treeError,
  onRetry,
  active,
  onPick,
}: {
  tree: DrawerTree | null;
  treeError: string | null;
  onRetry: () => void;
  active: string;
  onPick: (slug: string) => void;
}) {
  if (!tree) {
    if (treeError) {
      return (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs">
          <p className="font-semibold text-rose-900">Help index unavailable</p>
          <p className="mt-1 text-rose-800">{treeError}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-1 rounded-md bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-700"
          >
            Try again
          </button>
        </div>
      );
    }
    return <p className="text-sm text-slate-500">Loading index...</p>;
  }
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
