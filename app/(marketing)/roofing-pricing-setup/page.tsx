import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import YouTubeLite from '@/components/YouTubeLite';
import { MarketingButton } from '@/components/marketing/MarketingButton';
import { buildBreadcrumbSchema, buildSoftwareApplicationSchema, siteUrl } from '@/lib/schema';
import { hreflangLanguages } from '@/lib/seo/hreflang';
import { pricingSetupMedia, pricingTutorialSchema, safeMediaPath, validYouTubeId } from './media';
import styles from './PricingSetup.module.css';

const path = '/roofing-pricing-setup';
const canonical = `${siteUrl}${path}`;
const pageTitle = 'Import Roofing Price Lists with AI | QuoteCore+';
const description = 'Import roofing supplier price lists from Excel, CSV, PDFs or photos using AI, or enter prices manually. Review suggestions, save your rates and reuse your pricing.';

export const metadata: Metadata = {
  title: { absolute: pageTitle },
  description,
  alternates: { canonical, languages: hreflangLanguages(path) },
  robots: { index: true, follow: true },
  openGraph: {
    title: pageTitle,
    description,
    url: canonical,
    siteName: 'QuoteCore+',
    type: 'website',
    images: [{ url: `${siteUrl}/og-image.jpg`, width: 1200, height: 630, alt: 'QuoteCore+ roofing pricing setup' }],
  },
  twitter: { card: 'summary_large_image', title: pageTitle, description, images: [`${siteUrl}/og-image.jpg`] },
};

function Icon({ kind }: { kind: 'pencil' | 'sparkles' | 'file' | 'check' | 'arrow' }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const pathData: Record<typeof kind, ReactNode> = {
    pencil: <><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/></>,
    sparkles: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2Z"/><path d="m19 18 .7 1.3L21 20l-1.3.7L19 22l-.7-1.3L17 20l1.3-.7Z"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></>,
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  };
  return <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" {...common}>{pathData[kind]}</svg>;
}

function PricingImage({ kind, image }: { kind: 'before' | 'after'; image: string }) {
  const isBefore = kind === 'before';
  const safePath = safeMediaPath(image);
  return <figure className={styles.exampleCard}>
    <div className={styles.exampleHeader}>
      <span>{isBefore ? '01 / BEFORE' : '02 / AFTER'}</span>
      <span className={styles.exampleTag}>{isBefore ? 'WHAT YOU HAVE' : 'READY TO REUSE'}</span>
    </div>
    {safePath ? (
      // Screenshots are supplied by the owner later, from the same real demo.
      // eslint-disable-next-line @next/next/no-img-element
      <img className={styles.exampleImage} src={safePath} alt={isBefore ? 'Existing roofing prices in the original list used in the QuoteCore+ setup tutorial' : 'The same roofing prices saved as reusable components in QuoteCore+'} loading="lazy" />
    ) : (
      <div className={styles.imagePlaceholder} aria-label={`${isBefore ? 'Before' : 'After'} screenshot pending`}>
        <Icon kind="file" />
        <strong>{isBefore ? 'Your existing price list' : 'Your QuoteCore+ pricing library'}</strong>
        <span>Real screenshot from the tutorial goes here</span>
      </div>
    )}
    <figcaption>
      <strong>{isBefore ? 'Bring what you already use' : 'Save it once in QuoteCore+'}</strong>
      <span>{isBefore ? 'Product names, material costs and labour rates.' : 'Your reviewed rates and rules, ready for future quotes.'}</span>
    </figcaption>
  </figure>;
}

