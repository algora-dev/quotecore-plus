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
    if (analytics) {
      (window as any).gtag("consent", "update", { analytics_storage: "granted" });
    }
    if (marketing) {
      (window as any).gtag("consent", "update", {
        ad_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "granted",
      });
    }
  }
}

function loadAnalyticsScripts() {
  loadScript(
    "clarity-consent",
    `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","wwl3bv888v");`
  );
}

function loadMarketingScripts() {
  loadScript(
    "linkedin-consent",
    `_linkedin_partner_id="9212018";window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push(_linkedin_partner_id);(function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}var s=document.getElementsByTagName("script")[0];var b=document.createElement("script");b.type="text/javascript";b.async=true;b.src="https://snap.licdn.com/li.lms-analytics/insight.min.js";s.parentNode.insertBefore(b,s);})(window.lintrk);`
  );
  loadScript(
    "meta-pixel-consent",
    `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','1623656135599213');fbq('track','PageView');`
  );
}

export default function CookieConsent() {
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
    if (existing.analytics) loadAnalyticsScripts();
    if (existing.marketing) loadMarketingScripts();
  }, []);

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
    saveConsent(analytics, marketing);
    applyGtagConsent(analytics, marketing);
    if (analytics) loadAnalyticsScripts();
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
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.06)] px-6 py-5">
          <div className="mx-auto max-w-6xl flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-600 max-w-xl">
              We use cookies to keep the site working, understand how people use QuoteCore+, and improve our marketing. You can accept all cookies, reject optional cookies, or manage your choices.{" "}
              <a href="/cookie-policy" className="underline underline-offset-2 hover:text-zinc-900">
                Cookie Policy
              </a>
            </p>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => apply(false, false)}
                className="pill-shimmer rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors duration-200 hover:border-[#FF6B35]/40"
              >
                Reject optional
              </button>
              <button
                type="button"
                onClick={openModal}
                className="pill-shimmer rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors duration-200 hover:border-[#FF6B35]/40"
              >
                Manage choices
              </button>
              <button
                type="button"
                onClick={() => apply(true, true)}
                className="rounded-full bg-[#FF6B35] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#E55A28]"
              >
                Accept all
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pb-4 sm:pb-0"
          onClick={() => setShowModal(false)}
        >
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-semibold text-zinc-950">Cookie preferences</h2>
            <p className="mt-2 text-sm text-zinc-500">
              Manage your cookie preferences below. You can update these at any time.
            </p>

            <div className="mt-6 space-y-3">
              {/* Strictly Necessary */}
              <div className="flex items-start justify-between gap-4 rounded-[1.5rem] border border-zinc-200 bg-zinc-50 px-5 py-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-zinc-950">Strictly necessary</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Required for the website to work properly. These cookies cannot usually be switched off because they are needed for things like security, page loading, account access, form submissions, and remembering your cookie preferences.
                  </p>
                </div>
                <span className="mt-1 shrink-0 rounded-full bg-zinc-200 px-3 py-1 text-xs font-medium text-zinc-500">
                  Always on
                </span>
              </div>

              {/* Analytics */}
              <div className="flex items-start justify-between gap-4 rounded-[1.5rem] border border-zinc-200 bg-zinc-50 px-5 py-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-zinc-950">Analytics cookies</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Helps us understand how visitors use the website so we can improve pages, content, and user experience. May include Google Analytics 4 and Microsoft Clarity.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={analyticsChecked}
                  onClick={() => setAnalyticsChecked((p) => !p)}
                  className={`mt-1 shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:ring-offset-2 ${
                    analyticsChecked ? "bg-[#FF6B35]" : "bg-zinc-300"
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
              <div className="flex items-start justify-between gap-4 rounded-[1.5rem] border border-zinc-200 bg-zinc-50 px-5 py-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-zinc-950">Marketing cookies</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Helps us measure marketing performance and show more relevant ads in future. May include Meta Pixel, LinkedIn Insight Tag, and Google advertising tags if enabled.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={marketingChecked}
                  onClick={() => setMarketingChecked((p) => !p)}
                  className={`mt-1 shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:ring-offset-2 ${
                    marketingChecked ? "bg-[#FF6B35]" : "bg-zinc-300"
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
              <button
                type="button"
                onClick={() => apply(false, false)}
                className="pill-shimmer rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors duration-200 hover:border-[#FF6B35]/40"
              >
                Reject optional
              </button>
              <button
                type="button"
                onClick={() => apply(analyticsChecked, marketingChecked)}
                className="rounded-full bg-[#FF6B35] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#E55A28]"
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
