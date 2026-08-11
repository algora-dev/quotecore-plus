"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Full-screen hero video section rendered above the existing homepage.
 *
 * - Autoplays muted + playsinline on load
 * - Plays once (no loop), holds last frame on end
 * - Custom mute/unmute + play/pause controls (QuoteCore orange)
 * - Hides site nav on load; reveals on scroll past threshold (stays revealed)
 * - Transition message section directly below video
 * - Mobile video crop/aspect treatment is deferred — structured for later
 */

const SCROLL_REVEAL_THRESHOLD = 150; // px

export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoEnded, setVideoEnded] = useState(false);
  const [navRevealed, setNavRevealed] = useState(false);

  // Nav reveal on scroll
  useEffect(() => {
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        if (window.scrollY > SCROLL_REVEAL_THRESHOLD && !navRevealed) {
          setNavRevealed(true);
          document.body.classList.add("nav-revealed");
        }
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [navRevealed]);

  // Ensure nav is hidden on mount, reset on unmount
  useEffect(() => {
    document.body.classList.remove("nav-revealed");
    return () => {
      document.body.classList.add("nav-revealed");
    };
  }, []);

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  };

  const togglePlayPause = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setIsPlaying(true);
      setVideoEnded(false);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setVideoEnded(true);
  };

  return (
    <>
      {/* ── Hero video section ── */}
      <section
        className="relative h-screen w-full overflow-hidden bg-black"
        aria-label="QuoteCore+ product video"
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover"
          onEnded={handleEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        >
          <source src="/Main clip for site.mp4" type="video/mp4" />
        </video>

        {/* Subtle gradient overlay for control legibility */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/30"
          aria-hidden="true"
        />

        {/* Custom controls */}
        <div className="absolute bottom-6 right-6 z-10 flex items-center gap-3 sm:bottom-8 sm:right-8">
          <button
            type="button"
            onClick={toggleMute}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FF6B35] text-white shadow-[0_4px_16px_rgba(255,107,53,0.4)] transition-all hover:bg-[#E55A28] hover:shadow-[0_0_20px_rgba(255,107,53,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:ring-offset-2"
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

          <button
            type="button"
            onClick={togglePlayPause}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FF6B35] text-white shadow-[0_4px_16px_rgba(255,107,53,0.4)] transition-all hover:bg-[#E55A28] hover:shadow-[0_0_20px_rgba(255,107,53,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:ring-offset-2"
            aria-label={isPlaying ? "Pause video" : "Play video"}
            aria-pressed={isPlaying}
          >
            {isPlaying ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
              </svg>
            )}
          </button>
        </div>

        {/* Scroll hint */}
        <div
          className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 animate-bounce"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-white/60" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14" />
            <path d="M19 12l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ── Transition message section ── */}
      <section className="bg-white py-20 sm:py-28 lg:py-36">
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
          <div className="space-y-4">
            <p className="text-xl font-semibold text-zinc-900 sm:text-2xl lg:text-3xl">
              Add your components.
            </p>
            <p className="text-xl font-semibold text-zinc-900 sm:text-2xl lg:text-3xl">
              Measure with AI or manually.
            </p>
            <p className="text-xl font-semibold text-zinc-900 sm:text-2xl lg:text-3xl">
              Send the quote to your customer.
            </p>
            <p className="text-xl font-semibold text-[#FF6B35] sm:text-2xl lg:text-3xl">
              Done.
            </p>
          </div>
        </div>
      </section>

      <style>{`
        /* Nav hide/reveal — driven by body.nav-revealed class */
        .hero-nav-transition {
          transform: translateY(-100%);
          opacity: 0;
          pointer-events: none;
          transition: transform 0.5s ease-out, opacity 0.5s ease-out;
        }
        body.nav-revealed .hero-nav-transition {
          transform: translateY(0);
          opacity: 1;
          pointer-events: auto;
        }
      `}</style>
    </>
  );
}
