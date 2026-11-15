import type { Metadata } from 'next';
import BlogHeader from '@/components/BlogHeader';
import { MarketingButton } from '@/components/marketing/MarketingButton';
import SiteFooter from '@/components/SiteFooter';
import { PublicPricingCalculator } from './PublicPricingCalculator';
import { buildBreadcrumbSchema, buildPricingOffers } from '@/lib/schema';
import { publicPricing } from '@/lib/public-pricing';
import { hreflangLanguages } from '@/lib/seo/hreflang';
import { workflowCallHref } from '@/lib/booking';
import styles from './PricingPublic.module.css';

export const metadata: Metadata = {
  title: 'Build Your QuoteCore+ Pricing | Calculate Your Plan',
  description: `Estimate your QuoteCore+ subscription with the same tool used inside the app. Configure your needs from US$${publicPricing.monthlyMin}/month. Start with a free workspace. No payment on this page.`,
  alternates: { canonical:'https://quote-core.com/pricing', languages:hreflangLanguages('/pricing') },
};

export default function PricingPage() {
  const schemas = [
    { '@context':'https://schema.org','@type':'SoftwareApplication','@id':'https://quote-core.com/#software',name:'QuoteCore+',applicationCategory:'BusinessApplication',operatingSystem:'Web',url:'https://quote-core.com/pricing',offers:buildPricingOffers('USD') },
    buildBreadcrumbSchema([{name:'Home',url:'https://quote-core.com/'},{name:'Pricing',url:'https://quote-core.com/pricing'}]),
  ];
  return <div className={styles.root}>
    {schemas.map((s,i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(s)}} />)}
    <BlogHeader />
    <main>
      <section className={styles.hero} aria-labelledby="pricing-title"><div className={styles.container}>
        <p className={styles.eyebrow}>QUOTECORE+ PRICING</p>
        <h1 id="pricing-title">Build a plan around the way you work.<br/><span>See your price before you sign up.</span></h1>
        <p>Use the exact pricing tool from the app to estimate what you'd pay for the tools and usage you need. You won't be charged here.</p>
        <div className={styles.heroMeta}><span>Free Workspace available</span><span>Estimated plans from US${publicPricing.monthlyMin}/month</span><span>No payment required</span></div>
        <MarketingButton href="#calculate-plan" variant="primary" size="large" className={styles.scrollButton}>Calculate my price <span aria-hidden="true">↓</span></MarketingButton>
      </div></section>
      <section className={styles.calculatorSection} id="calculate-plan" aria-labelledby="calculator-title"><div className={styles.container}>
        <div className={styles.intro}><p className={styles.eyebrow}>PLAN CALCULATOR</p><h2 id="calculator-title">What does your business need?</h2><p>Answer a few questions and see your estimated monthly cost. The tools, rates and calculations are shared with the in-account pricing builder.</p></div>
        <div className={styles.calculatorHost}>
          <PublicPricingCalculator callHref={workflowCallHref} />
        </div>
      </div></section>
      <section className={styles.footerSection}><div className={styles.container}><h2>Start free. Choose your paid plan when you're ready.</h2><p>Create a Free Workspace to explore the app. Paid plans are selected inside your account under Billing & Pricing. Or book a call and we'll help work out what makes sense for your business.</p></div></section>
    </main>
    <SiteFooter />
  </div>;
}
