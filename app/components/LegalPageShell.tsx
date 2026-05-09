import Link from 'next/link';

/**
 * Shared shell for the legal pages (/privacy, /cookies, /terms).
 *
 * Why a shared shell:
 *   - Consistent header / footer across all three documents
 *   - Single place to update brand chrome when it changes
 *   - All three pages need the same anonymous nav (no auth, no workspace)
 *
 * The shell is intentionally simple — no client JS, no interactivity. Anchors
 * inside the document handle in-page navigation. Each section in a legal doc
 * uses an `<h2 id="...">` so the table-of-contents on the right column links
 * straight to it via standard browser hash behaviour.
 */
export function LegalPageShell({
  title,
  effectiveDate,
  toc,
  children,
}: {
  title: string;
  effectiveDate: string;
  /** [{ id, label }] — id must match an `<h2 id="">` in `children`. */
  toc: { id: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center">
            <img src="/logo-email.png" alt="QuoteCore+" className="h-8" />
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-slate-600 hover:text-orange-600 transition">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="px-4 py-1.5 rounded-full bg-black text-white hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] transition-all"
            >
              Sign up
            </Link>
          </nav>
        </div>
      </header>

      {/* Content + TOC */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-semibold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500 mt-2">
            Effective date: <span className="font-medium text-slate-700">{effectiveDate}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-10 items-start">
          {/* Article body */}
          <article className="prose prose-slate max-w-none prose-headings:scroll-mt-24 prose-h2:text-xl prose-h2:font-semibold prose-h2:mt-10 prose-h3:text-base prose-h3:font-semibold prose-h3:mt-6 prose-p:text-slate-700 prose-p:leading-relaxed prose-li:text-slate-700 prose-a:text-orange-600 prose-a:no-underline hover:prose-a:underline">
            {children}
          </article>

          {/* TOC — sticky on desktop, hidden on mobile (use in-page scroll) */}
          <aside className="hidden lg:block sticky top-6 self-start">
            <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-3">
              On this page
            </p>
            <ul className="space-y-2 border-l border-slate-200 pl-3">
              {toc.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="text-sm text-slate-600 hover:text-orange-600 transition"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-16">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs text-slate-500">
          <div>
            &copy; {new Date().getFullYear()} QuoteCore<span className="text-orange-500">+</span>
            <span className="ml-2 text-slate-400">[Costa Rica Entity Name TBC]</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-orange-600 transition">Privacy</Link>
            <Link href="/cookies" className="hover:text-orange-600 transition">Cookies</Link>
            <Link href="/terms" className="hover:text-orange-600 transition">Terms</Link>
            <a href="mailto:info@quote-core.com" className="hover:text-orange-600 transition">
              Contact
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
