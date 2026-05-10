'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { pathnameToDocSlug } from '@/app/lib/docs/route-mapping';

interface DrawerTreePage { slug: string; title: string; status: 'published' | 'coming-soon' }
interface DrawerTreeSection { id: string; title: string; pages: DrawerTreePage[] }
interface DrawerTree { root: { slug: string; title: string } | null; sections: DrawerTreeSection[] }

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
 * Trigger lives in the workspace header. Clicking it slides a 480px panel in
 * from the right. The panel:
 *   - opens to the doc most relevant to the current pathname,
 *   - has its own embedded sidebar so the user can browse without leaving,
 *   - links each page to the public /docs/<slug> equivalent,
 *   - has a thumbs-up/down feedback row at the bottom (no-op for now,
 *     wired only to console.info; real telemetry is a future commit).
 */
export function HelpDrawer() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<DrawerTree | null>(null);
  const [slug, setSlug] = useState<string>('');
  const [doc, setDoc] = useState<DrawerDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load tree once when the drawer first opens.
  useEffect(() => {
    if (!open || tree) return;
    fetch('/api/docs/tree').then(async (r) => {
      if (r.ok) setTree(await r.json());
    }).catch(() => {});
  }, [open, tree]);

  // When opening, pick a default slug from the current pathname.
  useEffect(() => {
    if (!open) return;
    const matched = pathnameToDocSlug(pathname);
    setSlug(matched);
  }, [open, pathname]);

  // Load the doc for the current slug.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setFeedback(null);
    const target = slug ? `/api/docs/${slug}` : '/api/docs';
    fetch(target).then(async (r) => {
      if (!r.ok) { setDoc(null); return; }
      const json = await r.json();
      setDoc(json);
      // Reset scroll position to top when changing pages.
      requestAnimationFrame(() => {
        panelRef.current?.querySelector('[data-drawer-scroll]')?.scrollTo({ top: 0 });
      });
    }).catch(() => setDoc(null)).finally(() => setLoading(false));
  }, [open, slug]);

  // Lock body scroll while drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const onPickSlug = useCallback((next: string) => {
    setSlug(next);
    setShowSidebar(false);
  }, []);

  const onFeedback = useCallback((kind: 'up' | 'down') => {
    setFeedback(kind);
    // Telemetry handler placeholder. Wire to a real endpoint in a follow-up.
    // eslint-disable-next-line no-console
    console.info('[help-drawer] feedback', { slug: doc?.slug, kind });
  }, [doc?.slug]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
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
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Help">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            className="absolute right-0 top-0 flex h-full w-full max-w-[480px] flex-col bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setShowSidebar((s) => !s)}
                  className="rounded p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  aria-label="Toggle help index"
                  title="Browse help index"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                </button>
                <p className="truncate text-sm font-semibold text-slate-900">
                  {doc?.title ?? 'Help'}
                </p>
              </div>
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
                  onClick={() => setOpen(false)}
                  className="rounded p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  aria-label="Close help"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div data-drawer-scroll className="flex-1 overflow-auto">
              {showSidebar ? (
                <div className="p-4">
                  <DrawerNav tree={tree} active={slug} onPick={onPickSlug} />
                </div>
              ) : null}

              {!showSidebar ? (
                <div className="px-5 py-5">
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
              ) : null}
            </div>
          </div>
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
