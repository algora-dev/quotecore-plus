import type { Metadata } from 'next';
import { PageScaffold } from '@/components/marketing/page-v2/PageV2';
import { buildBreadcrumbSchema, siteUrl } from '@/lib/schema';
import { workflowCallHref } from '@/lib/booking';
import { EvidenceZoomRoot, ZoomCard } from './EvidenceZoom';
import { VideoStage } from './VideoStage';
import s from './fastest.module.css';

const c = (...names: string[]) => names.map((name) => s[name]).join(' ');

const IMG = {
  blank: '/marketing/fastest-roofing/blank-roof-plan.webp',
  measured: '/marketing/fastest-roofing/measured-roof-plan.webp',
  quote: '/marketing/fastest-roofing/sent-customer-quote.webp',
  assistant: '/marketing/fastest-roofing/smart-assistant-mobile.webp',
};

const BOOK = workflowCallHref; // NEXT_PUBLIC_HOMEPAGE_BOOKING_URL with /contact fallback
const EXT = { target: '_blank', rel: 'noopener noreferrer' } as const;

export const metadata: Metadata = {
  title: 'Fastest Roofing Estimating Software? Multi-Face Roof Plan to Quote in 2:27 | QuoteCore+',
  description:
    'See QuoteCore+ turn an unmeasured multi-face pitched residential roof plan into a measured, priced and sent customer quote in 2:27. Real roof takeoff, contractor pricing, labour, waste, margin and proof.',
  alternates: {
    canonical: 'https://quote-core.com/fastest-roofing-estimating-software',
  },
  openGraph: {
    title: 'Fastest roofing estimating software? Multi-face roof plan to sent quote in 2:27 | QuoteCore+',
    description:
      'A real multi-face pitched residential roof benchmark: blank plan to measured takeoff, contractor-specific pricing and sent customer quote in 2 minutes 27 seconds.',
    url: '/fastest-roofing-estimating-software',
    siteName: 'QuoteCore+',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-video-preview': -1,
      'max-snippet': -1,
    },
  },
};

const webPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Fastest Roofing Estimating Software? Multi-Face Roof Plan to Quote in 2:27',
  url: 'https://quote-core.com/fastest-roofing-estimating-software',
  description:
    'Evidence-led benchmark of a complex multi-face pitched residential roof workflow from an unmeasured architectural plan to a measured, priced and sent customer quote in 2 minutes 27 seconds.',
  dateModified: '2026-10-27',
  about: [
    'fastest roofing estimating software',
    'roofing estimating software',
    'residential roof estimating software',
    'roof takeoff software',
    'roof measuring software',
    'multi-face pitched roof takeoff',
    'roof plan estimating software',
  ],
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is the fastest roofing estimating software for multi-face residential roofs?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'For the benchmark on this page, QuoteCore+ is the fastest complete publicly demonstrated workflow we have found that starts with an unmeasured multi-face pitched residential roof plan and continues through takeoff, contractor-specific pricing, an editable customer quote and sending. The recorded run is 2 minutes 27 seconds.',
      },
    },
    {
      '@type': 'Question',
      name: 'Why does a multi-face pitched residential roof matter?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The benchmark roof includes multiple pitched faces plus 8 hips, 4 ridges, 5 valleys, 2 barges and spouting. The workflow therefore uses area and lineal takeoff, pitch treatment, waste, materials and labour rather than only roof area multiplied by one rate.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does my pricing need to be set up before QuoteCore+ can quote this quickly?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Reusable products, labour rates, coverage, waste and pricing rules need to be configured first. Users can configure these themselves or use QuoteCore+ Done For You Setup to help translate an existing pricing workflow into the app.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I send QuoteCore+ one of my own roof plans for a demo?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. A tailored demo can use a roof plan the contractor would normally need to measure and quote, so the team can show how that plan would move through takeoff, pricing and the customer quote workflow.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does QuoteCore+ compare with RoofSnap, Roofr and RoofCAD?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The tools publish different kinds of speed claims. RoofSnap and Roofr promote fast estimate workflows with different starting inputs, while RoofCAD focuses on roof drawing and takeoff. The QuoteCore+ benchmark on this page starts from an unmeasured architectural roof plan and ends after contractor-specific pricing and a customer quote are sent.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I do the takeoff without AI Scan Assist?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. The same architectural plan was measured manually inside QuoteCore+ and passed through the same pricing and quoting workflow in 3 minutes 16 seconds.',
      },
    },
  ],
};

const videoSchema = {
  '@context': 'https://schema.org',
  '@type': 'VideoObject',
  name: 'QuoteCore+ multi-face roof plan to sent customer quote in 2:27',
  description:
    'Uncut, normal-speed recording: an unmeasured multi-face pitched residential roof plan measured, priced and sent as a customer quote in 2 minutes 27 seconds (Quote #1040).',
  thumbnailUrl: ['https://i.ytimg.com/vi/uevX8puAlQ8/maxresdefault.jpg'],
  embedUrl: 'https://www.youtube-nocookie.com/embed/uevX8puAlQ8',
  contentUrl: 'https://www.youtube.com/watch?v=uevX8puAlQ8',
  uploadDate: '2026-10-27',
  duration: 'PT2M27S',
};

