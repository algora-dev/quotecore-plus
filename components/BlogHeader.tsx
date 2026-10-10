"use client";

import { useEffect, useId, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { appUrl } from "@/lib/app-url";
import SocialIcons from "./SocialIcons";
import { MarketingButton } from "./marketing/MarketingButton";
import styles from "./BlogHeader.module.css";
import controls from "./marketing/MarketingButton.module.css";

function buildNavItems() {
  return [
    { label: "Features", href: "/features" },
    { label: "Pricing", href: "/pricing" },
    { label: "Demo", href: "/demo" },
    { label: "Free Tools", href: "/free-tools" },
    { label: "Blog", href: "/blog" },
    { label: "Contact us", href: "/contact" },
  ];
}

export default function BlogHeader({ backLabel, backHref = "/", theme = "light" }: { backLabel?: string; backHref?: string; theme?: "light" | "dark" }) {
  const menuId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
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
      if (event.key === "Escape") { setMenuOpen(false); menuButtonRef.current?.focus(); }
    };
    const onOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const onFocusOutside = (event: FocusEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("focusin", onFocusOutside);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("focusin", onFocusOutside);
    };
  }, [menuOpen]);

  const trackDemo = (location: string) => trackEvent("demo_tool_click", { location, mode: "takeoff" });

  return (
    <header ref={headerRef} className={`${styles.header} ${theme === "dark" ? styles.dark : ""} ${scrolled ? styles.scrolled : ""}`}>
      <div className={styles.inner}>
        <a href="/" className={styles.logoLink} aria-label="QuoteCore+ home">
          <img
            src={theme === "dark" ? "/marketing/brand/quotecore-logo-light.png" : "/marketing/brand/quotecore-logo-transparent.png"}
            alt="QuoteCore+"
            width={481}
            height={119}
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
            <MarketingButton
              href={appLink || "/login"}
              variant="glass"
              size="large"
              className={styles.signIn}
              onClick={() => trackEvent("app_click", { location: "nav" })}
            >
              Sign in
            </MarketingButton>
            <MarketingButton
              href="/demo"
              variant="primary"
              size="large"
              onClick={() => trackDemo("nav")}
            >
              Demo
            </MarketingButton>
          </div>

          <MarketingButton
            href="/demo"
            variant="primary"
            className={styles.mobileDemo}
            onClick={() => trackDemo("nav-mobile")}
            ariaLabel="Try the QuoteCore+ interactive demo"
          >
            Demo
          </MarketingButton>

          <button
            ref={menuButtonRef}
            type="button"
            className={`${controls.button} ${controls.glass} ${styles.menuButton}`}
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
