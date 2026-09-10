"use client";

import { useState } from "react";

type LazyYouTubeProps = {
  videoId: string;
  title: string;
  durationNote?: string;
  className?: string;
};

/**
 * Lazy-loaded YouTube facade: renders thumbnail + play button,
 * swaps in the iframe only on click to protect Core Web Vitals.
 */
export default function LazyYouTube({ videoId, title, durationNote, className = "" }: LazyYouTubeProps) {
  const [active, setActive] = useState(false);
  const thumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  if (active) {
    return (
      <div className={`relative w-full overflow-hidden rounded-2xl bg-black shadow-lg ${className}`} style={{ aspectRatio: "16 / 9" }}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setActive(true)}
      aria-label={`Play video: ${title}${durationNote ? ` (${durationNote})` : ""}`}
      className={`group relative block w-full cursor-pointer overflow-hidden rounded-2xl bg-black shadow-lg transition-transform duration-200 hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${className}`}
      style={{ aspectRatio: "16 / 9" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumb}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" aria-hidden="true" />
      <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#FF6B35] text-white shadow-xl transition-transform duration-200 group-hover:scale-110" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-7 w-7"><path d="M8 5v14l11-7z" /></svg>
      </span>
      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-left">
        <span className="text-sm font-semibold leading-snug text-white drop-shadow">{title}</span>
        {durationNote && (
          <span className="shrink-0 rounded-full bg-black/70 px-2.5 py-1 text-xs font-medium text-white">{durationNote}</span>
        )}
      </span>
    </button>
  );
}