const components = [
  {
    name: 'Corrugate .40g',
    badge: '1 segment · area converted to lineal sheets',
    calc: [
      { label: 'Raw plan measurement', value: '14.77 RS' },
      { label: 'Pitch', value: '1.1034' },
      { label: 'Waste rule', value: 'pitch then 3% waste' },
      { label: 'Final quoted qty', value: '673.3 ft' },
    ],
    total: { material: ['US$3.17/ ft', 'US$2,134.31'], labour: ['US$1.06/ ft', 'US$711.43'], sum: 'US$2,845.74' },
  },
  {
    name: 'Screws',
    badge: '1 segment · area',
    calc: [
      { label: 'Raw plan measurement', value: '14.77 RS' },
      { label: 'Pitch', value: '1.1034' },
      { label: 'Waste rule', value: 'pitch then 10% waste' },
      { label: 'Final quoted qty', value: '17.9 RS' },
    ],
    total: { material: ['US$13.24/ RS', 'US$237.44'], labour: ['US$0.00/ RS', 'US$0.00'], sum: 'US$237.44' },
  },
  {
    name: 'Roofing Underlay',
    badge: '1 segment · area',
    calc: [
      { label: 'Raw plan measurement', value: '14.77 RS' },
      { label: 'Pitch', value: '1.1034' },
      { label: 'Waste rule', value: 'pitch then 5% waste' },
      { label: 'Final quoted qty', value: '17.1 RS' },
    ],
    total: { material: ['US$26.48/ RS', 'US$453.28'], labour: ['US$15.89/ RS', 'US$271.97'], sum: 'US$725.25' },
  },
  {
    name: 'Ridge (Soft Edge Standard)',
    badge: '4 segments · lineal level run',
    calc: [
      { label: 'Raw plan measurement', value: '30.5 ft' },
      { label: 'Pitch', value: 'not applied (level run)' },
      { label: 'Waste rule', value: '+0.30 fixed per segment' },
      { label: 'Final quoted qty', value: '34.5 ft' },
    ],
    total: { material: ['US$3.12/ ft', 'US$107.64'], labour: ['US$2.09/ ft', 'US$71.84'], sum: 'US$179.48' },
  },
  {
    name: 'Hip Flashing (Soft Edge Standard)',
    badge: '8 segments · lineal raking',
    calc: [
      { label: 'Raw plan measurement', value: '140.4 ft' },
      { label: 'Pitch', value: 'pitch adjusted (per segment)' },
      { label: 'Waste rule', value: '+0.30 fixed per segment' },
      { label: 'Final quoted qty', value: '144.5 ft' },
    ],
    total: { material: ['US$3.39/ ft', 'US$489.75'], labour: ['US$2.43/ ft', 'US$351.61'], sum: 'US$841.36' },
  },
  {
    name: 'Valley Flashing (Standard)',
    badge: '5 segments · lineal raking',
    calc: [
      { label: 'Raw plan measurement', value: '60.9 ft' },
      { label: 'Pitch', value: 'pitch adjusted (per segment)' },
      { label: 'Waste rule', value: '+0.40 fixed per segment' },
      { label: 'Final quoted qty', value: '70.7 ft' },
    ],
    total: { material: ['US$1.91/ ft', 'US$135.24'], labour: ['US$0.87/ ft', 'US$61.47'], sum: 'US$196.70' },
  },
  {
    name: 'Barge Flashing (Standard)',
    badge: '2 segments · lineal raking',
    calc: [
      { label: 'Raw plan measurement', value: '12.4 ft' },
      { label: 'Pitch', value: '1.1034 then +0.25' },
      { label: 'Waste rule', value: 'pitch then +0.25 fixed per segment' },
      { label: 'Final quoted qty', value: '15.3 ft' },
    ],
    total: { material: ['US$3.21/ ft', 'US$49.13'], labour: ['US$1.91/ ft', 'US$29.21'], sum: 'US$78.34' },
  },
  {
    name: 'Spouting Half-Round',
    badge: '13 segments · lineal level (eaves)',
    calc: [
      { label: 'Raw plan measurement', value: '158.4 ft' },
      { label: 'Pitch', value: 'not applied (level eaves)' },
      { label: 'Waste rule', value: '5% waste no pitch' },
      { label: 'Final quoted qty', value: '166.3 ft' },
    ],
    total: { material: ['US$7.30/ ft', 'US$1,213.58'], labour: ['US$1.39/ ft', 'US$231.16'], sum: 'US$1,444.74' },
  },
];

const comparisonFocus = [
  {
    vendor: 'RoofSnap',
    claim: 'Under 10 seconds',
    body: 'Its published fast-pricing flow begins with property details plus roof size and material information, with satellite auto-fill also promoted.',
    href: 'https://roofsnap.com/solutions/instant-roof-estimates/',
  },
  {
    vendor: 'Roofr Instant Estimator',
    claim: 'First quote in seconds',
    body: 'Homeowners answer questions and the estimate uses the contractor’s configured pricing; Roofr separately offers measurement reports.',
    href: 'https://roofr.com/estimator',
  },
  {
    vendor: 'RoofCAD',
    claim: 'Calls itself the fastest roof takeoff tool',
    body: 'RoofCAD focuses on drawing and takeoff from plans or imagery, but its page does not publish a like-for-like blank-plan-to-sent-quote time.',
    href: 'https://www.roofcad.com/',
  },
];

const comparisonRows = [
  {
    platform: 'QuoteCore+',
    ours: true,
    time: '2:27 recorded',
    starts: 'Unmeasured architectural plan',
    covers: 'Calibration, multi-face pitched takeoff, component pricing, margin, editable customer quote and send',
    match: { label: 'YES · this benchmark', kind: 'same' },
  },
  {
    platform: 'RoofSnap',
    time: 'Under 10 sec',
    starts: 'Property details plus roof size / material information; their page also promotes satellite auto-fill',
    covers: 'Five custom pricing estimates / homeowner estimate output',
    match: { label: 'NO · measurements / roof inputs already supplied', kind: 'diff' },
  },
  {
    platform: 'Roofr Instant Estimator',
    time: '“Seconds”',
    starts: 'Homeowner answers questions; Roofr highlights roof size and material information in qualification',
    covers: 'First estimate / lead qualification using configured business pricing',
    match: { label: 'NO · different starting point', kind: 'diff' },
  },
  {
    platform: 'RoofCAD',
    time: 'No timed benchmark published',
    starts: 'Electronic plan, satellite, aerial or drone imagery for drawing / takeoff',
    covers: 'Roof drawing and takeoff; RoofCAD calls itself the “fastest, simplest and most comprehensive roof takeoff tool”',
    match: { label: 'NO · takeoff claim, not plan-to-sent-quote timing', kind: 'diff' },
  },
  {
    platform: 'ServiceTitan Roofing',
    time: 'About 2 min*',
    starts: 'Field estimate workflow in a published roofing customer example',
    covers: 'Build and present an estimate in the field',
    match: { label: 'NO · not a blank-plan takeoff benchmark', kind: 'diff' },
  },
  {
    platform: 'HOVER',
    time: '1 hr expedited**',
    starts: 'Property capture / scan',
    covers: 'Expedited roof measurement delivery; blueprint uploads excluded from the 1-hour statement',
    match: { label: 'NO · measurement delivery, not sent quote', kind: 'diff' },
  },
  {
    platform: 'AccuLynx + GAF QuickMeasure',
    time: 'Under 1 hr',
    starts: 'Aerial measurement report order',
    covers: 'Single-family measurement report delivery, then data can populate the estimate',
    match: { label: 'NO · report first, estimate second', kind: 'diff' },
  },
];

