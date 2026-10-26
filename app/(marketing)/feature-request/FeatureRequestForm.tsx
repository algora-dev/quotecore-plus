"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createClient } from "@/app/lib/supabase/client";
import { workflowCallHref } from "@/lib/booking";
import buttonStyles from "@/components/marketing/MarketingButton.module.css";

/**
 * /feature-request ad landing form (2026-10-23, dark theme + $109 offer).
 * Two questions, no visible email field (keeps the Facebook ad frame
 * friction-free). Email is captured in a modal after submit: typed manually
 * or via Continue with Google (Supabase OAuth, email only). The answers are
 * stashed in sessionStorage before the Google redirect so the submission
 * completes automatically when the visitor lands back on this page.
 */

const PENDING_KEY = "qcp-fe…ding";
const PENDING_TTL_MS = 30 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = "form" | "modal" | "completing" | "done";

type Pending = { currentSoftware: string; wish: string; savedAt: number };

function readPending(): Pending | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Pending;
    if (typeof parsed.currentSoftware !== "string" || typeof parsed.wish !== "string") return null;
    if (Date.now() - (parsed.savedAt || 0) > PENDING_TTL_MS) {
      window.sessionStorage.removeItem(PENDING_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function clearPending() {
  try {
    window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* private mode: nothing stashed, nothing to clear */
  }
}

const inputClasses =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-[#FF6B35] focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/25 transition-colors";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

export function FeatureRequestForm() {
  const [step, setStep] = useState<Step>("form");
  const [currentSoftware, setCurrentSoftware] = useState("");
  const [wish, setWish] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const submittedViaGoogle = useRef(false);

  // Google return path: answers were stashed before the OAuth redirect.
  // Complete the submission as soon as a session (email) is available.
  useEffect(() => {
    const pending = readPending();
    if (!pending) return;
    let cancelled = false;
    setStep("completing");

    const complete = async (sessionEmail: string) => {
      if (submittedViaGoogle.current || cancelled) return;
      submittedViaGoogle.current = true;
      try {
        const res = await fetch("/api/feature-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentSoftware: pending.currentSoftware,
            wish: pending.wish,
            email: sessionEmail,
            emailSource: "google",
          }),
        });
        if (!res.ok) throw new Error("send failed");
        clearPending();
        if (!cancelled) setStep("done");
      } catch {
        submittedViaGoogle.current = false;
        if (!cancelled) {
          setStep("form");
          setCurrentSoftware(pending.currentSoftware);
          setWish(pending.wish);
          setFormError("Something went wrong sending your answers. Please try again.");
        }
      }
    };

    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (user?.email && !cancelled) complete(user.email);
      })
      .catch(() => {});

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email && !cancelled) complete(session.user.email);
    });

    // Returned without signing in (cancelled at Google): restore the form so
    // nothing they typed is lost and they can retry or type an email instead.
    const fallback = window.setTimeout(() => {
      if (!cancelled && !submittedViaGoogle.current && readPending()) {
        clearPending();
        setStep("form");
        setCurrentSoftware(pending.currentSoftware);
        setWish(pending.wish);
      }
    }, 4000);

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      window.clearTimeout(fallback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Modal: Escape closes back to the form.
  useEffect(() => {
    if (step !== "modal") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStep("form");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentSoftware.trim() || !wish.trim()) {
      setFormError("Please answer both questions so we can send your free subscription.");
      return;
    }
    setFormError(null);
    setModalError(null);
    setStep("modal");
  }

  async function sendWithEmail() {
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setModalError("That email doesn't look right. Check it, or continue with Google.");
      return;
    }
    setSending(true);
    setModalError(null);
    try {
      const res = await fetch("/api/feature-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentSoftware, wish, email: trimmed, emailSource: "manual" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to send");
      setStep("done");
    } catch (err) {
      setModalError(err instanceof Error && err.message !== "Failed to send" ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const startGoogle = useCallback(async () => {
    setGoogleLoading(true);
    try {
      window.sessionStorage.setItem(
        PENDING_KEY,
        JSON.stringify({ currentSoftware, wish, savedAt: Date.now() })
      );
    } catch {
      /* sessionStorage unavailable: fall back to blocking Google in dev only */
    }
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/feature-request` },
    });
    if (error) {
      setGoogleLoading(false);
      setModalError("Couldn't start Google sign in. You can enter your email instead.");
    }
    // Success navigates to Google; the loading state stays until then so the
    // button never sits there looking dead during the authorize round trip.
  }, [currentSoftware, wish]);

  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;

  return (
    <>
      {supabaseOrigin && <link rel="preconnect" href={supabaseOrigin} />}
      <link rel="dns-prefetch" href="https://accounts.google.com" />
      <link rel="preconnect" href="https://accounts.google.com" />
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[rgba(13,16,20,0.94)] p-6 shadow-2xl shadow-black/50 backdrop-blur sm:p-8">
      <Image
        src="/MainQCP-light.png"
        alt="QuoteCore+"
        width={163}
        height={40}
        priority
        className="h-10 w-auto sm:h-10"
      />

      {step === "form" && (
        <>
          <h1 className="mt-5 text-[28px] leading-tight text-white sm:text-3xl font-bold tracking-tight">
            Tell us how you estimate/quote currently
          </h1>
          <p className="mt-2 text-[15px] leading-snug font-semibold text-[#FFB36B]">
            Answer the questions below to receive a free $109 QuoteCore+ subscription.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
            <div>
              <label htmlFor="current-software" className="mb-1.5 block text-sm font-semibold text-slate-200">
                How are you currently estimating/quoting?
              </label>
              <input
                id="current-software"
                type="text"
                value={currentSoftware}
                onChange={(e) => setCurrentSoftware(e.target.value)}
                placeholder="e.g. software, spreadsheets, manually, a combination, something else"
                autoComplete="off"
                className={inputClasses}
              />
            </div>

            <div>
              <label htmlFor="wish" className="mb-1.5 block text-sm font-semibold text-slate-200">
                What do you wish was better?
              </label>
              <textarea
                id="wish"
                value={wish}
                onChange={(e) => setWish(e.target.value)}
                placeholder="e.g. faster takeoffs, simpler quotes, material prices that update themselves"
                rows={3}
                className={`${inputClasses} resize-none`}
              />
            </div>

            {formError && (
              <p className="text-sm text-red-400" role="alert">
                {formError}
              </p>
            )}

            <button
              type="submit"
              className={[buttonStyles.button, buttonStyles.primary, buttonStyles.large, "w-full"].join(" ")}
            >
              Send my answers
            </button>
          </form>
        </>
      )}

      {(step === "modal" || step === "completing") && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Enter your email"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && step === "modal") setStep("form");
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[rgba(13,16,20,0.94)] p-6 shadow-2xl shadow-black/50 backdrop-blur sm:p-8">
            {step === "modal" ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-xl font-bold tracking-tight text-white">
                    Where should we send our reply?
                  </h2>
                  <button
                    type="button"
                    onClick={() => setStep("form")}
                    aria-label="Close"
                    className="text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  Enter your email or continue with Google to receive your free subscription and our reply.
                </p>

                <div className="mt-5 space-y-4">
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        sendWithEmail();
                      }
                    }}
                    placeholder="you@example.com"
                    aria-label="Your email"
                    className={inputClasses}
                  />
                  <button
                    type="button"
                    onClick={sendWithEmail}
                    disabled={sending}
                    className={[buttonStyles.button, buttonStyles.primary, "w-full"].join(" ")}
                  >
                    {sending ? "Sending..." : "Send my answers"}
                  </button>

                  <div className="flex items-center gap-3" aria-hidden="true">
                    <span className="h-px flex-1 bg-white/10" />
                    <span className="text-xs font-semibold text-slate-500">or</span>
                    <span className="h-px flex-1 bg-white/10" />
                  </div>

                  <button
                    type="button"
                    onClick={startGoogle}
                    disabled={googleLoading}
                    className="flex w-full min-h-11 items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-70"
                  >
                    {googleLoading ? (
                      <>
                        <svg className="h-4 w-4 animate-spin text-slate-500" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                        </svg>
                        Connecting to Google...
                      </>
                    ) : (
                      <>
                        <GoogleIcon />
                        Continue with Google
                      </>
                    )}
                  </button>

                  {modalError && (
                    <p className="text-sm text-red-400" role="alert">
                      {modalError}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="py-8 text-center">
                <svg className="mx-auto h-8 w-8 animate-spin text-[#FF6B35]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                </svg>
                <p className="mt-4 text-sm font-semibold text-slate-200">Finishing up...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="mt-6">
          <CheckCircleIcon className="h-12 w-12 text-[#FFB36B]" />
          <h1 className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Thanks. We&apos;ve got it.
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Check your email for how to claim your free $109 QuoteCore+ subscription. If what you told us helps
            us improve, there may be extra free months in it for you.
          </p>

          <div className="mt-8 border-t border-white/10 pt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">While you wait</p>
            <p className="mt-1.5 text-sm font-semibold text-slate-200">
              See what QuoteCore+ can do for the way you quote.
            </p>
            <div className="mt-4 space-y-3">
              <a
                href="/done-for-you-setup"
                target="_blank"
                rel="noopener noreferrer"
                className={[buttonStyles.button, buttonStyles.primary, buttonStyles.large, "w-full"].join(" ")}
              >
                Done-for-you setup
              </a>
              <a
                href="/demo"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 hover:border-white/25"
              >
                Try the interactive demo
              </a>
              <a
                href={workflowCallHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 hover:border-white/25"
              >
                Book a free 20-minute call
              </a>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <a
                href="/pricing"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-slate-300 underline underline-offset-4 transition-colors hover:text-white"
              >
                See pricing and build your own setup
              </a>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
