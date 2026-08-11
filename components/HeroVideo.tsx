"use client";

import { useEffect, useRef, useState } from "react";
import BlogHeader from "./BlogHeader";

/**
 * Hero video experience for the homepage.
 *
 * Layout:
 * - BlogHeader (normal, visible) at the very top
 * - Full-screen video directly below the header
 * - Transition message section below the video
 * - Then the existing homepage continues
 *
 * Behaviour:
 * - Header scrolls naturally with the page over the video, then sticks at top-0
 * - Once user scrolls past the video section, it collapses (height 0) so
 *   they can't scroll back up to it. Refresh resets the experience.
 * - Video autoplays muted + playsinline, plays once, holds last frame
 * - Custom mute/unmute + play/pause controls
 */

export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const transitionRef = useRef<HTMLElement>(null);
  const videoSectionRef = useRef<HTMLElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoEnded, setVideoEnded] = useState(false);
  const [videoCollapsed, setVideoCollapsed] = useState(false);

  // Mark body so MarketingHome knows to hide its own BlogHeader
  useEffect(() => {
    document.body.classList.add("hero-video-active");
    return () => {
      document.body.classList.remove("hero-video-active");
    };
  }, []);

  // Collapse video section once user has scrolled past it
  useEffect(() => {
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const section = videoSectionRef.current;
        if (!section || videoCollapsed) {
          ticking = false;
          return;
        }
        const rect = section.getBoundingClientRect();
        // Once the bottom of the video section is above the viewport top,
        // the user has fully scrolled past it — collapse it.
        if (rect.bottom < 0) {
          setVideoCollapsed(true);
        }
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [videoCollapsed]);

  // Slide-in animation for transition text lines
  useEffect(() => {
    const section = transitionRef.current;
    if (!section) return;
    const lines = section.querySelectorAll(".hero-slide-in");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.3, rootMargin: "0px 0px -10% 0px" }
    );
    lines.forEach((line) => observer.observe(line));
    return () => observer.disconnect();
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
      {/* ── Header (normal, visible from start) ── */}
      <BlogHeader />

      {/* ── Hero video section ── */}
      <section
        ref={videoSectionRef}
        className="relative w-full overflow-hidden bg-black transition-[height] duration-500"
        style={{ height: videoCollapsed ? "0" : "100vh" }}
        aria-label="QuoteCore+ product video"
        aria-hidden={videoCollapsed}
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
      <section ref={transitionRef} className="bg-white py-20 sm:py-28 lg:py-36">
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
          <div className="space-y-4">
            <p
              className="hero-slide-in text-xl font-semibold text-zinc-900 sm:text-2xl lg:text-3xl"
              style={{ "--hero-slide-index": 0 } as React.CSSProperties}
            >
              Add your components.
            </p>
            <p
              className="hero-slide-in text-xl font-semibold text-zinc-900 sm:text-2xl lg:text-3xl"
              style={{ "--hero-slide-index": 1 } as React.CSSProperties}
            >
              Measure with AI or manually.
            </p>
            <p
              className="hero-slide-in text-xl font-semibold text-zinc-900 sm:text-2xl lg:text-3xl"
              style={{ "--hero-slide-index": 2 } as React.CSSProperties}
            >
              Send the quote to your customer.
            </p>
            <p
              className="hero-slide-in text-xl font-semibold text-[#FF6B35] sm:text-2xl lg:text-3xl"
              style={{ "--hero-slide-index": 3 } as React.CSSProperties}
            >
              Done.
            </p>
          </div>
        </div>
      </section>

      <style>{`
        /* Hide MarketingHome's duplicate BlogHeader when hero video is active */
        body.hero-video-active .hero-duplicate-header {
          display: none !important;
        }

        /* Transition text — slide in from left on scroll */
        .hero-slide-in {
          opacity: 0;
          transform: translateX(-60px);
          transition: opacity 0.4s ease-out, transform 0.4s ease-out;
          transition-delay: calc(var(--hero-slide-index) * 0.12s);
        }
        .hero-slide-in.is-visible {
          opacity: 1;
          transform: translateX(0);
        }
      `}</style>
    </>
  );
}
