import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import YouTubeLite from '@/components/YouTubeLite';
import { MarketingButton } from '@/components/marketing/MarketingButton';
import { buildBreadcrumbSchema, buildFaqSchema, buildSoftwareApplicationSchema, siteUrl } from '@/lib/schema';
import { hreflangLanguages } from '@/lib/seo/hreflang';
import { takeoffMedia, takeoffVideoSchema, validTakeoffVideoId } from './media';
import styles from './RoofTakeoff.module.css';

const path = '/roofing-takeoff-software';
const canonical = `${siteUrl}${path}`;
const title = 'AI Roof Takeoff: Plans & Satellite Images | QuoteCore+';
const description = 'AI roof measurement from plans, blueprints or uploaded satellite images. Calibrate, scan or trace manually, edit every roof component and apply saved pricing.';

export const metadata: Metadata = {
  title: { absolute: title }, description,
  alternates: { canonical, languages: hreflangLanguages(path) },
  robots: { index: true, follow: true },
  openGraph: { title, description, url: canonical, siteName: 'QuoteCore+', type: 'website',
    images: [{ url: `${siteUrl}/og-image.jpg`, width: 1200, height: 630, alt: 'QuoteCore+ digital roof takeoff software' }] },
  twitter: { card: 'summary_large_image', title, description, images: [`${siteUrl}/og-image.jpg`] },
};

const faqs = [
  {
    question: 'Can I measure a roof from satellite images without visiting the site?',
    answer: 'Yes. Upload a clear overhead or satellite roof image, calibrate it using a reliable known dimension, then trace the roof manually or use Roof Scan Assist. QuoteCore+ does not automatically fetch satellite imagery from a street address. Verify dimensions, roof pitch and any obscured areas before quoting.',
  },
  {
    question: 'Can AI measure a roof from satellite images or PDF plans?',
    answer: 'Yes. Roof Scan Assist works with suitable calibrated roof plans, architectural drawings and uploaded satellite or overhead images. Image quality, scale, lighting, shadows, tree cover and roof complexity affect how accurately it identifies roof geometry. You can inspect, edit, add or redraw measurements before accepting the result.',
  },
  {
    question: 'Can I measure a roof from an architectural PDF or blueprint without printing it?',
    answer: 'Yes. Upload a clear architectural roof drawing, blueprint or PDF plan, calibrate a known distance, and measure areas and roof lines on screen. You can also use an uploaded satellite image. Check the scale and pitch before finalising quantities.',
  },
  {
    question: 'Is there a free roof takeoff tool?',
    answer: 'Yes. The standalone Free Roof Takeoff tool lets you upload your own plan or image, calibrate it, measure and review a report without signing up. Roof Scan Assist access is subject to device credits and availability. A Free Workspace adds saved jobs and reusable pricing libraries, subject to plan limits.',
  },
  {
    question: 'Are roof measurements priced automatically as I draw or use AI?',
    answer: 'Yes. With your saved Smart Components and pricing library configured, a completed roof area or line can calculate the linked component price from its measurement and your rules. Manual and AI-assisted takeoffs use the same pricing workflow. Review the priced takeoff, then continue to a customer quote without typing those measurements again.',
  },
];

type IconKind = 'arrow' | 'check' | 'ruler' | 'scan' | 'layers' | 'file' | 'sparkles' | 'upload' | 'edit';
function Icon({ kind }: { kind: IconKind }) {
  const shapes: Record<IconKind, ReactNode> = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    ruler: <><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 6v4m4-4v3m4-3v4m4-4v3"/></>,
    scan: <><path d="M4 9V5a1 1 0 0 1 1-1h4m6 0h4a1 1 0 0 1 1 1v4m0 6v4a1 1 0 0 1-1 1h-4m-6 0H5a1 1 0 0 1-1-1v-4"/><path d="m7 13 3-4 3 4 4-5"/></>,
    layers: <><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></>,
    sparkles: <><path d="m12 3 1.8 5.5L20 11l-6.2 2.5L12 19l-1.8-5.5L4 11l6.2-2.5Z"/><path d="m19 18 .6 1.4L21 20l-1.4.6L19 22l-.6-1.4L17 20l1.4-.6Z"/></>,
    upload: <><path d="M12 16V3m-4 4 4-4 4 4"/><path d="M4 16v4h16v-4"/></>,
    edit: <><path d="m4 20 4-1 11-11a2 2 0 0 0-3-3L5 16l-1 4Z"/><path d="m14 7 3 3"/></>,
  };
  return <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{shapes[kind]}</svg>;
}

