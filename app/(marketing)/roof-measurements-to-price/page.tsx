import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import YouTubeLite from '@/components/YouTubeLite';
import { MarketingButton } from '@/components/marketing/MarketingButton';
import { buildBreadcrumbSchema, buildSoftwareApplicationSchema, siteUrl } from '@/lib/schema';
import { hreflangLanguages } from '@/lib/seo/hreflang';
import { measurementsMedia, measurementsVideoSchema, safeMeasurementImage, validYouTubeId } from './media';
import styles from './MeasurementsToPrice.module.css';

const path = '/roof-measurements-to-price';
const canonical = `${siteUrl}${path}`;
const pageTitle = 'Roof Measurements to Quote with AI Import | QuoteCore+';
const description = 'Turn existing roof measurements into a quote. Use AI to extract areas and quantities from handwritten notes, photos, PDFs or spreadsheets, or type them in.';

export const metadata: Metadata = {
  title: { absolute: pageTitle },
  description,
  alternates: { canonical, languages: hreflangLanguages(path) },
  robots: { index: true, follow: true },
  openGraph: {
    title: pageTitle, description, url: canonical, siteName: 'QuoteCore+', type: 'website',
    images: [{ url: `${siteUrl}/og-image.jpg`, width: 1200, height: 630, alt: 'Turn roof measurements into a priced quote with QuoteCore+' }],
  },
  twitter: { card: 'summary_large_image', title: pageTitle, description, images: [`${siteUrl}/og-image.jpg`] },
};

type IconKind = 'keyboard' | 'sparkles' | 'file' | 'check' | 'arrow' | 'layers' | 'quote';
function Icon({ kind }: { kind: IconKind }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const pathData: Record<IconKind, ReactNode> = {
    keyboard: <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10"/></>,
    sparkles: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2Z"/><path d="m19 18 .7 1.3L21 20l-1.3.7L19 22l-.7-1.3L17 20l1.3-.7Z"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></>,
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    layers: <><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></>,
    quote: <><path d="M7 9h10M7 13h8M7 17h5"/><rect x="3" y="3" width="18" height="19" rx="2"/></>,
  };
  return <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" {...common}>{pathData[kind]}</svg>;
}

function ExampleImage({ kind, image }: { kind: 'before' | 'after'; image: string }) {
  const before = kind === 'before';
  const safe = safeMeasurementImage(image);
  return <figure className={styles.exampleCard}>
    <div className={styles.exampleHeader}><span>{before ? '01 / BEFORE' : '02 / AFTER'}</span><span className={styles.exampleTag}>{before ? 'YOUR MEASUREMENTS' : 'YOUR PRICED JOB'}</span></div>
    {safe ? (
      // User-supplied tutorial screenshots, with the same demonstration job.
      // eslint-disable-next-line @next/next/no-img-element
      <img className={styles.exampleImage} src={safe} loading="lazy" alt={before ? 'Handwritten roof measurements and quantities supplied for the demonstration job' : 'The same roof measurements priced in QuoteCore+ using a selected saved pricing library'} />
    ) : <div className={styles.imagePlaceholder} aria-label={`${before ? 'Measurement source' : 'Priced estimate'} screenshot pending`}>
      <Icon kind={before ? 'file' : 'quote'} />
      <strong>{before ? 'Your handwritten roof measurements' : 'Your priced roofing job'}</strong>
      <span>Real example screenshot from your tutorial</span>
    </div>}
    <figcaption><strong>{before ? 'Before: notes from the job' : 'After: your priced roofing job'}</strong><span>{before ? 'The measurements you already wrote down.' : 'The same quantities, priced with your saved rules.'}</span></figcaption>
  </figure>;
}

