'use client';

import { useRef, useState, useEffect, type ReactNode } from 'react';

interface ScrollIndicatorProps {
  children: ReactNode;
  className?: string;
}

/**
 * Horizontal scroll container with a persistent orange indicator bar.
 *
 * Native -webkit-scrollbar styling doesn't reliably show on iOS Safari,
 * so we render a custom indicator bar below the scrollable content.
 *
 * The bar is always visible: faint orange at idle, brighter when scrolling.
 */
export function ScrollIndicator({ children, className = '' }: ScrollIndicatorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(0);
  const [thumbWidth, setThumbWidth] = useState(30);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      const maxScroll = scrollWidth - clientWidth;
      if (maxScroll <= 0) {
        setRatio(0);
        return;
      }
      setRatio(scrollLeft / maxScroll);

      // Thumb width proportional to visible vs total content
      const visibleRatio = clientWidth / scrollWidth;
      const thumbPct = Math.max(visibleRatio * 100, 15); // min 15% so it's always visible
      setThumbWidth(thumbPct);
    };

    const handleScroll = () => {
      update();
      setIsScrolling(true);
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      scrollTimeout.current = setTimeout(() => setIsScrolling(false), 800);
    };

    update();
    el.addEventListener('scroll', handleScroll, { passive: true });

    // Re-measure on resize
    const ro = new ResizeObserver(update);
    ro.observe(el);

    return () => {
      el.removeEventListener('scroll', handleScroll);
      ro.disconnect();
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, []);

  const showBar = ratio > 0 || thumbWidth < 100;

  return (
    <div className={className}>
      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-hide"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </div>
      {/* Custom indicator bar — always visible when content overflows */}
      {showBar && (
        <div className="relative h-1.5 mt-0.5 mx-4 md:mx-0 rounded-full bg-slate-100/60">
          <div
            className="absolute h-full rounded-full transition-all duration-150"
            style={{
              width: `${thumbWidth}%`,
              left: `${ratio * (100 - thumbWidth)}%`,
              backgroundColor: isScrolling
                ? 'rgba(255, 107, 53, 0.8)'
                : 'rgba(255, 107, 53, 0.35)',
            }}
          />
        </div>
      )}
    </div>
  );
}
