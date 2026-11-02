"use client";

import { useState } from "react";
import { FreeToolsAuthButton } from "./FreeToolsAuthButton";
import { trackEvent } from "@/lib/analytics";
import { MarketingButton } from "@/components/marketing/MarketingButton";
import { FreeWorkspaceButton } from "@/components/marketing/FreeWorkspaceButton";
import { workflowCallHref } from "@/lib/booking";
import { shaunCallLabelShort } from "@/lib/marketing-conversion";

const navItems = [
  { label: "Home", href: "/" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Services", href: "/services" },
  { label: "Pricing", href: "/pricing" },
  { label: "Blog", href: "/blog" },
];

/**
 * Header for free tools pages on quote-core.com.
 * Uses the website's nav style + adds FreeToolsAuthButton.
 * 
 * Easy to revert to standalone header: just replace this component
 * with a simple header containing only the logo + FreeToolsAuthButton.
 */
export default function FreeToolsHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  const menuButton =
    "pill-shimmer inline-flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-300 bg-white text-zinc-900 shadow-[0_8px_22px_rgba(15,23,42,0.08)] transition-colors duration-200 hover:border-[#FF6B35]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B63D0A] focus-visible:ring-offset-2";

  return (
    <>
    <header className="sticky top-0 z-50 border-b border-white/60 bg-white/72 shadow-[0_8px_30px_rgba(255,255,255,0.25)_inset,0_12px_40px_rgba(0,0,0,0.05)] backdrop-blur-[24px]">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
        <a href="/" className="flex items-center gap-3" aria-label="QuoteCore+ home">
          <img src="/MainQCP.png" alt="QuoteCore+" className="h-10 w-auto sm:h-11" />
        </a>

        <div className="flex items-center gap-3">
          {/* Free-tools account utility; commercial CTAs sit beside it. */}
          <FreeToolsAuthButton />

          <div className="hidden items-center gap-2 lg:flex">
            <MarketingButton
              href={workflowCallHref}
              variant="primary"
              onClick={() => trackEvent("workflow_call_click", { location: "free-tools-nav" })}
            >
              {shaunCallLabelShort}
            </MarketingButton>
            <FreeWorkspaceButton
              variant="glass"
              className="hidden xl:inline-flex"
              onClick={() => trackEvent("free_workspace_click", { location: "free-tools-nav" })}
            >
              Free Workspace
            </FreeWorkspaceButton>
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
                  className="flex items-center justify-between border-b border-zinc-100 py-3.5 text-base font-medium text-zinc-800 transition-colors hover:text-[#BD4A1A]"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                  <svg className="h-4 w-4 text-zinc-300" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
          <div className="mx-auto grid max-w-7xl gap-3 px-6 pb-6 pt-2 sm:grid-cols-2 lg:px-8">
            <MarketingButton
              href={workflowCallHref}
              variant="primary"
              className="w-full"
              onClick={() => { trackEvent("workflow_call_click", { location: "free-tools-nav-menu" }); setMenuOpen(false); }}
            >
              {shaunCallLabelShort}
            </MarketingButton>
            <FreeWorkspaceButton
              variant="glass"
              className="w-full"
              onClick={() => { trackEvent("free_workspace_click", { location: "free-tools-nav-menu" }); setMenuOpen(false); }}
            >
              Create my Free Workspace
            </FreeWorkspaceButton>
          </div>
        </div>
      )}
    </header>
    </>
  );
}
