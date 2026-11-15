import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingButton } from '@/components/marketing/MarketingButton';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import { QuickStartInquiryForm } from './QuickStartInquiryForm';
import styles from './QuickStartPricing.module.css';

export const metadata: Metadata = {
  title: 'Quick Start Pricing Setup From US$49 | QuoteCore+',
  description: 'We prepare up to 15 Smart Components from your material, labour and service rates. Send your details first, agree the scope and price, then pay securely.',
  alternates: { canonical: 'https://quote-core.com/quick-start-pricing' },
};
const inclusions = [
  'Up to 15 Smart Components from your supplied pricing',
  'Material costs and labour rates configured',
  'Measurement, pitch and waste rules where applicable',
  'Follow-up for any missing information before setup',
];
const steps = [
  { name: 'Tell us what you need', body: 'Estimate the number of components and send any price lists, photos, spreadsheets or notes you have.' },
  { name: 'We confirm the scope', body: 'Our team reviews everything, asks for missing details and agrees the price with you. Bigger setups receive a custom quote.' },
  { name: 'Pay, then we prepare it', body: 'After you approve the price, we send a Stripe payment link. We aim to finish within 48 hours of receiving all required details and confirmed payment.' },
];
export default async function QuickStartPricingPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const { workspace } = await searchParams;
  const validWorkspace = typeof workspace === 'string' && /^[a-z0-9-]{1,80}$/.test(workspace) ? workspace : undefined;
  return <>
    <BlogHeader />
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="qs-heading"><div className={styles.container}><div className={styles.heroLayout}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>QUOTECORE+ QUICK START</p>
          <h1 id="qs-heading">Your pricing set up for you.<br /><span className={styles.gradient}>From US$49.</span></h1>
          <p className={styles.lead}>Send us your materials, products, labour rates and services. We'll prepare your Smart Components, so you can start quoting with your own prices.</p>
          <div className={styles.heroActions}><MarketingButton href="#quick-start-enquiry" variant="primary" size="large" className={styles.primary}>Send a pricing enquiry <span aria-hidden="true">→</span></MarketingButton><MarketingButton href="/done-for-you-setup" variant="glass" size="large" className={styles.ghost}>Need the full setup?</MarketingButton></div>
          <p className={styles.heroNote}>Nothing to pay now. We confirm what you need and the final price before sending your payment link.</p>
        </div>
        <aside className={styles.offerCard} aria-label="Quick Start setup price and inclusions"><span className={styles.offerKicker}>PRICING SETUP</span><div className={styles.offerPrice}>US$49 <small>from · one-time</small></div><div className={styles.offerDivider}/><ul>{inclusions.map(text => <li key={text}><span aria-hidden="true">✓</span>{text}</li>)}</ul><p>More than 15 components or complex setups are quoted individually.</p></aside>
      </div></div></section>
      <section className={styles.process}><div className={styles.container}>
        <p className={styles.lightEyebrow}>HOW IT WORKS</p><h2>Send it. We check it. Then we set it up.</h2>
        <div className={styles.steps}>{steps.map((item,i) => <article key={item.name}><span>0{i+1}</span><h3>{item.name}</h3><p>{item.body}</p></article>)}</div>
      </div></section>
      <section className={styles.example}><div className={styles.container}><div className={styles.exampleLayout}>
        <div><p className={styles.lightEyebrow}>ONE SMART COMPONENT</p><h2>One component is more than one price.</h2><p>A single roof covering component can contain your supplier material rate, installation labour, measurement type, pitch calculation and waste allowance. A ridge flashing, valley flashing or roof fixing would each be another component.</p><p>Up to 15 components is often enough to get started with a straightforward roofing system.</p></div>
        <div className={styles.exampleCard}><span>EXAMPLE · 1 COMPONENT</span><h3>Long-run roof sheeting</h3><dl><div><dt>Measurement</dt><dd>Roof area (m²)</dd></div><div><dt>Material rate</dt><dd>Your supplier cost</dd></div><div><dt>Labour rate</dt><dd>Your installation cost</dd></div><div><dt>Pitch</dt><dd>Rafter</dd></div><div><dt>Waste</dt><dd>Your chosen allowance</dd></div></dl></div>
      </div></div></section>
      <section className={styles.enquirySection}><div className={styles.container}><div className={styles.enquiryIntro}><p className={styles.lightEyebrow}>NO PAYMENT TO ENQUIRE</p><h2>Tell us what you need.</h2><p>A few simple questions. We'll contact you if we need more information, then confirm the scope and price.</p></div><QuickStartInquiryForm workspace={validWorkspace}/></div></section>
      <section className={styles.endNote}><div className={styles.container}><h2>Need training and a complete account setup?</h2><p>Our Done For You service starts at US$199 and includes up to 15 components, three months of entry-level QuoteCore+, a personal walkthrough and three months of support.</p><Link href="/done-for-you-setup">Explore Done For You <span aria-hidden="true">→</span></Link></div></section>
    </main><SiteFooter />
  </>;
}
