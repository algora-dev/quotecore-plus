"use client";

import { useState } from "react";

/**
 * Hero video showcase — its own section below the Three Engines cards.
 * YouTube embed behind a styled play-button facade: user-initiated playback,
 * views count on the @quotecoreplus channel, and no 18.5MB local file in the
 * page weight.
 */

const VIDEO_ID = "fObCC5bL4Dg";

export default function VideoShowcase() {
  const [playing, setPlaying] = useState(false);

  const startPlayback = () => {
    setPlaying(true);
  };

  return (
    <section className="border-y border-zinc-100 bg-zinc-50/60" aria-label="QuoteCore+ product video">
      <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
        <h2 className="mx-auto max-w-3xl text-center text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
          Measuring and quoting costing your business?
        </h2>

        <div className="relative mx-auto mt-8 aspect-video w-full overflow-hidden rounded-2xl border border-zinc-200 bg-black shadow-sm">
          {playing ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0`}
              title="QuoteCore+ — see how it works"
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <button
              type="button"
              onClick={startPlayback}
              className="group absolute inset-0 flex items-center justify-center focus-visible:outline-none"
              aria-label="Play video"
            >
              <img
                src={`https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover opacity-70 transition-opacity duration-200 group-hover:opacity-85"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/60"
              />
              <span className="relative flex flex-col items-center gap-4">
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#FF6B35] text-white shadow-[0_8px_32px_rgba(255,107,53,0.55),0_0_0_10px_rgba(255,107,53,0.15)] transition-all duration-200 group-hover:scale-105 group-hover:shadow-[0_10px_40px_rgba(255,107,53,0.65),0_0_0_12px_rgba(255,107,53,0.18)] sm:h-24 sm:w-24">
                  <svg viewBox="0 0 24 24" className="ml-1 h-9 w-9 sm:h-10 sm:w-10" fill="currentColor" aria-hidden="true">
                    <polygon points="6 4 20 12 6 20 6 4" />
                  </svg>
                </span>
                <span className="text-sm font-semibold text-white/90">Watch how it works</span>
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
