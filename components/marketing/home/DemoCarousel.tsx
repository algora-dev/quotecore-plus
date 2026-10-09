'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { trackEvent } from '@/lib/analytics';
import { Icon } from './Icon';
import s from './Homepage.module.css';

/** Auto-advancing demo walkthrough. Pauses on hover, focus and touch; swipe and keyboard supported. */
const AUTOPLAY_MS = 2000;
const TOUCH_PAUSE_MS = 8000;
const SWIPE_MIN_PX = 40;

const slides = [
  { src: '/marketing/home/demo/demo-01-workspace.webp', label: 'Demo workspace', caption: 'Land in a real workspace. Jobs ready and waiting.', alt: 'Demo workspace dashboard with prepared roofing jobs ready to open' },
  { src: '/marketing/home/demo/demo-02-takeoff.webp', label: 'Digital takeoff', caption: 'Measure the roof. Digital takeoff on a real plan.', alt: 'Digital takeoff screen with a measured sample roof plan and components' },
  { src: '/marketing/home/demo/demo-03-assistant.webp', label: 'Smart Assistant', caption: 'Ask Smart Assistant. Changes in one line.', alt: 'Smart Assistant panel updating a roof quote from a single line of text' },
  { src: '/marketing/home/demo/demo-04-quote.webp', label: 'Customer quote view', caption: 'Send the quote. A polished page your customer accepts.', alt: 'Customer view of a finished quotation with accept and decline buttons' },
] as const;

export function DemoCarousel() {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const hoverPausedRef = useRef(false);
  const touchPausedUntilRef = useRef(0);
  const swipeStartRef = useRef<number | null>(null);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const id = window.setInterval(() => {
      if (hoverPausedRef.current || Date.now() < touchPausedUntilRef.current) return;
      setIndex(i => (i + 1) % count);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion, count]);

  const go = useCallback((next: number, direction: 'prev' | 'next' | 'dot') => {
    setIndex(((next % count) + count) % count);
    trackEvent('homepage_demo_carousel_interact', { direction });
  }, [count]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => { swipeStartRef.current = e.clientX; };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (start === null) return;
    const dx = e.clientX - start;
    if (Math.abs(dx) >= SWIPE_MIN_PX) go(index + (dx < 0 ? 1 : -1), dx < 0 ? 'next' : 'prev');
    if (e.pointerType === 'touch') touchPausedUntilRef.current = Date.now() + TOUCH_PAUSE_MS;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1, 'next'); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1, 'prev'); }
  };

  const active = slides[index];

  return (
    <div className={s.demoCarousel} role="group" aria-roledescription="carousel" aria-label="A walk through the QuoteCore+ demo"
      tabIndex={0}
      onMouseEnter={() => { hoverPausedRef.current = true; }}
      onMouseLeave={() => { hoverPausedRef.current = false; }}
      onFocusCapture={() => { hoverPausedRef.current = true; }}
      onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hoverPausedRef.current = false; }}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}>
      <div className={s.demoFrame}>
        <div className={s.appChrome} aria-hidden="true">
          <span className={s.windowDots}><i /><i /><i /></span>
          <span>QuoteCore+ <span className={s.chromeSlash}>/</span> {active.label}</span>
          <span className={s.chromeIndicator} />
        </div>
        <div className={s.demoViewport}>
          <div className={s.demoTrack} style={{ transform: `translate3d(-${index * 100}%,0,0)` }}>
            {slides.map((slide, i) => (
              <div className={s.demoSlide} key={slide.src} aria-hidden={i !== index || undefined}>
                <img src={slide.src} width={1280} height={800} alt={i === index ? slide.alt : ''} loading="lazy" decoding="async" draggable={false} />
              </div>
            ))}
          </div>
        </div>
        <p className={s.demoCaption}><span>{active.caption}</span><span className={s.demoCounter} aria-hidden="true">{String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}</span></p>
      </div>
      <button type="button" className={`${s.demoArrow} ${s.demoArrowPrev}`} aria-label="Previous slide" onClick={() => go(index - 1, 'prev')}><Icon name="chevron" size={17} /></button>
      <button type="button" className={`${s.demoArrow} ${s.demoArrowNext}`} aria-label="Next slide" onClick={() => go(index + 1, 'next')}><Icon name="chevron" size={17} /></button>
      <div className={s.demoDots}>
        {slides.map((slide, i) => (
          <button key={slide.src} type="button" aria-label={`Show slide ${i + 1}: ${slide.label}`} aria-current={i === index || undefined}
            className={i === index ? s.demoDotActive : s.demoDot} onClick={() => go(i, 'dot')} />
        ))}
      </div>
    </div>
  );
}
