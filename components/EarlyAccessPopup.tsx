"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getAttribution } from "@/components/AttributionTracker";
import { trackEvent } from "@/lib/analytics";

interface Props {
  forceOpen?: boolean;
  onClose?: () => void;
}

export default function EarlyAccessPopup({ forceOpen, onClose }: Props = {}) {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (forceOpen) return;
    if (sessionStorage.getItem("earlyAccessDismissed")) return;
    const timer = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(timer);
  }, [forceOpen]);

  const dismiss = () => {
    if (onClose) {
      onClose();
      return;
    }
    sessionStorage.setItem("earlyAccessDismissed", "1");
    setVisible(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    setErrorMsg("");

    if (!supabase) {
      setStatus("error");
      setErrorMsg("Service unavailable. Please try again later.");
      return;
    }

    const attribution = getAttribution() || {};
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          form_type: "early_access",
          current_page_at_signup: window.location.pathname + window.location.search,
          ...attribution,
        }),
      });
    } catch {
      // Fall back to the direct Supabase insert below.
    }

    const { error } = await supabase
      .from("early_access")
      .insert([{ email: email.toLowerCase().trim() }]);

    if (error) {
      if (error.code === "23505") {
        setStatus("success");
        trackEvent("signup_complete", { form_type: "early_access", duplicate: 1 });
      } else {
        setStatus("error");
        setErrorMsg("Something went wrong. Please try again.");
      }
    } else {
      setStatus("success");
      trackEvent("signup_complete", { form_type: "early_access" });
    }
  };

  if (!forceOpen && !visible) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={dismiss}
      />

      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-[1.75rem] bg-white shadow-[0_40px_140px_rgba(0,0,0,0.34)] md:grid-cols-[0.85fr_1.25fr]">
        <div className="relative hidden min-h-[410px] overflow-hidden bg-[radial-gradient(circle_at_85%_24%,rgba(255,255,255,0.18),transparent_28%),linear-gradient(160deg,#ff965a_0%,#ff6b35_45%,#ff4f25_100%)] px-8 py-7 text-white md:flex md:flex-col">
          <div className="flex items-center">
            <img
              src="/MainQCP.png"
              alt="QuoteCore+"
              className="h-10 w-auto brightness-0 invert"
            />
          </div>

          <div className="mt-6 flex flex-1 items-center justify-center">
            <img
              src="/qc-popup-laptop.png"
              alt="QuoteCore+ laptop preview"
              className="w-[112%] max-w-none object-contain drop-shadow-[0_28px_55px_rgba(97,27,7,0.35)] transition-transform duration-500 ease-out hover:-translate-y-2 hover:scale-[1.03]"
            />
          </div>

          <div className="mt-auto flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20">
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M10 2.5l1.6 4.3 4.3 1.6-4.3 1.6L10 14.3 8.4 10 4.1 8.4l4.3-1.6L10 2.5z" />
                <path d="M15.2 12.7l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9z" />
              </svg>
            </span>
            <p className="max-w-64 text-sm font-semibold leading-snug">
              Built to help modern teams quote smarter and win more.
            </p>
          </div>
        </div>

        <div className="px-6 py-8 sm:px-10 md:px-12 md:py-9">
          {status === "success" ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FF6B35]/10 text-[#FF6B35]">
                <svg className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.25 7.25a1 1 0 01-1.414 0L3.296 9.216a1.004 1.004 0 011.42-1.42l4.03 4.03 6.54-6.536a1 1 0 011.418 0z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="mt-5 text-2xl font-semibold text-zinc-950">You're on the list!</p>
              <p className="mt-3 max-w-md text-base leading-7 text-zinc-500">
                We'll email you the moment QuoteCore+ goes live.
              </p>
              <button
                type="button"
                onClick={dismiss}
                className="mt-8 inline-flex items-center justify-center rounded-full bg-[#FF6B35] px-10 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#e85d2b]"
              >
                Got it
              </button>
            </div>
          ) : (
            <>
              <span className="inline-flex rounded-full bg-[#FF6B35]/10 px-5 py-2 text-xs font-bold uppercase tracking-[0.22em] text-[#FF6B35]">
                Coming soon
              </span>

              <h2 className="mt-5 text-4xl font-bold leading-[1.08] tracking-tight text-zinc-950 sm:text-5xl">
                <span className="text-[#FF6B35]">QuoteCore+</span>
                <br />
                launching in July.
              </h2>

              <div className="mt-5 h-0.5 w-8 bg-[#FF6B35]" />

              <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-700">
                Be first in. We'll let you know as soon as QuoteCore+ is ready.
              </p>

              <form onSubmit={handleSubmit} className="mt-6">
                <div className="relative">
                  <svg className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M3.5 5.5h13v9h-13v-9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                    <path d="M4 6l6 4.6L16 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Your email address"
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-14 py-4 text-base text-zinc-950 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-[#FF6B35] focus:ring-4 focus:ring-[#FF6B35]/10"
                  />
                </div>
                {errorMsg && (
                  <p className="mt-2 text-sm text-red-500">{errorMsg}</p>
                )}
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="mt-4 inline-flex w-full items-center justify-center gap-3 rounded-full bg-[#FF6B35] px-6 py-4 text-base font-semibold text-white shadow-[0_18px_40px_rgba(255,107,53,0.25)] transition-colors hover:bg-[#e85d2b] disabled:opacity-60"
                >
                  {status === "loading" ? "Saving..." : "Get notified when we go live!"}
                </button>
              </form>

              <p className="mt-4 flex items-center justify-center gap-2 text-sm text-zinc-400">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M6 8V6a4 4 0 118 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M5 8.5h10v8H5v-8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
                No spam. Unsubscribe anytime.
              </p>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50"
          aria-label="Close"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}
