import Link from "next/link";
import SocialIcons from "@/components/SocialIcons";

const linkClass = "text-sm text-zinc-500 transition-colors hover:text-zinc-900";

export default function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center" aria-label="QuoteCore+ home">
              <span className="brand-wordmark text-lg font-semibold text-zinc-950">QuoteCore<span className="brand-plus">+</span></span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-6 text-zinc-500">Roofing quoting, takeoff and job workflow software. Built for roofing first, flexible enough for every trade.</p>
            <SocialIcons className="mt-5 justify-start" />
          </div>
          <nav aria-label="Product">
            <h2 className="text-sm font-semibold text-zinc-950">Product</h2>
            <div className="mt-4 flex flex-col gap-3">
              <Link href="/features" className={linkClass}>All features</Link>
              <Link href="/features/digital-roof-takeoff" className={linkClass}>Digital roof takeoff</Link>
              <Link href="/features/smart-components" className={linkClass}>Smart Components</Link>
              <Link href="/features/material-ordering" className={linkClass}>Material ordering</Link>
              <Link href="/features/invoicing" className={linkClass}>Invoicing</Link>
              <Link href="/features/supplier-resources" className={linkClass}>Supplier resources</Link>
            </div>
          </nav>
          <nav aria-label="Industries and resources">
            <h2 className="text-sm font-semibold text-zinc-950">Explore</h2>
            <div className="mt-4 flex flex-col gap-3">
              <Link href="/roofing-quoting-software" className={linkClass}>Roofing software</Link>
              <Link href="/roofing-estimating-software" className={linkClass}>Roofing estimating</Link>
              <Link href="/roofing-takeoff-software" className={linkClass}>Roofing takeoff</Link>
              <Link href="/construction-quoting-software" className={linkClass}>Other trades</Link>
              <Link href="/pricing" className={linkClass}>Pricing</Link>
              <Link href="/free-tools" className={linkClass}>Free tools</Link>
              <Link href="/free-calculators" className={linkClass}>Free calculators</Link>
              <Link href="/blog" className={linkClass}>Resources and blog</Link>
              <Link href="/resources/roofing-estimating" className={linkClass}>Roofing estimating hub</Link>
              <Link href="/resources/digital-takeoffs" className={linkClass}>Digital takeoffs hub</Link>
              <Link href="/resources/construction-quoting" className={linkClass}>Construction quoting hub</Link>
              <Link href="/resources/contractor-business" className={linkClass}>Contractor business hub</Link>
              <Link href="/resources/ai" className={linkClass}>AI in roofing hub</Link>
              <Link href="/resources/comparisons" className={linkClass}>Software comparisons</Link>
              <Link href="/tutorials" className={linkClass}>Video tutorials</Link>
              <Link href="/docs" className={linkClass}>Documentation</Link>
            </div>
          </nav>
          <nav aria-label="Company">
            <h2 className="text-sm font-semibold text-zinc-950">Company</h2>
            <div className="mt-4 flex flex-col gap-3">
              <Link href="/company" className={linkClass}>Company</Link>
              <Link href="/about" className={linkClass}>About</Link>
              <Link href="/customer-stories" className={linkClass}>Customer stories</Link>
              <Link href="/trust" className={linkClass}>Trust and security</Link>
              <Link href="/suppliers-info" className={linkClass}>For suppliers</Link>
              <Link href="/services" className={linkClass}>Services</Link>
              <Link href="/contact" className={linkClass}>Contact</Link>
              <Link href="/free-trial" className={linkClass}>Start free trial</Link>
            </div>
          </nav>
          <nav aria-label="Legal and region">
            <h2 className="text-sm font-semibold text-zinc-950">Legal</h2>
            <div className="mt-4 flex flex-col gap-3">
              <Link href="/privacy" className={linkClass}>Privacy</Link>
              <Link href="/terms" className={linkClass}>Terms</Link>
              <Link href="/cookie-policy" className={linkClass}>Cookie policy</Link>
            </div>
            <a href="https://www.quote-core.co.nz" className="mt-6 inline-flex min-h-11 items-center rounded-full border border-zinc-300 px-4 text-sm font-medium text-zinc-800 transition-colors hover:border-[#FF6B35]/50 hover:text-zinc-950">New Zealand site</a>
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-zinc-200 pt-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <p>? 2026 QuoteCore+. Built by <a href="https://t3labs.tech" className="hover:text-zinc-800">T3 Labs</a>.</p>
          <p>Global website</p>
        </div>
      </div>
    </footer>
  );
}
