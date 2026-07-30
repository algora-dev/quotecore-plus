"use client";

import { useState, useCallback } from "react";

interface YouTubeLiteProps {
  videoId: string;
  title: string;
  /** Optional start time in seconds */
  start?: number;
  /** Optional custom thumbnail. Defaults to YouTube's maxres */
  thumbnail?: string;
  /** aspect ratio class, defaults to 16/9 */
  className?: string;
  /** Whether to show the title overlay at the bottom */
  showTitle?: boolean;
  /** Rounded corners style - matches the existing video containers */
  rounded?: boolean;
}

/**
 * SEO-friendly YouTube embed using the "lite facade" pattern:
 * - Shows a thumbnail image (fast, no JS from YouTube)
 * - On click, loads the full YouTube iframe via youtube-nocookie.com
 * - Zero YouTube JS on initial page load = better Core Web Vitals
 * - Use alongside VideoObject JSON-LD schema (add separately in page layout)
 */
export default function YouTubeLite({
  videoId,
  title,
  start,
  thumbnail,
  className = "",
  showTitle = false,
  rounded = true,
}: YouTubeLiteProps) {
  const [activated, setActivated] = useState(false);
  const [imgError, setImgError] = useState(false);

  const handleClick = useCallback(() => {
    setActivated(true);
  }, []);

  // YouTube thumbnail URLs - try maxres, fall back to hq
  const thumbSrc = thumbnail || (imgError
    ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    : `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`);

  const embedUrl = start
    ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&start=${start}&rel=0`
    : `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;

  const containerClass = `relative overflow-hidden bg-black ${rounded ? "rounded-[2rem] border border-zinc-200" : ""} shadow-[0_30px_120px_rgba(0,0,0,0.15)] ${className}`;
  const aspectClass = "block w-full aspect-video";

  if (activated) {
    return (
      <div className={containerClass} style={{ aspectRatio: "16 / 9" }}>
        <iframe
          src={embedUrl}
          title={title}
          className={aspectClass}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          style={{ border: 0 }}
        />
      </div>
    );
  }

  return (
    <>
    <button
      type="button"
      onClick={handleClick}
      className={`${containerClass} group cursor-pointer ${aspectClass}`}
      style={{ aspectRatio: "16 / 9" }}
      aria-label={`Play: ${title}`}
      itemScope
      itemType="https://schema.org/VideoObject"
    >
      {/* Thumbnail */}
      <img
        src={thumbSrc}
        alt={title}
        className="block w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        loading="lazy"
        onError={() => setImgError(true)}
      />
      {/* Hidden metadata for crawlers (visible in DOM, not visually) */}
      <meta itemProp="name" content={title} />
      <meta itemProp="thumbnailUrl" content={thumbSrc} />
      <meta itemProp="embedUrl" content={`https://www.youtube-nocookie.com/embed/${videoId}`} />
      <meta itemProp="contentUrl" content={`https://www.youtube.com/watch?v=${videoId}`} />
      <meta itemProp="uploadDate" content="2026-07-28" />
      {/* Dark gradient overlay for contrast */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
      {/* Play button */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/30 bg-black/40 backdrop-blur-md transition-all duration-300 group-hover:scale-110 group-hover:bg-[#FF6B35] group-hover:border-[#FF6B35]">
          <svg viewBox="0 0 24 24" className="h-7 w-7 fill-white" aria-hidden="true">
            <path d="M8 5.14v13.72c0 .78.84 1.26 1.5.86l10-6.86a1 1 0 000-1.72l-10-6.86A1 1 0 008 5.14z" />
          </svg>
        </div>
      </div>
      {/* Optional title overlay */}
      {showTitle && (
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="text-sm font-semibold text-white">{title}</p>
        </div>
      )}
    </button>
    <noscript>
      <a
        href={`https://www.youtube.com/watch?v=${videoId}`}
        className="sr-only"
        aria-label={`Watch: ${title}`}
      >
        Watch: {title} on YouTube
      </a>
    </noscript>
    </>
  );
}