const faqs = [
  {
    question: 'What is the fastest roofing estimating software for multi-face residential roofs?',
    answer:
      'For the benchmark used on this page, QuoteCore+ is the fastest complete workflow we have found with a comparable public end-to-end recording: an unmeasured multi-face pitched residential roof plan through takeoff, contractor-specific pricing, an editable customer quote and sending. The recorded run is 2 minutes 27 seconds. The claim is dated and scoped to this exact workflow.',
  },
  {
    question: 'Why does “multi-face pitched residential roof” matter?',
    answer:
      'A simple roof can often be reduced to one area and a rate. This benchmark roof has multiple pitched faces plus 8 hips, 4 ridges, 5 valleys, 2 barges and spouting. That requires area and lineal takeoff, pitch treatment, waste, materials and labour rather than one square-rate calculation.',
  },
  {
    question: 'Is QuoteCore+ just calculating roof area × a price?',
    answer:
      'No. The recorded quote includes separate area, linear and quantity-derived components. Those measurements can carry pitch, waste, coverage, material and labour rules before becoming the final price.',
  },
  {
    question: 'Can I use my own products, labour rates and pricing?',
    answer:
      'Yes. The measured roof feeds the roofing business’s configured Smart Components and pricing logic rather than a generic industry square-metre rate.',
  },
  {
    question: 'Can I do the takeoff without AI Scan Assist?',
    answer:
      'Yes. The same architectural plan was measured manually inside QuoteCore+ and passed through the same pricing and quoting workflow in 3 minutes 16 seconds.',
  },
  {
    question: 'What if I already have the measurements?',
    answer:
      'That is a separate speed test. Using the same roof quantities after the measurement work was already done, Smart Assistant built the quote in 17 seconds using the same saved components and pricing engine.',
  },
  {
    question: 'How accurate is the takeoff?',
    answer:
      'Accuracy depends on the source plan, correct calibration and the measurements ultimately approved by the estimator. QuoteCore+ keeps the measured geometry visible and editable so it can be checked before pricing.',
  },
  {
    question: 'Can I edit the quote before the customer sees it?',
    answer:
      'Yes. The customer-facing quote can be reviewed and edited before sending, including presentation choices such as headers and how much line-item pricing or internal detail is displayed.',
  },
  {
    question: 'Can I see when the customer opens the quote?',
    answer:
      'Yes. QuoteCore+ tracks opens and reads for sent quotes, and it can alert you when a quote is opened, accepted or declined. That gives you a more useful signal for follow-up than simply knowing an email was sent.',
  },
  {
    question: 'Does my pricing need to be set up before QuoteCore+ can quote this quickly?',
    answer:
      'Yes. Your reusable products, labour rates, coverage, waste and pricing rules need to be configured first. That reusable setup is what makes fast repeatable quoting possible. You can configure it yourself or use QuoteCore+ Done For You Setup to help translate your current pricing and workflow into the app.',
  },
  {
    question: 'Can I send you one of my own roof plans for a demo?',
    answer:
      'Yes. Book a tailored demo and provide a roof plan you would normally need to measure and quote. We can use it to show how the takeoff, pricing and quote workflow would look in QuoteCore+ and where your own configured products and pricing rules would fit.',
  },
  {
    question: 'How does this compare with RoofSnap, Roofr and RoofCAD?',
    answer:
      'They solve overlapping but different parts of the roofing workflow. RoofSnap publishes very fast instant-estimate times with roof inputs or satellite-assisted data; Roofr promotes first quotes in seconds from homeowner inputs and configured pricing; RoofCAD describes itself as a fast roof takeoff tool. The QuoteCore+ benchmark on this page is narrower and longer end-to-end: it starts from an unmeasured multi-face architectural roof plan and ends after contractor-specific pricing and a customer quote are sent.',
  },
  {
    question: 'Is this roof takeoff software only for simple residential roofs?',
    answer:
      'No. This benchmark is deliberately a complex multi-face pitched residential roof. The measured job includes hips, ridges, valleys, barges, spouting, pitch, waste, materials and labour. The page uses that complexity to show how plan measurement can flow through to pricing rather than stopping at a roof-area total.',
  },
];

const resultLines = [
  ['Corrugate .40g', '673.3 ft'],
  ['Screws', '17.9 RS'],
  ['Roofing underlay', '17.1 RS'],
  ['Ridge flashing', '34.5 ft'],
  ['Hip flashing', '144.5 ft'],
  ['Valley flashing', '70.7 ft'],
  ['Barge flashing', '15.3 ft'],
  ['Half-round spouting', '166.3 ft'],
];

function CheckIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l4 4L19 6" /></svg>;
}
function PlayIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7V5z" /></svg>;
}
function ArrowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}
function MailIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4zM4 7l8 6 8-6" /></svg>;
}
function EyeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="2.5" /></svg>;
}
function TickIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l4 4L19 6" /></svg>;
}
function ChatIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v13H7l-3 3V4z" /></svg>;
}
function DocIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" /></svg>;
}

