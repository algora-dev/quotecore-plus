import Link from 'next/link';

/**
 * Compact footer for unauthenticated pages (login, signup, recover).
 *
 * The auth pages today render no chrome, which means a user landing on
 * /login has no way to reach the privacy / terms / cookie policies short of
 * typing the URL. That's not okay for a SaaS product. This footer adds the
 * legal links without disrupting the visual flow of the centred sign-in card.
 *
 * Authenticated app pages already have account/legal links in the Account
 * section sidebar so we don't need to render this footer there.
 */
export function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto py-4 px-4">
      <div className="max-w-md mx-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-400">
        <span>
          &copy; {year} QuoteCore<span className="text-orange-500">+</span>
        </span>
        <Link href="/privacy" className="hover:text-orange-600 transition">Privacy</Link>
        <Link href="/cookies" className="hover:text-orange-600 transition">Cookies</Link>
        <Link href="/terms" className="hover:text-orange-600 transition">Terms</Link>
        <a href="mailto:info@quote-core.com" className="hover:text-orange-600 transition">
          Contact
        </a>
      </div>
    </footer>
  );
}
