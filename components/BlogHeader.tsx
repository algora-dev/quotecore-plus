"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";

const navItems = [
  { label: "Home", href: "/" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Services", href: "/services" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Free Tools", href: "/free-tools" },
  { label: "Blog", href: "/blog" },
  { label: "Documentation", href: "https://app.quote-core.com/docs", external: true },
  { label: "Contact us", href: "/contact" },
  { label: "Free trial", href: "/free-trial" },
];

export default function BlogHeader({ backLabel, backHref = "/" }: { backLabel?: string; backHref?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const headerButton =
    "inline-flex h-12 min-w-[138px] items-center justify-center rounded-full px-5 text-sm transition-colors duration-200";

  const contactButton =
    `${headerButton} pill-shimmer border border-zinc-300 bg-white font-medium text-zinc-900 shadow-[0_6px_24px_rgba(255,255,255,0.18)_inset,0_10px_30px_rgba(0,0,0,0.04)] backdrop-blur-3xl hover:border-[#FF6B35]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:ring-offset-2`;

  const freeToolsButton =
    `${headerButton} bg-black font-semibold text-white shadow-[0_14px_34px_rgba(0,0,0,0.18)] hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:ring-offset-2`;

  const trialButton =
    `${headerButton} bg-[#FF6B35] font-semibold text-white shadow-[0_14px_34px_rgba(255,107,53,0.22)] hover:bg-[#e85d2b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:ring-offset-2`;

  const menuButton =
    "pill-shimmer inline-flex h-12 w-12 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-900 shadow-[0_8px_22px_rgba(15,23,42,0.08)] transition-colors duration-200 hover:border-[#FF6B35]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:ring-offset-2";

  return (
    <header className="sticky top-0 z-50 border-b border-white/60 bg-white/72 shadow-[0_8px_30px_rgba(255,255,255,0.25)_inset,0_12px_40px_rgba(0,0,0,0.05)] backdrop-blur-[24px]">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
        <a href="/" className="flex items-center gap-3" aria-label="QuoteCore+ home">
          <img src="/MainQCP.png" alt="QuoteCore+" width={160} height={44} loading="eager" decoding="async" className="h-10 w-auto sm:h-11" />
        </a>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 md:flex">
            {backLabel && (
              <a href={backHref} className={contactButton}>
                {backLabel}
              </a>
            )}
            <a
              href="/free-tools"
              target="_blank"
              rel="noopener noreferrer"
              className={freeToolsButton}
              onClick={() => trackEvent("free_tools_click", { location: "nav" })}
            >
              Free Tools
            </a>
            <a
              href="/free-trial"
              className={trialButton}
              onClick={() => trackEvent("free_trial_click", { location: "nav" })}
            >
              Start free trial
            </a>
          </div>

          <button
            type="button"
            className={menuButton}
            onClick={() => setMenuOpen((p) => !p)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="bg-white shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
          <div className="mx-auto max-w-7xl px-6 pb-4 pt-5 lg:px-8">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Navigate</p>
            <div className="flex flex-col">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="flex items-center justify-between border-b border-zinc-100 py-3.5 text-base font-medium text-zinc-800 transition-colors hover:text-[#FF6B35]"
                  onClick={() => setMenuOpen(false)}
                  {...("external" in item && item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {item.label}
                  {"external" in item && item.external ? (
                    <svg className="h-4 w-4 text-zinc-300" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                      <path d="M11 3h6v6M17 3l-7 7M14 11v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1h6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 text-zinc-300" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </a>
              ))}
            </div>
          </div>
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 pb-6 pt-2 sm:flex-row lg:px-8">
            <a
              href="/free-trial"
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-[#FF6B35] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#e85d2b]"
              onClick={() => { trackEvent("free_trial_click", { location: "nav-menu" }); setMenuOpen(false); }}
            >
              Start free trial
            </a>
            <a
              href="/contact"
              className="pill-shimmer inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-900 transition-colors duration-200 hover:border-[#FF6B35]/40"
              onClick={() => { trackEvent("contact_click", { location: "nav-menu" }); setMenuOpen(false); }}
            >
              Contact us
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