export default function RoofingPricingSetupPage() {
  const videoId = validYouTubeId(pricingSetupMedia.videoId);
  const videoSchema = pricingTutorialSchema();
  const schemas = [
    buildBreadcrumbSchema([
      { name: 'Home', url: `${siteUrl}/` },
      { name: 'Roofing pricing setup', url: canonical },
    ]),
    { '@context': 'https://schema.org', ...buildSoftwareApplicationSchema() },
    ...(videoSchema ? [videoSchema] : []),
  ];
  return <>
    {schemas.map((schema, index) => (
      <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
    ))}
    <BlogHeader />
    <main className={styles.root}>
      <section className={`${styles.section} ${styles.hero}`} aria-labelledby="pricing-setup-title">
        <div className={`${styles.wrap} ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Roofing price list import · Manual or AI</p>
            <h1 id="pricing-setup-title">Bring your roofing prices. <span className={styles.gradientText}>We&apos;ll handle the calculations.</span></h1>
            <p className={styles.heroLead}>Got roofing prices in Excel, a supplier PDF, a price list or handwritten notes? Enter them yourself, or upload a file or photo for AI-assisted pricing import. Review the suggested items, save your rates and reuse them on future jobs.</p>
            <div className={styles.actions} data-analytics-surface="pricing_setup_hero" data-analytics-location="pricing_setup_hero">
              <MarketingButton href="/signup" variant="primary" size="large" className={styles.primaryCta}>Create Free Workspace <Icon kind="arrow" /></MarketingButton>
              {videoId ? <MarketingButton href="#pricing-tutorial" variant="glass" size="large" className={styles.secondaryCta}>Watch the tutorial</MarketingButton>
                : <MarketingButton href="#setup-options" variant="glass" size="large" className={styles.secondaryCta}>See your setup options</MarketingButton>}
            </div>
            <p className={styles.reassurance}><Icon kind="check" /> No credit card · No expiry</p>
          </div>
          <aside id="pricing-tutorial" className={styles.videoCard} aria-label="Roofing pricing setup tutorial" data-analytics-surface="pricing_setup_video" data-analytics-location="pricing_setup_hero">
            <div className={styles.videoTop}><span className={styles.statusDot} /> PRICING SETUP TUTORIAL <span>QUOTECORE+</span></div>
            {videoId ? <YouTubeLite videoId={videoId} title="How to set up your roofing prices in QuoteCore+" className={styles.videoEmbed} uploadDate={pricingSetupMedia.videoUploadDate} /> :
              <div className={styles.videoPlaceholder} aria-label="Video tutorial placeholder">
                <span className={styles.playCircle} aria-hidden="true">▶</span>
                <strong>See how it works, step by step</strong>
                <span>Your real YouTube tutorial will appear here.</span>
              </div>}
            <p className={styles.videoCaption}><strong>Watch a real roofing price list become reusable pricing.</strong></p>
          </aside>
        </div>
      </section>
      <section id="setup-options" className={`${styles.section} ${styles.dark}`} aria-labelledby="setup-options-title">
        <div className={styles.wrap}>
          <p className={styles.eyebrow}>Two ways to get started</p>
          <h2 id="setup-options-title">Bring what you&apos;ve got. <span className={styles.darkAccent}>Get straight to quoting.</span></h2>
          <p className={styles.darkLead}>Start with product names and your own costs. You choose what gets saved in your pricing library.</p>
          <div className={styles.methodGrid}>
            <article className={styles.methodCard}>
              <div className={styles.methodIcon}><Icon kind="pencil" /></div>
              <div>
                <h3>Enter it yourself</h3>
                <p>Name your roofing products, add material costs and labour rates, then save them. Set your waste and pitch rules where needed.</p>
                <span className={styles.methodFoot}>MANUAL SETUP</span>
              </div>
            </article>
            <article className={styles.methodCard}>
              <div className={styles.methodIcon}><Icon kind="sparkles" /></div>
              <div>
                <h3>Import prices with AI</h3>
                <p>Upload Excel, CSV, a supplier PDF or a photo of your price list. AI suggests products and rates. Check what it finds and complete missing details before saving.</p>
                <div className={styles.microSteps} aria-label="AI pricing import steps"><span>Upload</span><Icon kind="arrow" /><span>Review</span><Icon kind="arrow" /><span>Save</span></div>
              </div>
            </article>
          </div>
          <p className={styles.fileHint}>Text files and pasted pricing are supported too. AI helps read your source; you confirm the actual prices and calculation rules.</p>
          <details className={styles.aiFaq}><summary>Can AI create pricing components from a photo or supplier list?</summary><p>Yes. From a readable image or supported document, the Pricing Setup Assistant suggests products and costs for you to review. You approve the entries, add any missing prices or labour, and save the components to reuse when quoting.</p></details>
        </div>
      </section>
      <section className={`${styles.section} ${styles.result}`} aria-labelledby="result-title">
        <div className={styles.wrap}>
          <div className={styles.resultHead}>
            <div>
              <p className={styles.eyebrow}>See the difference</p>
              <h2 id="result-title">Set up once. <span className={styles.gradientText}>Reuse on every job.</span></h2>
            </div>
            <p>The same prices you use today, saved in QuoteCore+ and ready to apply to your next measurements.</p>
          </div>
          <div className={styles.beforeAfter}>
            <PricingImage kind="before" image={pricingSetupMedia.beforeImage} />
            <div className={styles.betweenArrow} aria-hidden="true"><Icon kind="arrow" /></div>
            <PricingImage kind="after" image={pricingSetupMedia.afterImage} />
          </div>
          <div className={styles.calculationStrip}>
            <div><strong>Your numbers in. The calculations handled.</strong><p>AI helps transfer the price list. Your saved material, labour, pitch and waste rules handle the quote calculations.</p></div>
            <div className={styles.calculationTags} aria-label="Supported pricing calculations"><span>Materials + labour</span><span>Waste</span><span>Pitch</span><span>Totals</span></div>
          </div>
          <p className={styles.detailLink}>Next: <Link href="/roof-measurements-to-price">Apply your saved pricing to roof measurements →</Link> &nbsp; Want to see the details? <Link href="/features/smart-components">Explore Smart Components <span aria-hidden="true">→</span></Link></p>
        </div>
      </section>
      <section className={`${styles.section} ${styles.closing}`} aria-labelledby="closing-title">
        <div className={`${styles.wrap} ${styles.closingGrid}`}>
          <div><p className={styles.eyebrow}>Your next step</p><h2 id="closing-title">Ready to bring your pricing across?</h2><p>Start free, or have us help set it up for you.</p></div>
          <div className={styles.closingActions} data-analytics-surface="pricing_setup_final_cta" data-analytics-location="pricing_setup_footer">
            <MarketingButton href="/signup" variant="primary" size="large" className={styles.primaryCta}>Create Free Workspace <Icon kind="arrow" /></MarketingButton>
            <MarketingButton href="/quick-start-pricing" variant="glass" size="large" className={styles.darkButton}>Get setup help</MarketingButton>
            <small>No card. No expiry. <Link href="/login">Already have a workspace?</Link></small>
          </div>
        </div>
      </section>
    </main>
    <SiteFooter />
  </>;
}
