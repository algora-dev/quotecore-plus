'use client';

import { useState, useCallback } from 'react';

interface ImageCarouselProps {
  images: string[];
  alt: string;
}

export function ImageCarousel({ images, alt }: ImageCarouselProps) {
  const [index, setIndex] = useState(0);
  const hasMultiple = images.length > 1;

  const next = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  const prev = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
      {/* Image */}
      <div className="relative aspect-[4/3] bg-slate-50">
        {images.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`${alt} — view ${i + 1}`}
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${
              i === index ? 'opacity-100' : 'opacity-0'
            }`}
            loading={i === 0 ? 'eager' : 'lazy'}
          />
        ))}
      </div>

      {/* Nav arrows */}
      {hasMultiple && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 border border-slate-200 text-slate-600 shadow-sm hover:bg-white hover:text-[#FF6B35] transition-colors"
            aria-label="Previous image"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 border border-slate-200 text-slate-600 shadow-sm hover:bg-white hover:text-[#FF6B35] transition-colors"
            aria-label="Next image"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Dots */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIndex(i); }}
                className={`h-2 rounded-full transition-all ${
                  i === index ? 'w-6 bg-[#FF6B35]' : 'w-2 bg-slate-300 hover:bg-slate-400'
                }`}
                aria-label={`Go to image ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
