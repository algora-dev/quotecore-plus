'use client';
import { useRef, useState, type ReactNode } from 'react';
import { QcDialog } from '@/app/components/ui/v2/QcDialog';
import './demo-info.css';

type Slide = { eyebrow: string; title: string; body: ReactNode };

/**
 * Demo Info modal (owner 2026-10-19): first-landing orientation that the small
 * floating helper cannot carry. Explains the fictional business, what is
 * explorable, the guide's purpose, demo limits vs the real app, and keeps the
 * conversion CTAs permanently visible in a fixed footer. Reopenable any time
 * from the demo strip ("Demo info") and the guide's hamburger menu.
 */
const CALLOUT_CTA = 'https://calendly.com/quote-core-info/meeting';
const DFY_CTA = 'https://quote-core.com/done-for-you-setup';
const ACCOUNT_CTA = 'https://quote-core.com/pricing';

function bullets(items: string[]) {
  return <ul className="qc-demo-info-list">{items.map(item => <li key={item}><span aria-hidden="true" />{item}</li>)}</ul>;
}

function chapterRow(number: number, title: string, why: string) {
  return <div className="qc-demo-info-chapter"><span aria-hidden="true">{number}</span><div><strong>{title}</strong><p>{why}</p></div></div>;
}

export function DemoInfoModal({ open, welcomed, pending, onRequestClose, onBeginGuide, onExploreFirst }: {
  open: boolean;
  /** First visit (no welcome choice yet) shows the entry CTA pair on the last slide. */
  welcomed: boolean;
  pending: boolean;
  onRequestClose: () => void;
  onBeginGuide: () => void;
  onExploreFirst: () => void;
}) {
  const [index, setIndex] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Reset the carousel on each open, during render (no effect needed).
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) { setWasOpen(open); if (open) setIndex(0); }

  const slides: Slide[] = [
    { eyebrow: 'ABOUT THIS DEMO', title: 'A working business, not a blank account', body: <>
      <p>You&apos;re inside <strong>QCP Roofing &amp; Construction</strong> — a fictional company we set up with everyday work already in it, so you see QuoteCore+ the way a real user would.</p>
      {bullets(['A pricing library with ready-made components', 'Completed quotes, drafts, invoices and orders', 'Alerts and messages, like a busy week already happened'])}
      <p className="qc-demo-info-soft">Nothing here affects a real account. No signup, no card — the workspace is yours for up to 24 hours.</p>
    </> },
    { eyebrow: 'EXPLORE FREELY', title: 'Everything is open — have a proper look', body: <>
      <p>The demo is built so that exploring on your own gives you a real picture of how everything works. Open things, change things, break things — resetting is one click.</p>
      {bullets([
        'Edit pricing: create, test and update reusable components',
        'Open quotes, invoices and orders and edit them like your own',
        'Check alerts and messages to see how work tracks itself',
      ])}
    </> },
    { eyebrow: 'THE GUIDED TOUR', title: 'Four chapters — a taste, not a tour', body: <>
      <p>The guide walks the core workflow in about 10–15 minutes. It&apos;s deliberately short: it shows you the main path so the rest makes sense. The full app has more features and options than any tour can cover.</p>
      <div className="qc-demo-info-chapters">
        {chapterRow(1, 'Build your pricing', 'Hands-on with one reusable pricing rule — the same one you\u2019ll use on the roof next.')}
        {chapterRow(2, 'Measure the job', 'Add your component to the prepared roof plan. Your measurements and edits are real.')}
        {chapterRow(3, 'Prepare the customer quote', 'Make the measured job customer-ready, then send it to yourself.')}
        {chapterRow(4, 'Use Smart Assistant', 'Create, change and find work by asking in plain English.')}
      </div>
    </> },
    { eyebrow: 'DEMO LIMITS', title: 'What\u2019s switched off here — and on in the real app', body: <>
      <div className="qc-demo-info-cols">
        <div className="qc-demo-info-col">
          <h3>In this demo</h3>
          {bullets([
            'Email: up to 2 demo emails per 24 hours, sent to yourself only, with demo branding',
            'Scan assist is switched off',
            'Smart Assistant: 9 tasks — one message is one task (it runs on paid AI)',
          ])}
        </div>
        <div className="qc-demo-info-col qc-demo-info-col-real">
          <h3>In the real app</h3>
          {bullets([
            'Send as many quotes as you like, or share a link instead',
            'See when quotes are opened, accepted or declined',
            'Automatic quote follow-ups',
            'Attach files and documents to your quotes',
            'Scan assist, more options and more features throughout',
          ])}
        </div>
      </div>
    </> },
    { eyebrow: 'START WHEREVER YOU LIKE', title: 'Take the guide, or explore first', body: <>
      <p>Your progress saves as you go, and you can reopen this overview any time from the demo strip at the top or the guide&apos;s menu.</p>
      <div className="qc-demo-info-entry">
        <button type="button" className="qc-demo-info-begin" disabled={pending} onClick={onBeginGuide}>{welcomed ? 'Open the guide' : 'Begin the guide'}</button>
        <button type="button" className="qc-demo-info-explore" disabled={pending} onClick={onExploreFirst}>{welcomed ? 'Close' : 'No thanks, I\u2019ll explore first'}</button>
      </div>
    </> },
  ];

  const last = index === slides.length - 1;
  const headingId = `qc-demo-info-heading-${index}`;

  return <QcDialog open={open} pending={pending} onRequestClose={onRequestClose} size="lg"
    labelledBy={headingId} initialFocusRef={closeRef} className="qc-demo-info-dialog">
    <div className="qc-demo-info-head">
      <p className="qc-demo-info-eyebrow">{slides[index].eyebrow}</p>
      <button ref={closeRef} type="button" className="qc-demo-info-close" aria-label="Close demo info" disabled={pending} onClick={onRequestClose}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 18 18 6M6 6l12 12" /></svg>
      </button>
    </div>
    <div className="qc-demo-info-carousel" role="group" aria-roledescription="carousel" aria-label="About this demo">
      <div className="qc-demo-info-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((slide, i) => <section key={slide.eyebrow} className="qc-demo-info-slide" aria-hidden={i !== index} aria-label={`${i + 1} of ${slides.length}`}>
          <div className="qc-demo-info-slide-body">
            {i === index ? <h2 id={headingId}>{slide.title}</h2> : <h2>{slide.title}</h2>}
            {slide.body}
          </div>
        </section>)}
      </div>
    </div>
    <footer className="qc-demo-info-footer">
      <div className="qc-demo-info-ctas">
        <a className="qc-demo-info-cta qc-demo-info-cta-hot" href={CALLOUT_CTA} target="_blank" rel="noopener noreferrer">Book a free 20-min demo</a>
        <a className="qc-demo-info-cta" href={DFY_CTA} target="_blank" rel="noopener noreferrer">Done-For-You setup</a>
        <a className="qc-demo-info-cta" href={ACCOUNT_CTA} target="_blank" rel="noopener noreferrer">Create your account</a>
      </div>
      <div className="qc-demo-info-nav">
        <button type="button" className="qc-demo-info-back" disabled={index === 0 || pending} onClick={() => setIndex(v => Math.max(0, v - 1))}>‹ Back</button>
        <div className="qc-demo-info-dots" role="tablist" aria-label="Demo info slides">
          {slides.map((slide, i) => <button key={slide.eyebrow} type="button" role="tab" aria-selected={i === index}
            aria-label={`Slide ${i + 1}: ${slide.title}`} className={i === index ? 'qc-demo-info-dot is-active' : 'qc-demo-info-dot'}
            disabled={pending} onClick={() => setIndex(i)} />)}
        </div>
        {last ? <span className="qc-demo-info-count" aria-live="polite">{index + 1} / {slides.length}</span>
          : <button type="button" className="qc-demo-info-next" disabled={pending} onClick={() => setIndex(v => Math.min(slides.length - 1, v + 1))}>Next ›</button>}
      </div>
    </footer>
  </QcDialog>;
}
