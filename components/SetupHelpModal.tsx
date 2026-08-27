"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * SetupHelpModal — homepage conversion modal.
 *
 * Two paths: Done-For-You setup help, or free tools (no commitment).
 *
 * Trigger: 10s after the visitor first scrolls, OR 2s after the hero
 * video ends (whichever comes first). Never during the video.
 * Shows once per session; suppressed after close.
 * Homepage only (only rendered from home/page.tsx).
 */

const SESSION_KEY = "qc-setup-modal-shown";
const SCROLL_DELAY_MS = 10_000;
const VIDEO_ENDED_DELAY_MS = 2_000;

function trackEvent(event: string, cta?: string) {
  const payload = { event, cta };
  const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
  try {
    w.dataLayer?.push(payload);
    w.gtag?.("event", event, cta ? { cta } : undefined);
  } catch {
    /* analytics not loaded — non-blocking */
  }
}

export default function SetupHelpModal() {
  const [visible, setVisible] = useState(false);
  const shownRef = useRef(false);

  const show = useCallback(() => {
    if (shownRef.current) return;
    shownRef.current = true;
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* private mode — non-blocking */
    }
    setVisible(true);
    trackEvent("setup_modal_view");
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) {
        shownRef.current = true;
        return;
      }
    } catch {
      /* ignore */
    }

    const timers: ReturnType<typeof setTimeout>[] = [];

    // Path 1: 10s after first scroll
    const onFirstScroll = () => {
      window.removeEventListener("scroll", onFirstScroll);
      timers.push(setTimeout(show, SCROLL_DELAY_MS));
    };
    window.addEventListener("scroll", onFirstScroll, { passive: true });

    // Path 2: 2s after hero video ends (fallback for non-scrollers)
    const onVideoEnded = () => {
      timers.push(setTimeout(show, VIDEO_ENDED_DELAY_MS));
    };
    window.addEventListener("qc:hero-video-ended", onVideoEnded);

    return () => {
      window.removeEventListener("scroll", onFirstScroll);
      window.removeEventListener("qc:hero-video-ended", onVideoEnded);
      timers.forEach(clearTimeout);
    };
  }, [show]);

  const close = useCallback(() => {
    setVisible(false);
    trackEvent("setup_modal_close");
  }, []);

  // Escape to close
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, close]);

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={close}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-modal-headline"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="pointer-events-auto relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_32px_80px_rgba(0,0,0,0.25)] sm:flex-row">

          {/* Left — founder photo (desktop) / top (mobile) */}
          <div className="relative h-36 w-full flex-shrink-0 bg-[#fdf6ee] sm:h-auto sm:w-48">
            <img
              src="/shaun-smiling.jpg"
              alt="Shaun, founder of QuoteCore+"
              className="h-full w-full object-cover object-top sm:object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent sm:bg-gradient-to-r sm:from-transparent sm:to-white/10" />
          </div>

          {/* Right — copy + CTAs */}
          <div className="flex flex-1 flex-col p-6 sm:p-8">
            <h2
              id="setup-modal-headline"
              className="text-xl font-semibold leading-tight tracking-tight text-zinc-950 sm:text-2xl"
            >
              Don&apos;t want to set up another piece of software?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">
              We get it. We can set QuoteCore+ up around the way you already work — or you can test our free tools first, with no commitment.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <a
                href="/done-for-you-setup"
                onClick={() => trackEvent("setup_modal_cta_click", "see_how_it_works")}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-black px-6 py-3.5 text-sm font-semibold text-white transition-shadow hover:shadow-[0_0_20px_rgba(255,107,53,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:ring-offset-2"
              >
                See How It Works
              </a>
              <a
                href="/free-tools"
                onClick={() => trackEvent("setup_modal_cta_click", "try_free_tools")}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#FF6B35] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#E55A28] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:ring-offset-2"
              >
                Try Our Free Tools
              </a>
            </div>

            <p className="mt-4 text-center text-xs text-zinc-400">
              No hard sell. Get help setting it up, or explore the tools yourself first.
            </p>

            <button
              type="button"
              onClick={close}
              className="mx-auto mt-3 rounded-full px-4 py-2 text-sm text-zinc-500 transition-colors hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              No thanks
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
