"use client";

import { useRef, useState } from "react";

/**
 * Hero video showcase — its own section below the Three Engines cards.
 * User-initiated playback: big press-play button, no autoplay. Same
 * max-width container as the cards above it so the layout stays uniform.
 * Fires qc:hero-video-ended on end (SetupHelpModal listens for this).
 */
export default function VideoShowcase() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [ended, setEnded] = useState(false);

  const startPlayback = () => {
    const v = videoRef.current;
    if (!v) return;
    setEnded(false);
    v.muted = false;
    setIsMuted(false);
    v.play().catch(() => {
      // Retry muted if unmuted playback is blocked
      v.muted = true;
      setIsMuted(true);
      v.play().catch(() => undefined);
    });
    setStarted(true);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  };

  const handleEnded = () => {
    setEnded(true);
    window.dispatchEvent(new Event("qc:hero-video-ended"));
  };

  return (
    <section className="border-y border-zinc-100 bg-zinc-50/60" aria-label="QuoteCore+ product video">
      <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
        <h2 className="mx-auto max-w-3xl text-center text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
          Measuring and quoting costing your business?
        </h2>

        <div className="relative mx-auto mt-8 aspect-video w-full overflow-hidden rounded-2xl border border-zinc-200 bg-black shadow-sm">
          <video
            ref={videoRef}
            playsInline
            preload="metadata"
            className="h-full w-full object-contain"
            onEnded={handleEnded}
          >
            <source src="/Main clip for site.mp4" type="video/mp4" />
          </video>

          {/* Gradient + big play overlay before/after playback */}
          {(!started || ended) && (
            <button
              type="button"
              onClick={startPlayback}
              className="group absolute inset-0 flex items-center justify-center bg-gradient-to-b from-black/30 via-black/45 to-black/60 transition-colors hover:from-black/25 hover:via-black/40 hover:to-black/55 focus-visible:outline-none"
              aria-label={ended ? "Replay video" : "Play video"}
            >
              <span className="flex flex-col items-center gap-4">
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#FF6B35] text-white shadow-[0_8px_32px_rgba(255,107,53,0.55),0_0_0_10px_rgba(255,107,53,0.15)] transition-all duration-200 group-hover:scale-105 group-hover:shadow-[0_10px_40px_rgba(255,107,53,0.65),0_0_0_12px_rgba(255,107,53,0.18)] sm:h-24 sm:w-24">
                  <svg viewBox="0 0 24 24" className="ml-1 h-9 w-9 sm:h-10 sm:w-10" fill="currentColor" aria-hidden="true">
                    <polygon points="6 4 20 12 6 20 6 4" />
                  </svg>
                </span>
                <span className="text-sm font-semibold text-white/90">
                  {ended ? "Replay" : "Watch how it works"}
                </span>
              </span>
            </button>
          )}

          {/* Mute toggle once playing */}
          {started && !ended && (
            <button
              type="button"
              onClick={toggleMute}
              className="absolute bottom-5 right-5 flex h-11 w-11 items-center justify-center rounded-full bg-[#FF6B35] text-white shadow-[0_4px_16px_rgba(255,107,53,0.4)] transition-all hover:bg-[#E55A28] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:ring-offset-2"
              aria-label={isMuted ? "Unmute video" : "Mute video"}
              aria-pressed={!isMuted}
            >
              {isMuted ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
