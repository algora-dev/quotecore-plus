'use client';

import { useEffect, useRef, type MouseEvent } from 'react';
import { trackEvent } from '@/lib/analytics';
import { DemoCallButton } from './DemoCall';
import { Icon } from './Icon';
import { homepageFaqs } from './homepage-content';
import type { HomepageConfig } from './homepage-config';
import s from './Homepage.module.css';
import f from './FaqSection.module.css';

export function FaqSection({ config, pricingHref = '/pricing', setupHref = '/done-for-you-setup' }: {
  config: Pick<HomepageConfig, 'demoHref' | 'bookingHref'>;
  pricingHref?: string;
  setupHref?: string;
}) {
  const list = useRef<HTMLDivElement>(null);
  const animations = useRef(new Map<HTMLDetailsElement, Animation>());
  const destinations = { demo: config.demoHref, pricing: pricingHref, setup: setupHref };

  useEffect(() => {
    const active = animations.current;
    return () => {
      active.forEach(animation => { animation.onfinish = null; animation.cancel(); });
      active.clear();
    };
  }, []);

  function setExpanded(item: HTMLDetailsElement, expanded: boolean) {
    const summary = item.querySelector('summary')!;
    const answer = item.querySelector<HTMLDivElement>('[data-faq-answer]')!;
    // Read the current animated height before cancelling, so rapid clicks reverse smoothly.
    const from = item.getBoundingClientRect().height;
    const previous = animations.current.get(item);
    if (previous) { previous.onfinish = null; previous.cancel(); }
    animations.current.delete(item);
    item.dataset.expanded = String(expanded);
    summary.setAttribute('aria-expanded', String(expanded));

    const finish = () => {
      item.open = expanded;
      item.style.height = '';
      animations.current.delete(item);
    };
    if (typeof item.animate !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }

    item.style.height = `${from}px`;
    if (expanded) item.open = true;
    const style = getComputedStyle(item);
    const borders = (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
    const to = summary.getBoundingClientRect().height + (expanded ? answer.getBoundingClientRect().height : 0) + borders;
    const animation = item.animate({ height: [`${from}px`, `${to}px`] }, {
      duration: 240,
      easing: 'cubic-bezier(.2, 0, 0, 1)',
      fill: 'both',
    });
    animations.current.set(item, animation);
    animation.onfinish = () => {
      if (animations.current.get(item) === animation) {
        animation.onfinish = null;
        finish();
        animation.cancel();
      }
    };
  }

  function toggleAnswer(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    const summary = event.currentTarget;
    const item = summary.parentElement as HTMLDetailsElement;
    const expanded = item.dataset.expanded ? item.dataset.expanded !== 'true' : !item.open;
    summary.focus({ preventScroll: true });
    if (expanded) list.current?.querySelectorAll<HTMLDetailsElement>('details[open]').forEach(other => {
      if (other !== item && other.dataset.expanded !== 'false') setExpanded(other, false);
    });
    setExpanded(item, expanded);
    if (expanded) trackEvent('homepage_faq_open', { question: item.id });
  }

  return <section id="questions" className={f.section} aria-labelledby="faq-title">
    <svg className={f.blueprint} viewBox="0 0 400 240" fill="none" aria-hidden="true" focusable="false">
      <path d="M-40 203 130 33h185v207M-26 217 144 47h157v193M-12 231 158 61h129v179" />
      <path d="M-32 230 151 47h48M287 105h95M315 77h67" className={f.orangeLine} />
      <path d="M111 10v230M68 139h262M234 14v226" className={f.guideLine} />
      <circle cx="111" cy="139" r="4" />
    </svg>
    <div className={`${s.container} ${f.layout}`}>
      <div className={f.intro}>
        <p className={`${s.eyebrow} ${f.eyebrow}`}>QuoteCore+ FAQs</p>
        <h2 id="faq-title" className={f.title}>Before you<br className={f.headingBreak} /> get started.</h2>
        <p className={f.description}>Practical answers about using QuoteCore+ for roofing estimates, job pricing and customer quotes.</p>
        <div className={f.contact}>
          <p>Have a question about your business?</p>
          <DemoCallButton bookingHref={config.bookingHref} location="faq" primary />
        </div>
      </div>
      <div ref={list} className={`${s.dark} ${f.panel}`}>
        {homepageFaqs.map(faq => <details id={`faq-${faq.id}`} key={faq.id} className={f.item}>
          <summary className={f.question} aria-expanded="false" onClick={toggleAnswer}>
            <h3>{faq.question}<span className={f.toggleMark} aria-hidden="true" /></h3>
          </summary>
          <div className={f.answer} data-faq-answer>
            <p>{faq.answer}</p>
            {faq.link && <a className={f.answerLink} href={destinations[faq.link.destination]} target="_blank" rel="noopener noreferrer">{faq.link.label}<Icon name="arrow" size={15} /></a>}
          </div>
        </details>)}
      </div>
    </div>
  </section>;
}