export default function RoofingTakeoffSoftwarePage() {
  const videoId = validTakeoffVideoId(takeoffMedia.videoId);
  const videoSchema = takeoffVideoSchema();
  const schemas = [
    buildBreadcrumbSchema([{ name: 'Home', url: `${siteUrl}/` }, { name: 'Roof Takeoff Software', url: canonical }]),
    { '@context': 'https://schema.org', ...buildSoftwareApplicationSchema() },
    buildFaqSchema(faqs),
    ...(videoSchema ? [videoSchema] : []),
  ];
  return <>
    {schemas.map((schema, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />)}
    <BlogHeader />
    <main className={styles.root}>
      {/* 01: Light hero. Visible first-screen search intent and the two real destinations. */}
      <section className={`${styles.section} ${styles.hero}`} aria-labelledby="takeoff-title">
        <div className={`${styles.wrap} ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>AI roof measurement · Manual digital takeoff</p>
            <h1 id="takeoff-title">Measure roofs from plans or satellite images. <span className={styles.gradientText}>With or without AI.</span></h1>
            <p className={styles.heroLead}>Measure from a PDF roof plan, architectural drawing, blueprint or uploaded satellite image. Trace roof areas and lines yourself, or use editable <strong>Roof Scan Assist</strong>. Your completed measurements are priced using your saved components and flow straight into a customer quote. <strong>No measuring twice or re-entering numbers.</strong></p>
            <div className={styles.actions} data-analytics-surface="roof_takeoff_hero" data-analytics-location="roof_takeoff_hero">
              <MarketingButton href="/signup" variant="primary" size="large" className={styles.primaryCta}>Create Free Workspace <Icon kind="arrow" /></MarketingButton>
              <MarketingButton href="/free-roof-takeoff" variant="glass" size="large" className={styles.secondaryCta}>Try Free Roof Takeoff</MarketingButton>
            </div>
            <p className={styles.reassurance}><Icon kind="check" /> No credit card · Manual takeoff available free · AI subject to credits</p>
            {videoId ? <a href="#takeoff-tutorial" className={styles.tutorialLink}>Watch the takeoff tutorial <span aria-hidden="true">↓</span></a> : null}
          </div>
          <aside className={styles.videoCard} id="takeoff-tutorial" aria-label="Digital roof takeoff demonstration" data-analytics-surface="roof_takeoff_video" data-analytics-location="roof_takeoff_hero">
            <div className={styles.videoTop}><span className={styles.statusDot} /> DIGITAL ROOF TAKEOFF <span>QUOTECORE+</span></div>
            {videoId ? <YouTubeLite videoId={videoId} title="How to measure roofs from plans and satellite images in QuoteCore+" className={styles.videoEmbed} uploadDate={takeoffMedia.videoUploadDate} /> :
              <div className={styles.videoPlaceholder}>
                {/* Existing real screenshot, not a simulated playable video. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/marketing/home/takeoff-workspace-v2.webp" alt="QuoteCore+ digital roof takeoff showing editable roof geometry over a satellite image" loading="eager" />
                <span className={styles.videoOverlay}><strong>See the real takeoff workflow</strong><span>Your YouTube tutorial goes here</span></span>
              </div>}
            <p className={styles.videoCaption}>See the connected workflow: roof image, editable measurements, automatic component pricing and a quote.</p>
          </aside>
        </div>
      </section>

      {/* 02: Dark method chooser, with editable AI outcomes as the differentiator. */}
      <section className={`${styles.section} ${styles.dark}`} aria-labelledby="methods-title">
        <div className={styles.wrap}>
          <p className={styles.eyebrow}>Two ways to measure</p>
          <h2 id="methods-title">You choose how much <span className={styles.darkAccent}>AI helps.</span></h2>
          <div className={styles.methodGrid}>
            <Link href="/features/digital-roof-takeoff" className={styles.methodCard} data-analytics-surface="roof_takeoff_manual" data-analytics-location="roof_takeoff_methods">
              <div className={styles.methodTitle}><span className={styles.methodIcon}><Icon kind="ruler" /></span><div><span className={styles.methodLabel}>YOUR CONTROL</span><h3>Measure it yourself</h3></div></div>
              <p>Calibrate your plan or satellite image, then draw a roof area, ridge, hip, valley, barge or rake. As you complete each area or line, its linked component calculates the price using your saved rates.</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.methodImage} src="/marketing/current-ux/digital-takeoff-manual.webp" alt="Manual tracing of roof areas and lengths in the QuoteCore+ Digital Takeoff workspace" loading="lazy" />
              <span className={styles.methodAction}>Explore manual takeoff <Icon kind="arrow" /></span>
            </Link>
            <Link href="/features/ai-scan-assist" className={styles.methodCard} data-analytics-surface="roof_takeoff_ai" data-analytics-location="roof_takeoff_methods">
              <div className={styles.methodTitle}><span className={styles.methodIcon}><Icon kind="scan" /></span><div><span className={styles.methodLabel}>AI-ASSISTED</span><h3>Let Roof Scan Assist help</h3></div></div>
              <p>Upload and calibrate a roof plan <strong>or satellite image</strong>. AI Roof Scan Assist proposes roof outlines, areas and component lines. Review, move or redraw them, then use the same automatic pricing.</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.methodImage} src="/marketing/current-ux/ai-scan-assist-completed-roof.webp" alt="Editable roof geometry after an AI Roof Scan Assist takeoff in QuoteCore+" loading="lazy" />
              <span className={styles.methodAction}>Explore AI Roof Scan Assist <Icon kind="arrow" /></span>
            </Link>
          </div>
          <div className={styles.qualityNote}><Icon kind="edit" /><p><strong>AI roof measurement you can correct.</strong> Upload a clear, correctly calibrated plan or satellite image for the best result. Shadows, trees, low resolution and complex roofs can reduce accuracy. Inspect and edit the suggested outlines, roof areas and lines before pricing the job.</p></div>
        </div>
      </section>

      {/* 03: Light proof, pricing bridge and concise discoverable answers. */}
      <section className={`${styles.section} ${styles.result}`} aria-labelledby="result-title">
        <div className={styles.wrap}>
          <div className={styles.resultHead}><div><p className={styles.eyebrow}>Every measurement counts</p><h2 id="result-title">Draw it or scan it. <span className={styles.gradientText}>The price follows.</span></h2></div><p>Each measured area or line connects to its saved pricing component. QuoteCore+ applies your material, labour, pitch and waste rules, then carries the same quantities into your customer quote.</p></div>
          <ol className={styles.flowSteps} aria-label="From roof measurement to customer quote"><li><strong>01</strong><span>Draw or scan the roof</span></li><li><strong>02</strong><span>Components price automatically</span></li><li><strong>03</strong><span>Review and send the quote</span></li></ol>
          <div className={styles.resultsGrid}>
            <figure className={styles.exampleCard}>
              <div className={styles.exampleHeader}>01 / MEASURE &amp; PRICE</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/marketing/home/demo/demo-02-takeoff.webp" alt="Roof plan showing digital measurement of roof features inside the QuoteCore+ takeoff workstation" loading="lazy" />
              <figcaption><strong>Each roof component is measured and priced</strong><span>Draw it yourself or edit the AI result. Your saved rates do the maths.</span></figcaption>
            </figure>
            <span className={styles.betweenArrow} aria-hidden="true"><Icon kind="arrow" /></span>
            <figure className={styles.exampleCard}>
              <div className={styles.exampleHeader}>02 / REVIEW YOUR QUOTE</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/marketing/current-ux/quote-builder-components-measurements.webp" alt="QuoteCore+ quote builder using roofing quantities and saved pricing components" loading="lazy" />
              <figcaption><strong>Your priced job is already there</strong><span>Check the materials and labour, then prepare the customer quote. No re-entry.</span></figcaption>
            </figure>
          </div>
          <div className={styles.routeLinks}>
            <Link href="/roofing-pricing-setup" data-analytics-surface="roof_takeoff_pricing_step" data-analytics-location="roof_takeoff_related"><span><span className={styles.currencyGlyph} aria-hidden="true">$</span></span><span><strong>Need to set up your pricing?</strong><small>Enter your rates or import a price list with AI</small></span><Icon kind="arrow" /></Link>
            <Link href="/roof-measurements-to-price" data-analytics-surface="roof_takeoff_existing_measurements" data-analytics-location="roof_takeoff_related"><span><Icon kind="ruler" /></span><span><strong>Already have measurements?</strong><small>Price your existing quantities with saved rates</small></span><Icon kind="arrow" /></Link>
          </div>
          <p className={styles.researchNote}>Measuring remotely? Read our <Link href="/research/google-earth-roof-measurement-accuracy">ten-roof Google Earth measurement study</Link> for real comparisons and limitations.</p>
          <div className={styles.faq} aria-labelledby="faq-title">
            <h3 id="faq-title">Common questions</h3>
            {faqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}
          </div>
        </div>
      </section>

      {/* 04: Dark final CTA. Each choice is a complete, clickable card. */}
      <section className={`${styles.section} ${styles.closing}`} aria-labelledby="closing-title">
        <div className={styles.wrap}>
          <p className={styles.eyebrow}>Start measuring</p>
          <h2 id="closing-title">From roof image to roof quote, <span className={styles.darkAccent}>your way.</span></h2>
          <div className={styles.compareGrid}>
            <Link href="/signup" className={`${styles.compareCard} ${styles.featured}`} data-analytics-surface="roof_takeoff_workspace" data-analytics-location="roof_takeoff_footer" aria-label="Create your Free Workspace to save takeoffs, use your pricing libraries and build quotes">
              <div className={styles.compareTop}><span>FOR YOUR REAL JOBS</span><strong>RECOMMENDED</strong></div>
              <div className={styles.compareTitle}><h3>QuoteCore+ Free Workspace</h3></div>
              <p>Save your takeoffs, use your pricing library for automatic component prices, and build customer quotes without re-entering measurements. Manual and AI options, subject to free limits.</p>
              <span className={styles.compareAction}>Create Free Workspace <Icon kind="arrow" /></span>
            </Link>
            <Link href="/free-roof-takeoff" className={`${styles.compareCard} ${styles.standalone}`} data-analytics-surface="roof_takeoff_free_tool" data-analytics-location="roof_takeoff_footer" aria-label="Open the standalone free roof takeoff tool without signing up">
              <div className={styles.compareTop}><span>FOR A QUICK TAKEOFF</span></div>
              <div className={styles.compareTitle}><h3>Standalone free roof tool</h3></div>
              <p>Upload your own plan or overhead image, calibrate and measure in the browser. No signup needed. AI access depends on device credits.</p>
              <span className={styles.compareAction}>Try Free Roof Takeoff <Icon kind="arrow" /></span>
            </Link>
          </div>
        </div>
      </section>
    </main>
    <SiteFooter />
  </>;
}
