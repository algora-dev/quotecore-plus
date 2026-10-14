'use client';
import { useState } from 'react';
import { trackEvent } from '@/lib/analytics';
import { FocusDialog } from './FocusDialog';
import { Icon } from './Icon';
import { testimonials, type Testimonial } from './homepage-content';
import s from './Homepage.module.css';
import r from './TestimonialsSection.module.css';

function ShortQuote({ review }: { review: Testimonial }) {
  const text = review.excerpt || review.quote;
  const emphasis = review.emphasis;
  const position = emphasis ? text.indexOf(emphasis) : -1;
  return <blockquote>“{position >= 0 && emphasis ? <>{text.slice(0, position)}<strong>{emphasis}</strong>{text.slice(position + emphasis.length)}</> : text}”</blockquote>;
}

export function TestimonialsSection() {
  const [selected, setSelected] = useState<Testimonial | null>(null);
  function readReview(review: Testimonial) {
    setSelected(review);
    trackEvent('homepage_review_open', { customer: review.name, location: 'reviews' });
  }
  return <section id="reviews" tabIndex={-1} className={`${s.dark} ${r.section}`} aria-labelledby="reviews-title">
    <div className={s.container}>
      <header className={r.header}>
        <p className={`${s.eyebrow} ${r.eyebrow}`}>Customer experiences</p>
        <h2 id="reviews-title" className={r.title}>From people doing the work.</h2>
      </header>
      <div className={r.grid}>
        {testimonials.map(review => <figure key={review.name} className={r.card}>
          <div className={r.cardTop}><p>{review.highlight}</p><Icon name="quote" size={23} /></div>
          <ShortQuote review={review} />
          <figcaption className={r.footer}>
            <span className={r.identity}><span className={r.avatar} aria-hidden="true">{review.initials}</span><span><strong>{review.name}</strong><small>{review.business}</small></span></span>
            <button type="button" className={r.read} aria-haspopup="dialog" aria-label={`Read full review from ${review.name}`} onClick={() => readReview(review)}>Read full review<Icon name="arrow" size={14} /></button>
          </figcaption>
        </figure>)}
      </div>
    </div>
    {selected && <FocusDialog title={selected.name} eyebrow={`Customer review · ${selected.business}`} onClose={() => setSelected(null)}>
      <blockquote className={r.fullQuote}>“{selected.quote}”</blockquote>
    </FocusDialog>}
  </section>;
}
