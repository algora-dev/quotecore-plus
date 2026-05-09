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
          {/*
            Article body. We don't use Tailwind's `prose` classes because the
            project doesn't include @tailwindcss/typography; without that plugin
            those classes are silently ignored, which is why the early version
            of these pages rendered as one undifferentiated wall of text. The
            `legal-doc` className below is paired with explicit selectors in
            globals.css to give h2/h3/p/ul/li/table real visual hierarchy.
          */}
          <article className="legal-doc text-slate-700 leading-relaxed">
            {children}
          </article>

          {/*
            Table of Contents. Sticky on desktop (md+), hidden on mobile where
            users can rely on the document's natural scroll. Each anchor jumps
            to a heading via `#id`; we apply scroll-margin in globals.css so
            the heading isn't hidden under any sticky header on landing.
          */}
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
