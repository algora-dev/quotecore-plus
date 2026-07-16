"use client";

import { useEffect, useState } from "react";

export default function CoffeePopup() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 15000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setVisible(false);
    setDismissed(true);
  };

  if (!visible || dismissed) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Popup */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto relative flex w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-[0_32px_80px_rgba(0,0,0,0.2)]">

          {/* Left - content */}
          <div className="flex flex-1 flex-col justify-between p-7 sm:p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF6B35]">Limited offer</p>
              <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-zinc-950 sm:text-3xl">
                See how much time <span className="brand-wordmark">QuoteCore<span className="brand-plus">+</span></span> could save your business.
              </h2>
              <div className="mt-2 h-0.5 w-16 rounded-full bg-[#FF6B35]" />

              <div className="mt-5 space-y-3 text-sm leading-relaxed text-zinc-600">
                <p className="font-semibold text-zinc-950">Book a free 15-minute call with Shaun.</p>
                <p>
                  He&apos;ll show you how QuoteCore+ could work for your specific business, or if you&apos;d rather leave the quoting to us, explain how our end-to-end estimating service can help you save time and get on with the work!
                </p>
                <p>
                  If you&apos;re not happy with the result... <span className="font-semibold text-[#FF6B35]">Get a free coffee on us! ☕️</span>
                </p>
              </div>
            </div>

            <div className="mt-7">
              <a
                href="https://calendly.com/quote-core-info/15-minute-meeting"
                target="_blank"
                rel="noopener noreferrer"
                onClick={dismiss}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#FF6B35] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#E55A28]"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                Book my 15-minute call
              </a>
              <p className="mt-3 text-center text-xs leading-relaxed text-zinc-400">
                ✓ No sales pressure • ✓ 15 minutes • ✓ One coffee voucher per business{" "}
                <a href="https://quote-core.com/coffee-terms" target="_blank" rel="noopener noreferrer" className="text-[#FF6B35] hover:underline">
                  T&amp;Cs apply.
                </a>
              </p>
            </div>
          </div>

          {/* Right - Shaun photo */}
          <div className="relative hidden sm:block w-56 flex-shrink-0 bg-[#fdf6ee]">
            <img
              src="/shaun-smiling.jpg"
              alt=""
              className="h-full w-full object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#fdf6ee]/40 to-transparent" />
          </div>

          {/* Close */}
          <button
            type="button"
            onClick={dismiss}
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-zinc-500 shadow-sm transition-colors hover:bg-white"
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
