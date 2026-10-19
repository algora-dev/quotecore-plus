"use client";

import { useEffect, useState } from "react";
import { getConsent, saveConsent } from "@/lib/consent";

/* eslint-disable @typescript-eslint/no-explicit-any */

function loadScript(id: string, inline: string) {
  if (typeof document === "undefined") return;
  if (document.getElementById(id)) return;
  const s = document.createElement("script");
  s.id = id;
  s.async = true;
  s.innerHTML = inline;
  document.head.appendChild(s);
}

function applyGtagConsent(analytics: boolean, marketing: boolean) {
  if (typeof window !== "undefined" && typeof (window as any).gtag === "function") {
    (window as any).gtag("consent", "update", {
      analytics_storage: analytics ? "granted" : "denied",
      ad_storage: marketing ? "granted" : "denied",
      ad_user_data: marketing ? "granted" : "denied",
      ad_personalization: marketing ? "granted" : "denied",
    });
  }
}

function loadAnalyticsScripts(clarityProjectId: string) {
  if (!/^[a-zA-Z0-9]+$/.test(clarityProjectId)) return;
  loadScript(
    "clarity-consent",
    `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarityProjectId}");`
  );
}

function loadMarketingScripts() {
  loadScript(
    "linkedin-consent",
    `_linkedin_partner_id="9212018";window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push(_linkedin_partner_id);(function(l){if(!l){lintrk=function(a,b){lintrk.q.push([a,b])};lintrk.q=[]}else{window.lintrk=function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}var s=document.getElementsByTagName("script")[0];var b=document.createElement("script");b.type="text/javascript";b.async=true;b.src="https://snap.licdn.com/li.lms-analytics/insight.min.js";s.parentNode.insertBefore(b,s);})(window.lintrk);`
  );
  loadScript(
    "meta-pixel-consent",
    `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','1623656135599213');fbq('track','PageView');`
  );
}

/*
 * Presentation follows the owner-approved dark glass recipe used by the
 * global cookie notice (app/components/CookieBanner.tsx):
 *   card rgba(13,16,20,0.94) + backdrop blur + white/8% border + rounded-2xl,
 *   MarketingButton primary recipe for the main action, #FFB36B accents.
 * Buttons are the 12px-radius/44px standard. Never rounded-full pills.
 */
const primaryBtn =
  "inline-flex min-h-[44px] items-center justify-center rounded-[12px] border border-[#ff641f] bg-[linear-gradient(135deg,#ff641f_0%,#ff8a3d_55%,#ffb36b_100%)] px-4 py-[9px] text-sm font-semibold text-[#191b20] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-[linear-gradient(135deg,#ff6b35_0%,#ff923d_55%,#ffbc7a_100%)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_14px_rgba(255,107,53,0.2)] hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#b63d0a]";

const secondaryBtn =
  "inline-flex min-h-[44px] items-center justify-center rounded-[12px] border border-white/[0.14] bg-white/[0.04] px-4 py-[9px] text-sm font-medium text-[#E8EAEE] transition-all duration-150 hover:border-[#FF6B35]/50 hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#b63d0a]";

const cardRecipe =
  "rounded-2xl border border-white/[0.08] bg-[rgba(13,16,20,0.94)] shadow-[0_20px_56px_rgba(0,0,0,0.4)] backdrop-blur-[12px]";