export default function FastestRoofingEstimatingSoftwarePage() {
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: `${siteUrl}/` },
    { name: 'Fastest Roofing Estimating Software', url: `${siteUrl}/fastest-roofing-estimating-software` },
  ]);

  return (
    <PageScaffold
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Fastest Roofing Estimating Software' }]}
      schemas={[webPageSchema, faqSchema, videoSchema, breadcrumbSchema]}
    >
      <EvidenceZoomRoot>
        <div className={s.fx}>
          {/* ===== HERO ===== */}
          <section className={s.hero} id="top">
            <div className={c('container', 'hero-grid')}>
              <div className={s['hero-copy']}>
                <div className={s.eyebrow}>Fastest roofing estimating software?</div>
                <h1>
                  Blank multi-face roof plan to sent customer quote.
                  <span className={c('hero-time', 'gradient-time')}>2:27</span>
                </h1>
                <p className={s['hero-lead']}>
                  A real multi-face pitched residential roof takeoff: area, hips, ridges, valleys, barges and spouting, measured and priced component by component, not just roof squares × a rate.
                </p>
                <div aria-label="Benchmark roof complexity" className={s['hero-proofline']}>
                  <span>25° pitch</span>
                  <span>8 hips</span>
                  <span>4 ridges</span>
                  <span>5 valleys</span>
                  <span>2 barges</span>
                  <span>spouting</span>
                </div>
                <p className={s['hero-body']}>
                  QuoteCore+ starts with an <strong>unmeasured architectural roof plan</strong>, measures the roof, then applies the roofing contractor’s saved products, labour, waste, coverage and pricing rules before margin, customer quote and send. <strong>The stopwatch starts before any roof measurements exist.</strong>
                </p>
                <div className={s['hero-actions']}>
                  <a className={c('button', 'button-primary')} href="#proof">
                    Watch the uncut 2:27 proof <PlayIcon />
                  </a>
                  <a className={c('button', 'button-light')} href={BOOK} {...EXT}>
                    Test it with your roof plan <ArrowIcon />
                  </a>
                </div>
                <div className={s.reassurance}>
                  <span><CheckIcon />Uncut recording</span>
                  <span><CheckIcon />Normal speed</span>
                  <span><CheckIcon />Actual Quote #1040</span>
                  <span><CheckIcon />Your pricing rules</span>
                </div>
                <div className={s['evidence-strip']}>
                  <span className={s['evidence-chip']}><i />2:27 full benchmark</span>
                  <span className={s['evidence-chip']}><i />3:16 manual takeoff</span>
                  <span className={s['evidence-chip']}><i />0:17 from known measurements</span>
                </div>
              </div>
              <div aria-label="Actual benchmark evidence from Quote 1040" className={s['hero-visual']}>
                <div className={s['benchmark-board']}>
                  <div className={s['board-head']}>
                    <strong>Actual QuoteCore+ benchmark evidence</strong>
                    <span className={s['board-live']}><i />Same roof, start to finish</span>
                    <span>Blank plan → measured → quote sent</span>
                  </div>
                  <div className={s['board-stage']}>
                    <ZoomCard
                      className={c('measured-hero-card', 'zoomable-evidence')}
                      title="02 · Measured multi-face roof"
                      src={IMG.measured}
                      alt="Measured multi-face pitched residential roof with hips, ridges and valleys in QuoteCore+ roof takeoff software"
                    >
                      <span className={c('evidence-label', 'evidence-label-measured')}>02 · Measured multi-face roof</span>
                      <img alt="Measured multi-face pitched residential roof with hips, ridges and valleys in QuoteCore+ roof takeoff software" src={IMG.measured} />
                    </ZoomCard>
                    <ZoomCard
                      className={c('blank-float', 'zoomable-evidence')}
                      title="01 · Blank plan"
                      src={IMG.blank}
                      alt="Unmeasured architectural roof plan before QuoteCore+ residential roof takeoff"
                    >
                      <span className={c('evidence-label', 'evidence-label-blank')}>01 · Blank plan</span>
                      <img alt="Unmeasured architectural roof plan before QuoteCore+ residential roof takeoff" src={IMG.blank} />
                    </ZoomCard>
                    <div className={s['board-arrow']} aria-hidden="true">→</div>
                    <ZoomCard
                      className={c('quote-float', 'zoomable-evidence')}
                      title="03 · Sent quote"
                      src={IMG.quote}
                      alt="Sent customer roofing quote produced from the measured multi-face roof in QuoteCore+"
                    >
                      <span className={c('evidence-label', 'evidence-label-quote')}>03 · Sent quote</span>
                      <img alt="Sent customer roofing quote produced from the measured multi-face roof in QuoteCore+" src={IMG.quote} />
                    </ZoomCard>
                    <div className={s['timer-badge']}>
                      <small>Recorded end-to-end</small>
                      <strong className={s['gradient-time']}>2:27</strong>
                      <em>No cuts · normal speed</em>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ===== DIRECT ANSWER ===== */}
          <section aria-labelledby="direct-answer-title" className={s['answer-band']}>
            <div className={c('container', 'answer-grid')}>
              <div className={s['answer-label']}>
                The short answer
                <span className={c('answer-stat', 'gradient-time')}>2:27</span>
                <span className={s['answer-sub']}>Unmeasured architectural plan → measured, priced and sent customer quote.</span>
              </div>
              <div>
                <div className={s['answer-kicker']}>What is the fastest roofing estimating software for a complex residential roof?</div>
                <div className={s['answer-headline']} id="direct-answer-title">
                  <strong>
                    For this exact benchmark, an unmeasured multi-face pitched residential roof plan through takeoff, contractor pricing and a sent customer quote, QuoteCore+ is the fastest publicly demonstrated workflow we have found.
                  </strong>
                </div>
                <div className={s['answer-copy']}>
                  The recorded benchmark is <strong>2 minutes 27 seconds</strong>. It starts with an <strong>unmeasured roof plan</strong> and ends after the customer quote is sent. It does not start with known squares, a completed aerial report, pre-entered quantities, or a simple four-hip roof reduced to area × price.
                </div>
                <div aria-label="Benchmark start and finish" className={s['answer-proof']}>
                  <div className={s['answer-proof-card']}><small>Starting line</small><strong>Unmeasured architectural plan</strong></div>
                  <div className={s['answer-arrow']} aria-hidden="true">→</div>
                  <div className={s['answer-proof-card']}><small>Finish line</small><strong>Customer quote sent</strong></div>
                </div>
                <div className={s['answer-meta']}>
                  <span>Recorded workflow: <strong>2:27</strong></span>
                  <span>Roof: <strong>multi-face pitched residential</strong></span>
                  <span>Competitor claims reviewed: <strong>27 October 2026</strong></span>
                </div>
                <div className={s['answer-actions']}>
                  <a className={c('button', 'button-primary')} href="#proof">Watch the full 2:27 run</a>
                  <a className={c('button', 'button-secondary')} href="#comparison">See the comparison</a>
                </div>
              </div>
            </div>
          </section>

          {/* ===== PROOF VIDEO ===== */}
          <section className={c('section', 'section-white')} id="proof">
            <div className={s.container}>
              <div className={s['section-intro']}>
                <div className={s['section-copy']}>
                  <div className={s.eyebrow}>Uncut roof estimating benchmark</div>
                  <h2>Watch the complete roof-plan-to-quote workflow.</h2>
                  <p>Watch the complete narrated recording. The timer starts on the unmeasured architectural plan and stops only when QuoteCore+ confirms the customer quote has been sent.</p>
                </div>
                <div className={s['aside-copy']}>This is the proof section. Watch the run, then stop reading if it answers your question. Everything below exists for buyers who want to inspect the roof, pricing logic, comparison method or setup requirements.</div>
              </div>
              <div className={s['video-wrap']}>
                <div className={s['video-card']}>
                  <VideoStage
                    videoId="uevX8puAlQ8"
                    title="QuoteCore+ multi-face roof plan to sent customer quote in 2:27"
                  />
                  <div className={s['video-meta']}>
                    <div><b>Uncut</b>One continuous recording</div>
                    <div><b>Normal speed</b>No playback acceleration</div>
                    <div><b>Multi-face roof</b>8 hips, 4 ridges, 5 valleys + more</div>
                    <div><b>Quote sent</b>Not just an estimate screen</div>
                  </div>
                </div>
                <div className={c('conversion-card')} id="book">
                  <div>
                    <h3>Want to see it on a roof you actually quote?</h3>
                    <p>Book a free tailored demo and send us a roof plan you would normally have to measure and price. We can walk through how that job would look in QuoteCore+ using the workflow that fits your business.</p>
                  </div>
                  <div className={c('conversion-actions')}>
                    <a className={c('button', 'button-primary')} href={BOOK} {...EXT}>Book a demo with your roof plan</a>
                    <a className={c('button', 'button-light')} href="/demo" {...EXT}>Try the guided demo</a>
                    <a className={c('button', 'button-ghost')} href="/pricing" {...EXT}>Check pricing →</a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ===== THREE SPEED TESTS ===== */}
          <section className={c('section', 'section-muted')}>
            <div className={s.container}>
              <div className={s['section-intro']}>
                <div className={s['section-copy']}>
                  <div className={s.eyebrow}>Three speed tests · one roof</div>
                  <h2>The starting line changes the result.</h2>
                  <p>A “10-second estimate” and a “2:27 plan-to-sent-quote” can both be true if they start at different points. These three QuoteCore+ runs use the same roof so the difference is obvious.</p>
                </div>
              </div>
              <div className={s['test-cards']}>
                <article className={c('test-card', 'featured')}>
                  <small>Recorded benchmark · same multi-face roof</small>
                  <div className={c('time', 'gradient-time')}>2:27</div>
                  <h3>Blank plan → quote sent</h3>
                  <p>No measurements supplied. Measure the pitched roof, price the components, build the customer quote and send it.</p>
                  <div className={s.scope}>This is the benchmark behind the fastest-workflow claim.</div>
                </article>
                <article className={s['test-card']}>
                  <small>Manual digital takeoff · same roof</small>
                  <div className={s.time}>3:16</div>
                  <h3>Same roof, manual digital takeoff</h3>
                  <p>The same plan measured manually in QuoteCore+, then priced and quoted with the same saved rules.</p>
                  <div className={s.scope}>Same starting line. Manual digital takeoff instead of Scan Assist.</div>
                </article>
                <article className={s['test-card']}>
                  <small>Known measurements · Smart Assistant</small>
                  <div className={s.time}>0:17</div>
                  <h3>Known measurements → quote in 17 seconds</h3>
                  <p>If the roof quantities are already known, Smart Assistant can build the priced job from those measurements.</p>
                  <div className={s.scope}>Different starting line: the takeoff work has already happened.</div>
                </article>
              </div>
            </div>
          </section>

          {/* ===== BREAKDOWN ===== */}
          <section className={c('section', 'section-white')} id="breakdown">
            <div className={s.container}>
              <div className={s['section-intro']}>
                <div className={s['section-copy']}>
                  <div className={s.eyebrow}>Complex residential roof takeoff</div>
                  <h2>This is not a simple four-hip roof priced by the square.</h2>
                  <p>The benchmark roof has multiple pitched faces plus hips, ridges, valleys, barges and spouting. QuoteCore+ carries those measurements into separate material and labour rules instead of flattening the job into one roof-area price.</p>
                </div>
                <div className={s['aside-copy']}>That matters because complex residential roofs are where takeoff, pitch, waste and lineal components usually create the estimating work.</div>
              </div>
              <div className={c('complexity-callout')}>
                <div className={s['roof-placeholder']}>
                  <div className={c('roof-canvas', 'real')}>
                    <img alt="Measured multi-face pitched residential roof used in QuoteCore+ benchmark" className={s['evidence-img']} src={IMG.measured} />
                  </div>
                  <div className={s['roof-caption']}>
                    <span><strong>Actual measured benchmark roof</strong><br />25° pitch · 14.77 roofing squares plan area · 16.30 roofing squares pitched area.</span>
                    <span>Same roof used throughout this page.</span>
                  </div>
                </div>
                <div>
                  <div className={s['metric-grid']}>
                    <div className={c('metric-card', 'orange')}><strong>8</strong><span>hips</span></div>
                    <div className={s['metric-card']}><strong>4</strong><span>ridges</span></div>
                    <div className={s['metric-card']}><strong>5</strong><span>valleys</span></div>
                    <div className={s['metric-card']}><strong>2</strong><span>barges</span></div>
                    <div className={s['metric-card']}><strong>✓</strong><span>spouting</span></div>
                    <div className={s['metric-card']}><strong>✓</strong><span>multiple pitched faces</span></div>
                  </div>
                  <div className={s['not-flat']}>
                    <strong>A multi-face pitched residential roof.</strong> The benchmark includes lineal and area measurements, pitch effects, waste, materials, labour and quantity-derived items such as fixings. It is deliberately not based on a flat or already-measured roof.
                  </div>
                </div>
              </div>
              <div className={s['setup-context']} id="setup-context">
                <div className={s['setup-context-copy']}>
                  <div className={s.eyebrow}>Important context</div>
                  <h3>The 2:27 result uses pricing that was already configured.</h3>
                  <p>That is the point of reusable estimating software. Your products, labour rates, coverage, waste and pricing rules need to exist in QuoteCore+ before the system can reuse them this quickly.</p>
                </div>
                <div className={s['setup-context-actions']}>
                  <a className={c('button', 'button-primary')} href="/done-for-you-setup" {...EXT}>We can set it up for you</a>
                  <a className={c('button', 'button-light')} href={BOOK} {...EXT}>Bring your roof plan to a demo</a>
                </div>
              </div>
            </div>
          </section>

          {/* ===== PRICING EVIDENCE ===== */}
          <section className={c('section', 'section-muted')}>
            <div className={s.container}>
              <div className={s['section-intro']}>
                <div className={s['section-copy']}>
                  <div className={s.eyebrow}>Proof behind Quote #1040</div>
                  <h2>The speed does not come from removing estimating detail.</h2>
                  <p>The quote still carries roof measurements into pitch, waste, material and labour rules. The summary stays visible; the line-by-line component evidence is available if you want to audit it.</p>
                </div>
                <div className={s['aside-copy']}>The detailed component calculations are collapsed by default so a normal visitor does not have to read an estimating ledger.</div>
              </div>
              <div aria-label="Actual Quote 1040 pricing evidence" className={s['evidence-economics']}>
                <div className={s['econ-card']}><small>Raw material cost</small><strong>US$4,820.35</strong><span>USD equivalent across the measured roofing components.</span></div>
                <div className={s['econ-card']}><small>Raw labour cost</small><strong>US$1,728.70</strong><span>USD equivalent of labour rules from the saved component library.</span></div>
                <div className={s['econ-card']}><small>Raw job cost</small><strong>US$6,549.05</strong><span>USD equivalent before the customer-facing margin.</span></div>
                <div className={c('econ-card', 'accent')}><small>Customer quote</small><strong>US$8,859.92</strong><span>US$7,704.28 subtotal equivalent + 15% GST in the original NZD quote.</span></div>
              </div>
              <details className={c('disclosure', 'disclosure-evidence')}>
                <summary>
                  <div className={s['summary-copy']}>
                    <strong>Audit the full component-by-component pricing evidence</strong>
                    <small>Measured plan, pitch treatment, waste, quoted quantity, material rate, labour rate and raw component cost for Quote #1040.</small>
                  </div>
                </summary>
                <div className={s['disclosure-body']}>
                  <p className={s['normalisation-note']}>
                    Display normalization: the original recorded benchmark and Quote #1040 remain in NZD and imperial units. For consistency on this page, pricing summaries are shown as USD equivalents using the 26 Oct 2026 reference rate of 1 NZD = US$0.570155. Area-based measurements are shown in roofing squares (1 RS = 100 sq ft); linear roof components remain in feet.
                  </p>
                  <div className={c('component-layout')}>
                    <div className={s['component-plan']}>
                      <div className={s['roof-placeholder']}>
                        <div className={c('roof-canvas', 'real')}>
                          <img alt="Measured benchmark roof plan with component geometry" className={s['evidence-img']} src={IMG.measured} />
                        </div>
                        <div className={s['roof-caption']}>
                          <span><strong>Actual measured roof</strong><br />Component geometry from Quote #1040.</span>
                        </div>
                      </div>
                    </div>
                    <div className={s['component-list']}>
                      {components.map((comp) => (
                        <article className={s['component-row']} key={comp.name}>
                          <div className={s['component-head']}>
                            <h3>{comp.name}</h3>
                            <span className={s['component-badge']}>{comp.badge}</span>
                          </div>
                          <div className={s['calc-grid']}>
                            {comp.calc.map((cell) => (
                              <div className={s.calc} key={cell.label}>
                                <small>{cell.label}</small>
                                <b>{cell.value}</b>
                              </div>
                            ))}
                          </div>
                          <div className={s['component-total']}>
                            Material <strong>{comp.total.material[0]}</strong> → {comp.total.material[1]} · Labour <strong>{comp.total.labour[0]}</strong> → {comp.total.labour[1]} · <em>{comp.total.sum}</em>
                          </div>
                        </article>
                      ))}
                      <p className={s['component-source-note']}>
                        Actual component data from Quote #1040. USD figures are display equivalents converted from the original NZD quote at 1 NZD = US$0.570155 (26 Oct 2026). Area measurements use roofing squares; linear components use feet. Component costs shown are raw material and labour costs before margin. Roof plan calibrated at 25° pitch; pitch factor 1.1034 where applicable.
                      </p>
                    </div>
                  </div>
                </div>
              </details>
            </div>
          </section>

          {/* ===== CUSTOMER QUOTE ===== */}
          <section className={c('section', 'section-white')} id="customer-quote-evidence">
            <div className={s.container}>
              <div className={s['section-copy']}>
                <div className={s.eyebrow}>What the customer sees</div>
                <h2>Complex estimating in. Clean customer quote out.</h2>
                <p>The internal takeoff and pricing logic does not need to overwhelm the homeowner. Quote #1040 becomes a clean, editable customer-facing quote that can be sent, accepted, changed, declined or downloaded as a PDF.</p>
              </div>
              <div className={s['quote-evidence']}>
                <img alt="Actual final customer quotation 1040 produced by the benchmark workflow" src={IMG.quote} />
              </div>
            </div>
          </section>

          {/* ===== SMART ASSISTANT ===== */}
          <section className={c('section', 'section-dark')} id="assistant">
            <div className={c('container', 'assistant-grid')}>
              <div className={c('assistant-copy')}>
                <div className={s.eyebrow}>Already measured the roof?</div>
                <h2>Already have the measurements? Build the same quote in seconds.</h2>
                <p>If the roof has already been measured, Smart Assistant can take the known quantities, match them to your saved roofing library, and build the same priced job without redrawing the roof.</p>
                <div className={s['assistant-time']}>
                  <strong className={c('gradient-time', 'assistant-gradient-time')}>0:17</strong>
                  <small>Same roof. Measurements known before the timer starts.</small>
                </div>
                <div className={s['assistant-note']}>
                  <strong>Same roofing library, different starting line:</strong> the 17-second test begins after takeoff is complete. The 2:27 benchmark starts earlier, from the unmeasured architectural plan.
                </div>
                <div style={{ marginTop: 24, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <a className={c('button', 'button-primary')} href="/demo" {...EXT}>Try Smart Assistant in the demo</a>
                  <a className={c('button', 'button-secondary')} href="/pricing" {...EXT}>Build your plan</a>
                </div>
              </div>
              <div className={s['assistant-visual']}>
                <div aria-label="Actual QuoteCore+ Smart Assistant mobile interface" className={s['assistant-phone-wrap']}>
                  <div className={s['assistant-phone-shell']}>
                    <div aria-hidden="true" className={s['assistant-phone-speaker']}></div>
                    <img alt="Actual QuoteCore+ Smart Assistant voice interface on mobile" className={s['assistant-phone-shot']} src={IMG.assistant} />
                  </div>
                  <div className={s['assistant-prompt-card']}>
                    <span>Voice prompt for this same roof</span>
                    <p>
                      Create a quote with <strong>673.3 ft Corrugate .40g</strong>, <strong>17.9 RS screws</strong>, <strong>17.1 RS roofing underlay</strong>, <strong>34.5 ft ridge</strong>, <strong>144.5 ft hip flashing</strong>, <strong>70.7 ft valley flashing</strong>, <strong>15.3 ft barge flashing</strong>, and <strong>166.3 ft half-round spouting</strong>. Use our saved roofing library.
                    </p>
                  </div>
                </div>
                <div className={c('assistant-result', 'qcp-result')}>
                  <div className={s['result-head']}>
                    <span>QC+ quote draft</span>
                    <span className={c('gradient-time', 'result-time')}>0:17</span>
                  </div>
                  {resultLines.map(([label, value]) => (
                    <div className={s['result-line']} key={label}><span>{label}</span><b>{value}</b></div>
                  ))}
                  <div className={s['result-summary']}><span>Saved pricing + labour rules applied</span><b>US$7,704.28 subtotal</b></div>
                  <div className={s['result-total']}><span>Customer total</span><span>US$8,859.92</span></div>
                </div>
              </div>
            </div>
          </section>

          {/* ===== COMPARISON ===== */}
          <section className={c('section', 'section-white')} id="comparison">
            <div className={s.container}>
              <div className={s['section-intro']}>
                <div className={s['section-copy']}>
                  <div className={s.eyebrow}>Fastest roofing software comparison</div>
                  <h2>What is faster than 2:27, and is it measuring the same job?</h2>
                  <p>RoofSnap, Roofr, RoofCAD, ServiceTitan, HOVER and AccuLynx all publish speed-oriented roofing claims. The important question is what the timer starts with and what the published result actually includes.</p>
                </div>
                <div className={s['aside-copy']}>
                  We use each vendor’s own public wording and link the source. <strong>Different scope is not a criticism</strong>, it is simply why the headline times are not automatically comparable.
                </div>
              </div>
              <div className={s['comparison-focus']}>
                {comparisonFocus.map((item) => (
                  <div key={item.vendor}>
                    <small>{item.vendor}</small>
                    <strong>{item.claim}</strong>
                    <span>{item.body}</span>
                    <a href={item.href} {...EXT}>Official source →</a>
                  </div>
                ))}
              </div>
              <details className={s.disclosure}>
                <summary>
                  <div className={s['summary-copy']}>
                    <strong>Compare QuoteCore+ with RoofSnap, Roofr, RoofCAD, ServiceTitan, HOVER and AccuLynx</strong>
                    <small>Expand for the published timing claim, starting point, output, scope match and official source links.</small>
                  </div>
                </summary>
                <div className={s['disclosure-body']}>
                  <div className={s['speed-table-wrap']}>
                    <table className={s['speed-table']}>
                      <thead>
                        <tr>
                          <th>Platform</th>
                          <th>Published time</th>
                          <th>Timer starts with</th>
                          <th>Published claim covers</th>
                          <th>Same benchmark?</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonRows.map((row) => (
                          <tr className={row.ours ? s.ours : undefined} key={row.platform}>
                            <td data-label="Platform">{row.platform}</td>
                            <td className={s['time-col']} data-label="Published time">
                              {row.ours ? <span className={c('gradient-time', 'gradient-time-inline')}>{row.time}</span> : row.time}
                            </td>
                            <td data-label="Timer starts with">{row.starts}</td>
                            <td data-label="Published claim covers">{row.covers}</td>
                            <td data-label="Same benchmark?">
                              <span className={row.match.kind === 'same' ? c('match', 'same') : c('match', 'diff')}>{row.match.label}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className={s['table-note']}>
                    * ServiceTitan’s approximately two-minute figure is from its 2026 Summit Roofing customer story and describes salespeople building and presenting estimates in the field. It is not published as a blank-plan-to-sent-quote test. ** HOVER states its one-hour expedited roof measurement delivery excludes blueprint uploads. Vendor claims and product workflows can change.
                  </div>
                  <div className={s['source-row']}>
                    <a href="https://roofsnap.com/solutions/instant-roof-estimates/" {...EXT}>RoofSnap official source</a>
                    <a href="https://roofr.com/estimator" {...EXT}>Roofr official source</a>
                    <a href="https://www.roofcad.com/" {...EXT}>RoofCAD official source</a>
                    <a href="https://www.servicetitan.com/blog/success-story-summit-roofing-revenue-growth" {...EXT}>ServiceTitan official source</a>
                    <a href="https://hover.to/pricing/" {...EXT}>HOVER official source</a>
                    <a href="https://acculynx.com/integrations/gaf-quickmeasure/" {...EXT}>AccuLynx / GAF official source</a>
                  </div>
                  <div className={s['source-note']}>
                    <strong>Method:</strong> We compare the vendor’s own published speed claim with the starting point and output that vendor describes. We do not convert unlike workflows into an invented equivalent time. Claims reviewed 27 October 2026.
                  </div>
                </div>
              </details>
            </div>
          </section>

          {/* ===== CHALLENGE ===== */}
          <section aria-labelledby="challenge-title" className={s['challenge-section']}>
            <div className={c('container', 'challenge-card')}>
              <div>
                <div className={s.eyebrow}>Keep the benchmark honest</div>
                <h2 id="challenge-title">Found a faster equivalent multi-face roof workflow? Send it.</h2>
                <p>
                  The claim on this page is intentionally testable: <strong>unmeasured multi-face pitched residential roof plan → takeoff → contractor-specific pricing → editable customer quote → sent.</strong> If another publicly demonstrated product completes that same workflow faster than 2:27, send us the evidence and we will review the page.
                </p>
                <div className={s['challenge-rule']}>
                  <strong>Same starting line:</strong> no existing roof report, no pre-entered squares, no previously measured quantities.
                </div>
              </div>
              <div className={s['challenge-actions']}>
                <a className={c('button', 'button-primary')} href="/contact" {...EXT}>Send us a faster workflow</a>
                <a className={c('button', 'button-secondary')} href="#comparison">Review the benchmark</a>
              </div>
            </div>
          </section>

          {/* ===== AFTER THE BENCHMARK ===== */}
          <section className={c('section', 'section-muted')}>
            <div className={s.container}>
              <div className={s['section-intro']}>
                <div className={s['section-copy']}>
                  <div className={s.eyebrow}>After the benchmark</div>
                  <h2>The sent quote stays connected to the job.</h2>
                  <p>The 2:27 benchmark stops at “sent”, but QuoteCore+ does not. Open/read status, customer decisions, follow-up and downstream documents can stay on the same job.</p>
                </div>
              </div>
              <details className={c('disclosure', 'secondary-disclosure')}>
                <summary>
                  <div className={s['summary-copy']}>
                    <strong>Show what happens after the quote is sent</strong>
                    <small>Open/read tracking, accept/decline status, follow-up and reuse of the same job data.</small>
                  </div>
                </summary>
                <div className={s['disclosure-body']}>
                  <div className={s['after-grid']}>
                    <div className={s['event-list']}>
                      <div className={s.event}>
                        <div className={s['event-icon']}><MailIcon /></div>
                        <strong>Sent</strong>
                        <span>Send the professional customer quote directly from QuoteCore+.</span>
                      </div>
                      <div className={s.event}>
                        <div className={s['event-icon']}><EyeIcon /></div>
                        <strong>Opened / read</strong>
                        <span>See when the customer opens and reads the quote. It is a useful signal for knowing when a follow-up is likely to be well timed.</span>
                      </div>
                      <div className={s.event}>
                        <div className={s['event-icon']}><TickIcon /></div>
                        <strong>Accepted / declined</strong>
                        <span>Quote status updates when the customer makes a decision, so you are not relying on memory or inbox hunting.</span>
                      </div>
                      <div className={s.event}>
                        <div className={s['event-icon']}><ChatIcon /></div>
                        <strong>Automatic follow-up</strong>
                        <span>Create time- or event-based follow-ups with cancellation rules when the customer responds.</span>
                      </div>
                    </div>
                    <div>
                      <h3 style={{ fontSize: 28 }}>Won the job? Keep using the same data.</h3>
                      <p style={{ marginTop: 14, fontSize: 17 }}>Once the quote moves forward, the same job information can be reused downstream instead of being typed into another document from scratch.</p>
                      <div className={s['post-quote-note']}>
                        <DocIcon />
                        <div>
                          <strong>Create the next document in a couple of clicks.</strong>
                          <span>Use the quote data to create a purchase order or invoice, carrying the job information forward rather than rebuilding it.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </details>
            </div>
          </section>

          {/* ===== DFY ===== */}
          <section className={c('section', 'section-white')}>
            <div className={s.container}>
              <div className={s['dfy-card']}>
                <div>
                  <div className={s.eyebrow} style={{ marginBottom: 14 }}>Pricing setup is required</div>
                  <h2 style={{ fontSize: 'clamp(30px,3vw,42px)' }}>For benchmark-level speed, QuoteCore+ needs to know how your business prices.</h2>
                  <p>Your products, labour, coverage, waste, margin and pricing rules need to be configured before they can be reused automatically. Build that library yourself, or use Done For You Setup and show us how you quote today so we can help translate the workflow into QuoteCore+.</p>
                </div>
                <div className={s['dfy-actions']}>
                  <a className={c('button', 'button-primary')} href="/done-for-you-setup" {...EXT}>See Done For You Setup</a>
                  <a className={c('button', 'button-secondary')} href={BOOK} {...EXT}>Book a demo with your roof plan</a>
                </div>
              </div>
            </div>
          </section>

          {/* ===== FAQ ===== */}
          <section className={c('section', 'section-muted')} id="faq">
            <div className={s.container}>
              <div className={s['section-intro']}>
                <div className={s['section-copy']}>
                  <div className={s.eyebrow}>Fast roofing estimating software FAQ</div>
                  <h2>The important questions, without the sales fog.</h2>
                  <p>Everything stays collapsed until you want the detail. The answers define the benchmark, roof type, setup requirement and comparison scope.</p>
                </div>
              </div>
              <details className={c('disclosure', 'disclosure-faq')}>
                <summary>
                  <div className={s['summary-copy']}>
                    <strong>Show the most common roofing estimating questions</strong>
                    <small>Expand to view the full FAQ list, then open any question you want.</small>
                  </div>
                </summary>
                <div className={s['disclosure-body']}>
                  <div className={s['faq-list']}>
                    {faqs.map((faq) => (
                      <details className={s.faq} key={faq.question}>
                        <summary>
                          <span>{faq.question}</span>
                          <span className={s.faqIcon} aria-hidden="true"></span>
                        </summary>
                        <div className={s['faq-content']}>{faq.answer}</div>
                      </details>
                    ))}
                  </div>
                </div>
              </details>
            </div>
          </section>

          {/* ===== FINAL CTA ===== */}
          <section className={c('section', 'final')}>
            <div className={s.container}>
              <div className={s['final-card']}>
                <div>
                  <div className={s.eyebrow}>Put your own roof plan on screen</div>
                  <h2>See whether QuoteCore+ is faster on the work you actually quote.</h2>
                  <p>Send us a residential roof plan you would normally measure and price. On a free tailored demo we can show how that roof would move through takeoff, your pricing structure and the customer quote, and explain what needs to be configured to get repeatable speed.</p>
                </div>
                <div className={s['final-actions']}>
                  <a className={c('button', 'button-primary')} href={BOOK} {...EXT}>Book a demo with your roof plan</a>
                  <a className={c('button', 'button-light')} href="/demo" {...EXT}>Try the guided demo</a>
                  <a className={c('button', 'button-ghost')} href="/pricing" {...EXT}>See pricing &amp; build your plan →</a>
                </div>
              </div>
            </div>
          </section>
        </div>
      </EvidenceZoomRoot>
    </PageScaffold>
  );
}