export default function RoofMeasurementsToPricePage() {
  const videoId = validYouTubeId(measurementsMedia.videoId);
  const videoSchema = measurementsVideoSchema();
  const schemas = [
    buildBreadcrumbSchema([{ name: 'Home', url: `${siteUrl}/` }, { name: 'Roof measurements to price', url: canonical }]),
    { '@context': 'https://schema.org', ...buildSoftwareApplicationSchema() },
    ...(videoSchema ? [videoSchema] : []),
  ];

  return <>
    {schemas.map((schema, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />)}
    <BlogHeader />
    <main className={styles.root}>
      <section className={`${styles.section} ${styles.hero}`} aria-labelledby="measurements-title">
        <div className={`${styles.wrap} ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Roof quantities to price · Manual or AI import</p>
            <h1 id="measurements-title">Already have roof measurements? <span className={styles.gradientText}>Turn them into a priced quote.</span></h1>
            <p className={styles.heroLead}>Have roof areas, lengths or quantities from a site measure, aerial report or handwritten notes? Type them in, or let AI extract the quantities from a photo, PDF or spreadsheet. QuoteCore+ uses <strong>your selected pricing library</strong> to calculate the job and build a customer quote.</p>
            <div className={styles.actions} data-analytics-surface="measurements_price_hero" data-analytics-location="measurements_price_hero">
              <MarketingButton href="/signup" variant="primary" size="large" className={styles.primaryCta}>Create Free Workspace <Icon kind="arrow" /></MarketingButton>
              <MarketingButton href="/measurement-to-quote-tool?trade=roofing" variant="glass" size="large" className={styles.secondaryCta}>Try the standalone free tool</MarketingButton>
            </div>
            <p className={styles.reassurance}><Icon kind="check" /> Free Workspace: saved pricing and jobs · No credit card</p>
            {videoId ? <a href="#measurement-tutorial" className={styles.watchLink}>Watch the walkthrough <span aria-hidden="true">↓</span></a> : null}
          </div>
          <aside id="measurement-tutorial" className={styles.videoCard} aria-label="Measurements to quote walkthrough" data-analytics-surface="measurements_price_video" data-analytics-location="measurements_price_hero">
            <div className={styles.videoTop}><span className={styles.statusDot} /> MEASUREMENTS TO PRICE <span>QUOTECORE+</span></div>
            {videoId ? <YouTubeLite videoId={videoId} title="How to turn roof measurements into pricing and a quote in QuoteCore+" className={styles.videoEmbed} uploadDate={measurementsMedia.videoUploadDate} /> :
              <div className={styles.videoPlaceholder}>
                {/* Existing product screenshot, not a simulated video player. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/marketing/current-ux/quote-builder-components-measurements.webp" alt="QuoteCore+ quote builder showing roofing components and measured quantities" loading="eager" />
                <div className={styles.videoOverlay}><strong>See the real workflow</strong><span>Your YouTube tutorial will appear here.</span></div>
              </div>}
            <p className={styles.videoCaption}>Measurements in. Your pricing applied. A customer quote in a few more clicks.</p>
          </aside>
        </div>
      </section>

      <section id="measurement-options" className={`${styles.section} ${styles.dark}`} aria-labelledby="options-title">
        <div className={styles.wrap}>
          <p className={styles.eyebrow}>Two ways to get the quantities in</p>
          <h2 id="options-title">You&apos;ve measured it. <span className={styles.darkAccent}>We&apos;ll help price it.</span></h2>
          <div className={styles.methodGrid}>
            <article className={styles.methodCard}>
              <div className={styles.methodIcon}><Icon kind="keyboard" /></div>
              <div><h3>Enter them yourself</h3><p>Type in your roof areas, lengths or quantities. QuoteCore+ calculates the price instantly using your saved rates <span className={styles.prerequisite}>(once your pricing is set up).</span></p><span className={styles.methodFoot}>TYPE &amp; PRICE</span></div>
            </article>
            <article className={styles.methodCard}>
              <div className={styles.methodIcon}><Icon kind="sparkles" /></div>
              <div><h3>Extract measurements with AI</h3><p>Upload a photo of handwritten roof measurements, a PDF report or spreadsheet. AI suggests the areas, lengths and quantities it can read. Review them, select your pricing library and price the job.</p><div className={styles.microSteps}><span>Upload</span><Icon kind="arrow"/><span>Review</span><Icon kind="arrow"/><span>Price</span></div></div>
            </article>
          </div>
          <div className={styles.pricingNote}><div className={styles.pricingNoteIcon}><Icon kind="layers" /></div><p><strong>Your pricing, your job.</strong> Select the saved pricing library that fits the work. Don&apos;t have one yet? <Link href="/roofing-pricing-setup">Import your pricing with AI or set it up manually <span aria-hidden="true">→</span></Link></p></div>
          <details className={styles.aiFaq}><summary>Can AI turn handwritten roof measurements into a priced quote?</summary><p>AI can extract suggested areas, lengths and quantities from a readable photo or supported file. You review the measurements and apply your saved pricing. Need the roof measured from a plan or satellite image instead? <Link href="/roofing-takeoff-software">Try Digital Takeoff with Roof Scan Assist</Link>.</p></details>
        </div>
      </section>

      <section className={`${styles.section} ${styles.result}`} aria-labelledby="result-title">
        <div className={styles.wrap}>
          <div className={styles.resultHead}><div><p className={styles.eyebrow}>From measurements to a price</p><h2 id="result-title">Your numbers in. <span className={styles.gradientText}>The calculations handled.</span></h2></div><p>With your pricing library selected, Smart Components apply material, labour, pitch and waste rules to manual or AI-imported quantities. Review the priced job, then create your quote.</p></div>
          <div className={styles.beforeAfter}><ExampleImage kind="before" image={measurementsMedia.beforeImage}/><div className={styles.betweenArrow} aria-hidden="true"><Icon kind="arrow"/></div><ExampleImage kind="after" image={measurementsMedia.afterImage}/></div>
          <div className={styles.compare} aria-label="Choose the full Free Workspace or a quick standalone tool">
            <Link href="/signup" className={`${styles.compareOption} ${styles.compareFeatured}`} data-analytics-surface="measurements_price_workspace" data-analytics-location="measurements_price_comparison" aria-label="Create your QuoteCore+ Free Workspace with saved pricing libraries and quotes">
              <div className={styles.compareTop}><span className={styles.compareLabel}>FOR REPEAT QUOTING</span><span className={styles.compareMarker}>RECOMMENDED</span></div>
              <div className={styles.compareTitle}><span className={styles.compareIcon}><Icon kind="layers"/></span><h3>QuoteCore+ Free Workspace</h3></div>
              <p>Use saved pricing libraries, choose the right one for each job and keep your quotes together. Create, send and track customer quotes.</p>
              <span className={styles.compareAction}>Create Free Workspace <Icon kind="arrow"/></span>
              <span className={styles.compareFoot}>Free usage limits apply</span>
            </Link>
            <Link href="/measurement-to-quote-tool?trade=roofing" className={`${styles.compareOption} ${styles.compareStandalone}`} data-analytics-surface="measurements_price_free_tool" data-analytics-location="measurements_price_comparison" aria-label="Try the standalone measurement-to-quote browser tool without signing up">
              <div className={styles.compareTop}><span className={styles.compareLabel}>FOR A QUICK ONE-OFF JOB</span></div>
              <div className={styles.compareTitle}><span className={styles.compareIcon}><Icon kind="file"/></span><h3>Standalone free tool</h3></div>
              <p>Price a job in your browser without signing up. Use a limited component set, with no permanently saved pricing library or job history.</p>
              <span className={styles.compareAction}>Try the free tool <Icon kind="arrow"/></span>
              <span className={styles.compareFoot}>No account needed to start</span>
            </Link>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.closing}`} aria-labelledby="next-title">
        <div className={`${styles.wrap} ${styles.closingGrid}`}>
          <div><p className={styles.eyebrow}>Your next step</p><h2 id="next-title">Already have the measurements? Start quoting.</h2><p>Your saved pricing does the repeat work. You stay in control of the result.</p></div>
          <div className={styles.closingActions} data-analytics-surface="measurements_price_final" data-analytics-location="measurements_price_footer">
            <MarketingButton href="/signup" variant="primary" size="large" className={styles.primaryCta}>Create Free Workspace <Icon kind="arrow"/></MarketingButton>
            <div className={styles.nextLinks}><Link href="/roofing-pricing-setup">Need to set up pricing?</Link><Link href="/roofing-takeoff-software">Need to measure the roof first?</Link></div>
          </div>
        </div>
      </section>
    </main>
    <SiteFooter />
  </>;
}
