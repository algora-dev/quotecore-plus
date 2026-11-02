"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MarketingButton } from "@/components/marketing/MarketingButton";
import { FreeWorkspaceButton } from "@/components/marketing/FreeWorkspaceButton";
import { workflowCallHref } from "@/lib/booking";
import { shaunCallPromiseShort } from "@/lib/marketing-conversion";

/**
 * SetupHelpModal - homepage conversion modal.
 *
 * Two paths: 25 minutes with Shaun, or a Free Workspace.
 *
 * Trigger: 25s after the visitor lands on the page (lets the intro play
 * and browsing begin). Never during the video: playing the video showcase
 * cancels the pending trigger.
 * Shows once per session; suppressed after close.
 * Homepage only (only rendered from home/page.tsx).
 */

const SESSION_KEY = "qc-setup-modal-shown";
const PAGE_LOAD_DELAY_MS = 25_000;

function trackEvent(event: string, cta?: string) {
  const payload = { event, cta };
  const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
  try {
    w.dataLayer?.push(payload);
    w.gtag?.("event", event, cta ? { cta } : undefined);
  } catch {
    /* analytics not loaded - non-blocking */
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
      /* private mode - non-blocking */
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

    // Path 1: 25s after the visitor lands on the page - no scroll or any
    // other action required.
    timers.push(setTimeout(show, PAGE_LOAD_DELAY_MS));

    // Path 2: visitor started watching the video showcase - cancel pending
    // triggers so the modal never interrupts an active viewer.
    const onVideoPlay = () => {
      timers.forEach(clearTimeout);
      timers.length = 0;
    };
    window.addEventListener("qc:video-play", onVideoPlay);

    return () => {
      window.removeEventListener("qc:video-play", onVideoPlay);
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
      {/* Backdrop - click does NOT close (prevent accidental dismissal) */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
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

          {/* Left - founder photo (desktop) / top (mobile) */}
          <div className="relative h-64 w-full flex-shrink-0 bg-[#fdf6ee] sm:h-auto sm:w-48">
            <img
              src="/shaun-smiling.jpg"
              alt="Shaun, founder of QuoteCore+"
              className="h-full w-full object-cover object-top sm:object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent sm:bg-gradient-to-r sm:from-transparent sm:to-white/10" />
          </div>

          {/* Right - copy + CTAs */}
          <div className="flex flex-1 flex-col p-6 sm:p-8">
            <h2
              id="setup-modal-headline"
              className="text-xl font-semibold leading-tight tracking-tight text-zinc-950 sm:text-2xl"
            >
              Don&apos;t want to set up another piece of software?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">
              <span className="font-semibold text-[#B63D0A]">We get it.</span> Tell Shaun how you work and he can help you decide what would actually make it faster, or create a Free Workspace and explore it yourself.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <MarketingButton href={workflowCallHref} variant="primary" size="large" className="w-full" onClick={() => trackEvent("setup_modal_cta_click", "book_call")}>
                Book 25 minutes with Shaun
              </MarketingButton>
              <FreeWorkspaceButton variant="glass" size="large" className="w-full" onClick={() => trackEvent("setup_modal_cta_click", "free_workspace")}>
                Create my free workspace
              </FreeWorkspaceButton>
            </div>

            <p className="mt-4 text-center text-xs leading-5 text-zinc-500">
              {shaunCallPromiseShort}
            </p>

            <button
              type="button"
              onClick={close}
              className="mx-auto mt-3 rounded-xl border border-zinc-200 px-4 py-1.5 text-xs text-zinc-500 transition-colors hover:border-[#FF6B35] hover:text-[#FF6B35] hover:shadow-[0_0_12px_rgba(255,107,53,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              Close
            </button>
          </div>

          {/* X close button (top right) */}
          <button
            type="button"
            onClick={close}
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white/80 text-zinc-500 shadow-sm transition-all hover:bg-white hover:text-[#FF6B35] hover:shadow-[0_0_16px_rgba(255,107,53,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
