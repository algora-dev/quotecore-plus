'use client';
import type { Testimonial } from './homepage-content';
import { Icon } from './Icon';
import { trackEvent } from '@/lib/analytics';
import s from './Homepage.module.css';

/** Shared by the existing floating hero card and its review preview. */
export function HeroReview({ review }: { review: Testimonial }) {
  return <a href="#reviews" className={s.heroReview} data-testid="hero-review"
    aria-label={review.placeholder ? 'Illustrative review placeholder. Read the supplied customer reviews below.' : 'Read more customer reviews'}
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
    <blockquote>“{review.excerpt || review.quote}”</blockquote>
    <div className={s.reviewAuthor}><span className={s.avatar} aria-hidden="true">{review.initials}</span><span><strong>{review.name}</strong><small>{review.business}</small></span><Icon name="arrow" size={16} /></div>
    {review.placeholder && <span className={s.placeholderLabel}>Placeholder · not a customer testimonial</span>}
  </a>;
}
