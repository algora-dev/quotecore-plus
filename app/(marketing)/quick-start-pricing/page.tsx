import type { Metadata } from 'next';
import Link from 'next/link';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import styles from './QuickStartPricing.module.css';

export const metadata: Metadata = {
  title: 'Quick Start Pricing Setup — $99 | QuoteCore+',
  description: 'Send QuoteCore+ your existing pricing and we will prepare up to 15 Smart Components for your review. A focused one-time setup service from US$49.',
  alternates: { canonical: 'https://quote-core.com/quick-start-pricing' },
};

/** The workspace slug is navigation-only, never an authorization token. The app route checks the session. */
export default async function QuickStartPricingPage({ searchParams }: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const { workspace } = await searchParams;
  const validWorkspace = typeof workspace === 'string' && /^[a-z0-9-]{1,80}$/.test(workspace);
  const actionHref = validWorkspace
    ? `https://app.quote-core.com/${workspace}/pricing/quick-start`
    : 'https://app.quote-core.com/signup';
  return <>
    <BlogHeader />
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="qs-heading">
        <p className={styles.eyebrow}>QUOTECORE+ QUICK START</p>
        <p className={styles.price}>From US$49 <span>one-time</span></p>
        <h1 id="qs-heading">Your pricing, prepared for you.</h1>
        <p className={styles.lead}>Send us the products, materials, services and rates you already use. We'll organise them into up to 15 Smart Components in your QuoteCore+ workspace, then ask you to review the result.</p>
        <div className={styles.actions}>
          <Link className={styles.primary} href={actionHref}>{validWorkspace ? 'Continue to Quick Start' : 'Create your free workspace'} <span aria-hidden="true">→</span></Link>
          <Link className={styles.secondary} href="/done-for-you-setup">Need more hands-on help? See Done For You</Link>
        </div>
        <p className={styles.fine}>The setup service is a separate purchase from your QuoteCore+ subscription. The normal workspace component limits still apply.</p>
      </section>
      <section className={styles.details} aria-label="Quick Start package details">
        <div><h2>What we'll do</h2><p>Review your supplied information, prepare up to 15 pricing components, and contact you about critical missing details before handover.</p></div>
        <div><h2>What to provide</h2><p>A spreadsheet, photos, supplier list, notes or an old estimate; plus your real material and labour costs where available. No need to reformat everything first.</p></div>
        <div><h2>What you check</h2><p>You remain responsible for confirming each component's costs, measurement basis, waste, tax and suitability before quoting real work.</p></div>
        <div><h2>Need a broader setup?</h2><p>Full Done For You setup includes more extensive workflow configuration, personal training, subscription time and ongoing support.</p></div>
      </section>
    </main>
    <SiteFooter />
  </>;
}
