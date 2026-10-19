'use client';
import { useRef, useState, type ReactNode } from 'react';
import { QcButton, QcLinkButton } from '@/app/components/ui/v2/QcButton';
import { QcDialog } from '@/app/components/ui/v2/QcDialog';
import './demo-info.css';

type Slide = { eyebrow: string; title: string; body: ReactNode };

/**
 * Demo Info modal: first-landing orientation that gives the guided demo context
 * the small floating helper cannot carry. The guide stays task-focused; this
 * modal explains what the user will do, why each step matters, what is limited
 * in the demo, and what to do next if they want to go further.
 */
const CALLOUT_CTA = 'https://calendly.com/quote-core-info/meeting';
const DFY_CTA = 'https://quote-core.com/done-for-you-setup';
const ACCOUNT_CTA = 'https://quote-core.com/pricing';

function CheckIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>;
}

function InfoIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>;
}

function bullets(items: string[]) {
  return <ul className="qc-demo-info-list">{items.map(item => <li key={item}><CheckIcon />{item}</li>)}</ul>;
}

function journeyStep(number: number, title: string, task: string) {
  return <div className="qc-demo-info-journey-step">
    <span className="qc-demo-info-step-number" aria-hidden="true">{String(number).padStart(2, '0')}</span>
    <div><strong>{title}</strong><p>{task}</p></div>
  </div>;
}

