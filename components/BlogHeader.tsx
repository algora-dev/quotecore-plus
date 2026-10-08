"use client";

import { useEffect, useId, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { appUrl } from "@/lib/app-url";
import SocialIcons from "./SocialIcons";
import { MarketingButton } from "./marketing/MarketingButton";
import styles from "./BlogHeader.module.css";

function buildNavItems() {
  return [
    { label: "Features", href: "/features" },
    { label: "Roofing Software", href: "/roofing-quoting-software" },
    { label: "Suppliers", href: "/suppliers" },
    { label: "Pricing", href: "/pricing" },
    { label: "Free Tools", href: "/free-tools" },
    { label: "Blog", href: "/blog" },
    { label: "Tutorials", href: "/tutorials" },
    { label: "Contact us", href: "/contact" },
  ];
}

const plusIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export default function BlogHeader({ backLabel, backHref = "/" }: { backLabel?: string; backHref?: string }) {
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [appLink, setAppLink] = useState("https://app.quote-core.com");
  const navItems = buildNavItems();

  useEffect(() => {
    setAppLink(appUrl());
  }, []);

  useEffect(() => {
    let frame = 0;
    const syncScroll = () => {
      frame = 0;
      setScrolled(window.scrollY > 18);
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(syncScroll);
    };
    syncScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const trackDemo = (location: string) => trackEvent("demo_tool_click", { location, mode: "takeoff" });

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ""}`}>
      <div className={styles.inner}>
        <a href="/" className={styles.logoLink} aria-label="QuoteCore+ home">
          <img
            src="/logo.png"
            alt="QuoteCore+"
            width={189}
            height={44}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className={styles.logo}
          />
        </a>

        <div className={styles.actions}>
          <div className={styles.desktopActions}>
            {backLabel ? (
              <a href={backHref} className={styles.backLink}>
                ← {backLabel}
              </a>
            ) : null}
            <a
              href={appLink || "/login"}
              className={styles.signIn}
              onClick={() => trackEvent("app_click", { location: "nav" })}
            >
              Sign in
            </a>
            <span className={styles.divider} aria-hidden="true" />
            <MarketingButton
              href="/takeoff-demo"
              variant="primary"
              size="large"
              icon={plusIcon}
              onClick={() => trackDemo("nav")}
            >
              Try the demo
            </MarketingButton>
          </div>

          <MarketingButton
            href="/takeoff-demo"
            variant="primary"
            className={styles.mobileDemo}
            icon={plusIcon}
            onClick={() => trackDemo("nav-mobile")}
            ariaLabel="Try the QuoteCore+ interactive demo"
          >
            <span data-long-label>Try the demo</span>
            <span data-short-label>Demo</span>
          </MarketingButton>

          <button
            type="button"
            className={styles.menuButton}
            onClick={() => setMenuOpen((previous) => !previous)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls={menuId}
          >
            {menuOpen ? (
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div id={menuId} className={styles.menuPanel}>
          <div className={styles.menuInner}>
            <div className={styles.mobileMenuActions}>
              <MarketingButton
                href={appLink || "/login"}
                variant="glass"
                onClick={() => {
                  trackEvent("app_click", { location: "nav-menu" });
                  setMenuOpen(false);
                }}
              >
                Sign in
              </MarketingButton>
              <MarketingButton
                href="/takeoff-demo"
                variant="primary"
                icon={plusIcon}
                onClick={() => {
                  trackDemo("nav-menu");
                  setMenuOpen(false);
                }}
              >
                Try the demo
              </MarketingButton>
            </div>

            <p className={styles.menuLabel}>Explore QuoteCore+</p>
            <nav className={styles.navList} aria-label="Marketing navigation">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className={styles.navItem}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </a>
              ))}
            </nav>

            <div className={styles.menuFooter}>
              <SocialIcons className="justify-start" />
              <a
                href="https://www.quote-core.co.nz"
                className={styles.countryLink}
                onClick={() => setMenuOpen(false)}
              >
                Switch to New Zealand
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