export default function CookieConsent({ clarityProjectId }: { clarityProjectId: string }) {
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [analyticsChecked, setAnalyticsChecked] = useState(true);
  const [marketingChecked, setMarketingChecked] = useState(true);

  useEffect(() => {
    const existing = getConsent();
    if (!existing) {
      queueMicrotask(() => setShowBanner(true));
      return;
    }
    // Reapply saved consent on every page load
    applyGtagConsent(existing.analytics, existing.marketing);
    if (existing.analytics) loadAnalyticsScripts(clarityProjectId);
    if (existing.marketing) loadMarketingScripts();
  }, [clarityProjectId]);

  useEffect(() => {
    // Allow footer/anywhere to trigger "Manage Cookie Preferences"
    const handler = () => {
      const existing = getConsent();
      setAnalyticsChecked(existing?.analytics ?? true);
      setMarketingChecked(existing?.marketing ?? true);
      setShowModal(true);
      setShowBanner(false);
    };
    window.addEventListener("openCookiePreferences", handler);
    return () => window.removeEventListener("openCookiePreferences", handler);
  }, []);

  function apply(analytics: boolean, marketing: boolean) {
    const previous = getConsent();
    saveConsent(analytics, marketing);
    applyGtagConsent(analytics, marketing);

    // Optional scripts cannot all be reliably unloaded in-place. If a visitor
    // revokes a category that was previously enabled, reload once after saving
    // the new preference so the page restarts without that script category.
    const revokedLoadedCategory = Boolean(
      (previous?.analytics && !analytics) || (previous?.marketing && !marketing)
    );
    if (revokedLoadedCategory) {
      window.location.reload();
      return;
    }

    if (analytics) loadAnalyticsScripts(clarityProjectId);
    if (marketing) loadMarketingScripts();
    setShowBanner(false);
    setShowModal(false);
  }

  function openModal() {
    const existing = getConsent();
    setAnalyticsChecked(existing?.analytics ?? true);
    setMarketingChecked(existing?.marketing ?? true);
    setShowModal(true);
    setShowBanner(false);
  }

  if (!showBanner && !showModal) return null;

  return (
    <>
      {/* Cookie Banner */}
      {showBanner && (
        <div role="region" aria-label="Cookie preferences" className="fixed inset-x-4 bottom-4 z-50">
          <div className={`mx-auto w-full max-w-2xl space-y-3 p-4 sm:p-5 ${cardRecipe}`}>
            <div className="flex items-start gap-3">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#FFB36B]"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 4v5c0 5-3.4 8.5-8 9-4.6-.5-8-4-8-9V7l8-4z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12.5l1.8 1.8 3.7-3.7" />
              </svg>
              <p className="text-sm leading-relaxed text-[#E8EAEE]">
                We use cookies to keep the site working, understand how people use QuoteCore
                <span className="text-[#FF6B35]">+</span>, and improve our marketing. You can accept
                all cookies, reject optional cookies, or manage your choices.{" "}
                <a
                  href="/cookie-policy"
                  className="text-[#FFB36B] underline underline-offset-2 transition-colors duration-150 hover:text-[#FFD9B8]"
                >
                  Cookie Policy
                </a>
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
              <button type="button" onClick={() => apply(false, false)} className={secondaryBtn}>
                Reject optional
              </button>
              <button type="button" onClick={openModal} className={secondaryBtn}>
                Manage choices
              </button>
              <button type="button" onClick={() => apply(true, true)} className={primaryBtn}>
                Accept all
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cookie preferences"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0"
          onClick={() => setShowModal(false)}
        >
          <div
            className={`max-h-[85vh] w-full max-w-lg overflow-y-auto p-6 sm:p-8 ${cardRecipe}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-white">Cookie preferences</h2>
            <p className="mt-2 text-sm text-white/60">
              Manage your cookie preferences below. You can update these at any time.
            </p>

            <div className="mt-6 space-y-3">
              {/* Strictly Necessary */}
              <div className="flex items-start justify-between gap-4 rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">Strictly necessary</p>
                  <p className="mt-1 text-xs text-white/60">
                    Required for the website to work properly. These cookies cannot usually be switched off because they are needed for things like security, page loading, account access, form submissions, and remembering your cookie preferences.
                  </p>
                </div>
                <span className="mt-1 shrink-0 rounded-full bg-[#FFB36B]/10 px-3 py-1 text-xs font-medium text-[#FFB36B]">
                  Always on
                </span>
              </div>

              {/* Analytics */}
              <div className="flex items-start justify-between gap-4 rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">Analytics cookies</p>
                  <p className="mt-1 text-xs text-white/60">
                    Helps us understand how visitors use the website so we can improve pages, content, and user experience. May include Google Analytics 4 and Microsoft Clarity.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={analyticsChecked}
                  aria-label="Analytics cookies"
                  onClick={() => setAnalyticsChecked((p) => !p)}
                  className={`mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1014] ${
                    analyticsChecked ? "bg-[#FF6B35]" : "bg-white/25"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      analyticsChecked ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Marketing */}
              <div className="flex items-start justify-between gap-4 rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">Marketing cookies</p>
                  <p className="mt-1 text-xs text-white/60">
                    Helps us measure marketing performance and show more relevant ads in future. May include Meta Pixel, LinkedIn Insight Tag, and Google advertising tags if enabled.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={marketingChecked}
                  aria-label="Marketing cookies"
                  onClick={() => setMarketingChecked((p) => !p)}
                  className={`mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1014] ${
                    marketingChecked ? "bg-[#FF6B35]" : "bg-white/25"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      marketingChecked ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => apply(false, false)} className={secondaryBtn}>
                Reject optional
              </button>
              <button
                type="button"
                onClick={() => apply(analyticsChecked, marketingChecked)}
                className={primaryBtn}
              >
                Save choices
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
