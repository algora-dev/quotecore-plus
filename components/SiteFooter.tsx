import SocialIcons from "@/components/SocialIcons";

export default function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200 py-10 text-center text-sm text-zinc-500">
      <p className="mb-4 text-xs text-zinc-400">
        <span className="brand-wordmark">
          QuoteCore<span className="brand-plus">+</span>
        </span>{" "}
        is quoting software for contractors and trade businesses.
      </p>
      <p>
        <a href="/" className="hover:text-zinc-800">Home</a>
        {" · "}
        <a href="/services" className="hover:text-zinc-800">Services</a>
        {" · "}
        <a href="/#pricing" className="hover:text-zinc-800">Pricing</a>
        {" · "}
        <a href="/blog" className="hover:text-zinc-800">Blog</a>
        {" · "}
        <a href="https://app.quote-core.com/docs" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-800">Documentation</a>
        {" · "}
        <a href="/contact" className="hover:text-zinc-800">Contact</a>
        {" · "}
        <a href="/free-trial" className="hover:text-zinc-800">Free Trial</a>
        {" · "}
        <a href="/privacy" className="hover:text-zinc-800">Privacy Policy</a>
        {" · "}
        <a href="/terms" className="hover:text-zinc-800">Terms &amp; Conditions</a>
        {" · "}
        <a href="/cookie-policy" className="hover:text-zinc-800">Cookie Policy</a>
      </p>
      <p className="mt-3">
        © 2026{" "}
        <span className="brand-wordmark">
          QuoteCore<span className="brand-plus">+</span>
        </span>
      </p>
      <p className="mt-1">
        Built by <a href="https://t3labs.tech" className="hover:text-zinc-800">T3 Labs</a>
      </p>
      <SocialIcons />
    </footer>
  );
}