function featureCard(title: string, body: ReactNode) {
  return <article className="qc-demo-info-feature-card"><h3>{title}</h3><p>{body}</p></article>;
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
    {
      eyebrow: 'WELCOME TO THE DEMO',
      title: 'See how the core workflow fits together',
      body: <>
        <p>You&apos;re inside <strong>QCP Roofing &amp; Construction</strong>, a fictional business with pricing and existing work already loaded. You can get straight to the useful parts instead of starting from an empty account.</p>
        <div className="qc-demo-info-intro-card">
          <InfoIcon />
          <div>
            <strong>The goal is simple</strong>
            <p>Create pricing, use it on a measured job, prepare and send a quote, then try doing similar work through Smart Assistant.</p>
          </div>
        </div>
        {bullets([
          'Follow the guide for the fastest path, or explore around as you go',
          'Most demo data can be edited safely and you can reset the demo at any time',
          'Your temporary demo workspace is available for up to 24 hours',
        ])}
      </>,
    },
    {
      eyebrow: 'YOUR GUIDED JOURNEY',
      title: 'Four short tasks, one connected workflow',
      body: <>
        <p>The guide is deliberately fast-tracked. Each task teaches one part of QuoteCore+, then uses that work in the next step so you can see the flow end to end.</p>
        <div className="qc-demo-info-journey">
          {journeyStep(1, 'Add your pricing', 'Create one Smart Component from pricing you already understand. You can also edit an existing component if you want to look deeper.')}
          {journeyStep(2, 'Use that pricing on a roof', 'Open a prepared Digital Takeoff and add the measurements needed for the component you just created.')}
          {journeyStep(3, 'Prepare and send the quote', 'Switch the quote to a branded header template, edit line items if you want, save it, then send the demo quote to yourself.')}
          {journeyStep(4, 'Try Smart Assistant', 'Ask your personal assistant to create a similar quote from roof areas, pitch and your component library, then make changes and check what needs your attention using voice or text.')}
        </div>
      </>,
    },
    {
      eyebrow: 'WHY THESE TASKS MATTER',
      title: 'You are testing four different ways QuoteCore+ can save time',
      body: <>
        <div className="qc-demo-info-feature-grid">
          {featureCard('Smart Components', <>Enter your pricing once and make it reusable. Bring the information you already use, and the component handles the calculations. Edit it later whenever your pricing changes, then reuse the same building blocks across jobs, takeoffs and quotes.</>)}
          {featureCard('Digital Takeoff', <>Measure directly on a plan instead of printing plans or rebuilding measurements elsewhere. The demo uses the manual workflow. In the full app, Scan Assist can help identify roof geometry, reduce repetitive measuring and make consistent results easier for less experienced team members.</>)}
          {featureCard('Quotes and tracking', <>Control what the customer sees by changing the branded header and line items before you send. The demo send flow is simplified, but opening your emailed quote will show how QuoteCore+ can track customer activity.</>)}
          {featureCard('Smart Assistant', <>Use voice or text to work with your account without clicking through every screen. It is especially useful when you work from your phone, spend time on site, or simply want a faster route to the result.</>)}
        </div>
        <p className="qc-demo-info-soft">In the full app, quoting can also include custom email subjects and messages, attachments, automatic follow-ups, and tracking when a quote is opened, accepted, declined or needs more detail.</p>
      </>,
    },
    {
      eyebrow: 'WHAT IS AVAILABLE HERE',
      title: 'Explore freely, with a few demo limits',
      body: <>
        <p>A lot of the account is open for you to inspect, edit and experiment with. Some high-cost or guided features are intentionally limited so the demo stays safe and useful for everyone.</p>
        <div className="qc-demo-info-cols">
          <div className="qc-demo-info-col">
            <h3>In this demo</h3>
            {bullets([
              'Digital Takeoff is available through the guided measuring task',
              'Scan Assist is not available at full capability in the demo',
              'Smart Assistant includes 9 demo tasks',
              'You can send up to 2 demo emails per 24 hours, to yourself, with demo branding',
              'You can reset the demo and start again if you want a clean workspace',
            ])}
          </div>
          <div className="qc-demo-info-col qc-demo-info-col-real">
            <h3>In your own account</h3>
            {bullets([
              'Use your own pricing, customers, jobs and reusable component library',
              'Use the normal takeoff and quoting workflows beyond the guided path',
              'Send customer quotes with your own message, subject and attachments',
              'Track quote activity and build follow-up rules around customer responses',
              'Use Smart Assistant as another way to control the account by voice or text',
            ])}
          </div>
        </div>
      </>,
    },
    {
      eyebrow: 'READY WHEN YOU ARE',
      title: 'Start with the guide, then explore at your own pace',
      body: <>
        <p>The guide is the quickest way to understand how pricing, measuring, quoting and Smart Assistant connect. You can still look around between tasks, and you can reopen this overview any time from <strong>Demo info</strong> in the toolbar or from the guide menu.</p>
        <div className="qc-demo-info-entry">
          <QcButton variant="primary" size="lg" pending={pending} onClick={onBeginGuide}>
            {welcomed ? 'Open the guide' : 'Begin the guide'}
          </QcButton>
          <QcButton variant="secondary" size="lg" disabled={pending} onClick={onExploreFirst}>
            {welcomed ? 'Close' : 'Explore on my own'}
          </QcButton>
        </div>
        <p className="qc-demo-info-entry-note">You cannot break the shared demo. If you get lost or want to start clean, use <strong>Start fresh</strong> to reset it.</p>
      </>,
    },
  ];

  const last = index === slides.length - 1;
  const headingId = `qc-demo-info-heading-${index}`;

  return <QcDialog open={open} pending={pending} onRequestClose={onRequestClose} size="lg"
    labelledBy={headingId} initialFocusRef={closeRef} className="qc-demo-info-dialog">
    <div className="qc-demo-info-head">
      <div className="qc-demo-info-head-copy">
        <p className="qc-demo-info-eyebrow">{slides[index].eyebrow}</p>
        <p className="qc-demo-info-progress-label">Demo overview <span>{index + 1} of {slides.length}</span></p>
      </div>
      <QcButton ref={closeRef} variant="ghost" size="sm" className="qc-demo-info-close" aria-label="Close demo info" disabled={pending} onClick={onRequestClose}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 18 18 6M6 6l12 12" /></svg>
      </QcButton>
    </div>
    <div className="qc-demo-info-progress" aria-hidden="true"><span style={{ width: `${((index + 1) / slides.length) * 100}%` }} /></div>
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
      <div className="qc-demo-info-conversion">
        <span>Want to go further?</span>
        <div className="qc-demo-info-ctas">
          <QcLinkButton variant="secondary" size="sm" href={CALLOUT_CTA} target="_blank" rel="noopener noreferrer">Book a free 20-min call</QcLinkButton>
          <QcLinkButton variant="ghost" size="sm" href={DFY_CTA} target="_blank" rel="noopener noreferrer">Done-For-You setup</QcLinkButton>
          <QcLinkButton variant="ghost" size="sm" href={ACCOUNT_CTA} target="_blank" rel="noopener noreferrer">Create your account</QcLinkButton>
        </div>
      </div>
      <div className="qc-demo-info-nav">
        <QcButton variant="ghost" size="sm" disabled={index === 0 || pending} onClick={() => setIndex(v => Math.max(0, v - 1))}>Back</QcButton>
        <div className="qc-demo-info-dots" role="tablist" aria-label="Demo info slides">
          {slides.map((slide, i) => <button key={slide.eyebrow} type="button" role="tab" aria-selected={i === index}
            aria-label={`Slide ${i + 1}: ${slide.title}`} className={i === index ? 'qc-demo-info-dot is-active' : 'qc-demo-info-dot'}
            disabled={pending} onClick={() => setIndex(i)} />)}
        </div>
        {last ? <span className="qc-demo-info-count" aria-live="polite">{index + 1} / {slides.length}</span>
          : <QcButton variant="primary" size="sm" disabled={pending} onClick={() => setIndex(v => Math.min(slides.length - 1, v + 1))}>Next</QcButton>}
      </div>
    </footer>
  </QcDialog>;
}
