'use client';
import type { Testimonial } from './homepage-content';
import { Icon } from './Icon';
import { ProductScreenshot } from './ProductScreenshot';
import { useHeroMotion } from './useHeroMotion';
import { trackEvent } from '@/lib/analytics';
import s from './Homepage.module.css';

/** Negative resting Y/Z perspective still turns the panel into the copy.
 * The glass chassis and proof are separate siblings in one perspective scene.
 */
export function HeroVisual({ review }: { review: Testimonial }) {
  const root = useHeroMotion();
  return <div ref={root} className={s.heroVisual} data-testid="hero-scene">
    <div className={s.heroApp} data-testid="hero-app">
      <div className={s.appChrome} aria-hidden="true">
        <span className={s.windowDots}><i /><i /><i /></span>
        <span>QuoteCore+ <span className={s.chromeSlash}>/</span> Digital takeoff</span>
        <span className={s.chromeIndicator} />
      </div>
      <div className={s.appViewport}><ProductScreenshot eager /></div>
    </div>
    <a href="#reviews" className={s.heroReview} data-testid="hero-review"
      aria-label={review.placeholder ? 'Illustrative review placeholder. Read the supplied customer reviews below.' : `Read customer reviews, including ${review.name}`}
      onClick={e => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const target = document.getElementById('reviews');
        if (target) {
          e.preventDefault(); history.replaceState(null, '', '#reviews');
          target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
          target.focus({ preventScroll: true });
        }
        trackEvent('homepage_review_click', { location: 'hero' });
      }}>
      <Icon name="quote" size={21} className={s.quoteMark} />
      <blockquote>“{review.quote}”</blockquote>
      <div className={s.reviewAuthor}><span className={s.avatar} aria-hidden="true">{review.initials}</span><span><strong>{review.name}</strong><small>{review.business}</small></span><Icon name="arrow" size={16} /></div>
      {review.placeholder && <span className={s.placeholderLabel}>Placeholder · not a customer testimonial</span>}
    </a>
  </div>;
}
