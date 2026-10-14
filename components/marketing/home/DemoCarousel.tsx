'use client';
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { trackEvent } from '@/lib/analytics';
import { Icon } from './Icon';
import s from './Homepage.module.css';

const SWIPE_MIN_PX = 40;
const slides = [
  {
    src: '/marketing/home/demo/demo-02-takeoff.webp', width: 1440, height: 792,
    label: 'Measure', headline: 'Measure a roofing job',
    description: 'Explore a sample roof plan and its measurements.',
    alt: 'QuoteCore+ digital takeoff with a sample roof plan, measured areas and roofing components',
  },
  {
    src: '/marketing/home/demo/demo-pricing-components.webp', width: 2048, height: 1125,
    label: 'Price', headline: 'See how the job is priced',
    description: 'Explore the quantities, materials and labour behind a job price.',
    alt: 'Quote builder with the Components tab selected, component quantities, item and labour costs, and the current quote total',
  },
  {
    src: '/marketing/home/demo/demo-03-assistant.webp', width: 1440, height: 792,
    label: 'Ask', headline: 'Tell the app what you need',
    description: 'Ask Smart Assistant to make a change with a typed prompt or voice instruction.',
    alt: 'Smart Assistant alongside the demo workspace, showing a typed instruction and a draft quote',
  },
  {
    src: '/marketing/home/demo/demo-04-quote.webp', width: 1440, height: 792,
    label: 'Quote', headline: 'See the finished customer quote',
    description: 'Explore how the priced job is presented to your customer.',
    alt: 'Customer quotation showing the itemised roofing work, total price and response buttons',
  },
] as const;

/** Manual carousel: labelled pagination, arrows, keyboard and horizontal swipe. */
export function DemoCarousel() {
  const id = useId();
  const [index, setIndex] = useState(0);
  const swipeStart = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const active = slides[index];

  function move(direction: 'prev' | 'next') {
    setIndex(current => (current + (direction === 'next' ? 1 : -1) + slides.length) % slides.length);
    trackEvent('homepage_demo_carousel_interact', { direction });
  }

  function select(next: number) {
    setIndex(next);
    trackEvent('homepage_demo_carousel_interact', { direction: 'dot', slide: slides[next].label });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); move('next'); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); move('prev'); }
    else if (event.key === 'Home') { event.preventDefault(); select(0); }
    else if (event.key === 'End') { event.preventDefault(); select(slides.length - 1); }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) { swipeStart.current = null; return; }
    swipeStart.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 'next' : 'prev');
  }

  return (
    <div className={s.demoCarousel} role="group" aria-roledescription="carousel" aria-label="Explore QuoteCore+" tabIndex={0} onKeyDown={onKeyDown}>
      <div className={s.demoChoices} role="group" aria-label="Choose an outcome">
        {slides.map((slide, i) => (
          <button key={slide.label} type="button" className={s.demoChoice}
            aria-label={`Show ${slide.label.toLowerCase()}: ${slide.headline}`} aria-pressed={i === index} aria-controls={`${id}-slides`} onClick={() => select(i)}>
            <span className={s.demoChoiceNumber} aria-hidden="true">0{i + 1}</span>{slide.label}
          </button>
        ))}
      </div>
      <div className={s.demoFrame}>
        <div className={s.appChrome} aria-hidden="true">
          <span className={s.windowDots}><i /><i /><i /></span>
          <span className={s.demoChromeText}>QuoteCore+ <span className={s.chromeSlash}>/</span> <span className={s.demoChromeLabel}>{active.label}</span></span>
          <span className={s.chromeIndicator} />
        </div>
        <div id={`${id}-slides`} className={s.demoViewport} onPointerDown={onPointerDown} onPointerUp={onPointerUp}
          onPointerCancel={() => { swipeStart.current = null; }} onLostPointerCapture={() => { swipeStart.current = null; }}>
          <div className={s.demoTrack} style={{ transform: `translate3d(-${index * 100}%,0,0)` }}>
            {slides.map((slide, i) => (
              <div className={s.demoSlide} key={slide.src} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${slides.length}: ${slide.label}`} aria-hidden={i !== index || undefined}>
                <img src={slide.src} width={slide.width} height={slide.height} alt={i === index ? slide.alt : ''} loading="lazy" decoding="async" draggable={false} />
              </div>
            ))}
          </div>
        </div>
        <div className={s.demoCaption} aria-live="polite" aria-atomic="true">
          <span className={s.srOnly}>Slide {index + 1} of {slides.length}. </span>
          {slides.map((slide, i) => (
            <div key={slide.label} className={s.demoCaptionItem} aria-hidden={i !== index || undefined}
              style={{ visibility: i === index ? 'visible' : 'hidden' }}>
              <h3>{slide.headline}</h3>
              <p>{slide.description}</p>
            </div>
          ))}
        </div>
        <div className={s.demoToolbar}>
          <a className={s.demoEnlarge} href={active.src} target="_blank" rel="noopener noreferrer" aria-label={`View ${active.label.toLowerCase()} screenshot, opens in a new tab`}><Icon name="expand" size={15} />View screenshot</a>
          <div className={s.demoNavigation}>
            <span className={s.demoCounter} aria-hidden="true"><span className={s.demoCounterActive}>{String(index + 1).padStart(2, '0')}</span> / {String(slides.length).padStart(2, '0')}</span>
            <button type="button" className={`${s.demoArrow} ${s.demoArrowPrev}`} aria-label="Previous slide" aria-controls={`${id}-slides`} onClick={() => move('prev')}><Icon name="chevron" size={18} /></button>
            <button type="button" className={`${s.demoArrow} ${s.demoArrowNext}`} aria-label="Next slide" aria-controls={`${id}-slides`} onClick={() => move('next')}><Icon name="chevron" size={18} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
