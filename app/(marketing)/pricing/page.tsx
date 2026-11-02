import type { Metadata } from 'next';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import { FreeWorkspaceButton } from '@/components/marketing/FreeWorkspaceButton';
import { MarketingButton } from '@/components/marketing/MarketingButton';
import { workflowCallHref } from '@/lib/booking';
import { buildBreadcrumbSchema, buildPricingOffers } from '@/lib/schema';
import { publicPricing } from '@/lib/public-pricing';
import { hreflangLanguages } from '@/lib/seo/hreflang';
import styles from './PricingLocked.module.css';

export const metadata: Metadata = {
  title: 'QuoteCore+ Pricing | Try Everything First, Then Build Your Plan',
  description: `Try QuoteCore+ in a Free Workspace before choosing a paid plan. Current configurations range from US$${publicPricing.monthlyMin} to US$${publicPricing.monthlyMax}/month. Build your exact plan inside your account or talk it through with Shaun.`,
  alternates: { canonical: 'https://quote-core.com/pricing', languages: hreflangLanguages('/pricing') },
};

function c(...names: string[]) { return names.map((name) => styles[name]).filter(Boolean).join(' '); }

export default function PricingPage() {
  const schemas = [
    { '@context': 'https://schema.org', '@type': 'SoftwareApplication', '@id': 'https://quote-core.com/#software', name: 'QuoteCore+', applicationCategory: 'BusinessApplication', operatingSystem: 'Web', url: 'https://quote-core.com/pricing', offers: buildPricingOffers('USD') },
    buildBreadcrumbSchema([{ name: 'Home', url: 'https://quote-core.com/' }, { name: 'Pricing', url: 'https://quote-core.com/pricing' }]),
  ];
  return <div className={styles.root}>
    {schemas.map((schema, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />)}
    <BlogHeader />
    <main>
      <section className={styles.hero}>
        <div className={styles.wrap}><div className={c('hero-inner')}>
          <p className={styles.eyebrow}>QuoteCore+ pricing</p>
          <h1>Don&apos;t pay for something you don&apos;t need. <span className={styles.gradient}>Try everything first for free.</span></h1>
          <p className={c('hero-copy')}>See how our app can help your business, what features you need, then create your plan.</p>
          <div className={c('price-range')}><strong>US${publicPricing.monthlyMin} to US${publicPricing.monthlyMax}/month</strong><span>Paid plans currently sit within this range.</span></div>
          <div className={c('hero-actions')}>
            <FreeWorkspaceButton className={c('btn','btn-primary')}>Create my free workspace →</FreeWorkspaceButton>
            <MarketingButton href={workflowCallHref} className={c('btn','btn-outline')}>Book 25 minutes with Shaun</MarketingButton>
          </div>
          <div className={c('trust-row')}><span className={c('trust-pill')}>Real workspace, not a timed trial</span><span className={c('trust-pill')}>Try every feature</span><span className={c('trust-pill')}>Create your plan in your account</span></div>
        </div></div>
      </section>

      <section className={styles.clarity}><div className={styles.wrap}><div className={c('clarity-card')}>
        <div className={c('clarity-copy')}><p className={styles.eyebrow}>15 minutes to clarity</p><h2>Know what fits in about 15 minutes.</h2><p>Follow the guided walkthrough, try the features, then build your plan. Need longer? Keep using your free workspace, or let Shaun help.</p></div>
        <div className={c('clarity-flow')} aria-label="15 minute pricing journey"><div><strong>10–15 min</strong><span>Guided walkthrough</span></div><i>→</i><div><strong>Know what helps</strong><span>Try the features</span></div><i>→</i><div><strong>Create your plan</strong><span>See your price</span></div></div>
      </div></div></section>

      <section className={styles.paths}><div className={styles.wrap}>
        <div className={c('paths-intro','compact-intro')}><div><p className={styles.eyebrow}>Two ways to get your price</p><h2>Try it yourself. Or let us help.</h2></div></div>
        <div className={c('path-combined')}>
          <article className={c('path-card')}><span className={c('path-label')}>Option 1 · Try it yourself</span><h3>Start with a free workspace.</h3><p>Use the guided walkthrough or explore on your own. When you know what helps, create your plan inside your account.</p><FreeWorkspaceButton className={c('btn','btn-primary')}>Create my free workspace →</FreeWorkspaceButton></article>
          <article className={c('path-card')} id="shaun-price"><span className={c('path-label')}>Option 2 · Let us help</span><h3>Tell me how you work.</h3><p>Show Shaun how you measure, estimate and quote today. He&apos;ll help you understand what could make it faster and easier, and what that setup would cost.</p><div className={c('shaun','compact-shaun')}><img src="/shaun-smiling.jpg" alt="Shaun, founder of QuoteCore+" /><div><b>Shaun · Founder</b><small>20+ years roofing & construction</small></div></div><MarketingButton href={workflowCallHref} className={c('btn','btn-primary')}>Book my free 25-minute call →</MarketingButton></article>
        </div>
      </div></section>

      <section className={c('dark-section','why-compact')}><div className={styles.wrap}>
        <div className={c('section-head','compact-why-head')}><div><p className={styles.eyebrow}>Why do we do it this way?</p><h2>Because preset plans make you guess.</h2></div><p>Most apps ask you to choose from three or four plans before you know what you actually need. Roofing businesses vary too much for that.</p></div>
        <div className={c('steps','compact-steps')}><article className={styles.step}><span className={c('step-num')}>01 · START FREE</span><h3>Try it first.</h3><p>Use enough of every feature to understand what helps.</p></article><article className={styles.step}><span className={c('step-num')}>02 · LEARN</span><h3>Know what fits.</h3><p>See how QuoteCore+ works with the way you actually quote.</p></article><article className={styles.step}><span className={c('step-num')}>03 · BUILD</span><h3>Create your plan.</h3><p>Use the pricing tool in your account when you know what you need.</p></article></div>
        <div className={c('free-note')}><span className={styles.plus}>+</span><p><b>If the free workspace is enough, keep using it.</b> Upgrade only when you need more features, capacity, or usage.</p></div>
      </div></section>
    </main>
    <SiteFooter />
  </div>;
}
