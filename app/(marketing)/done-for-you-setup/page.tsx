import type { Metadata } from 'next';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import DfyPageViewTracker from '@/components/DfyPageViewTracker';
import { MarketingButton } from '@/components/marketing/MarketingButton';
import { DfyBookButton } from '@/components/marketing/DfyBookButton';
import { siteUrl, buildBreadcrumbSchema } from '@/lib/schema';
import { hreflangLanguages } from '@/lib/seo/hreflang';
import styles from './DoneForYouSetup.module.css';

export const metadata: Metadata = {
  title: 'Done-For-You QuoteCore+ Setup | Free 20-Minute Discovery Call',
  description:
    'Done-For-You QuoteCore+ setup starts from $499. We configure your account around how you already work, guide you using your own jobs, and support you for three months.',
  alternates: {
    canonical: 'https://quote-core.com/done-for-you-setup',
    languages: hreflangLanguages('/done-for-you-setup'),
  },
};

const breadcrumbSchema = buildBreadcrumbSchema([
  { name: 'Home', url: siteUrl },
  { name: 'Done-For-You Setup', url: `${siteUrl}/done-for-you-setup` },
]);

const faqs = [
  {
    q: 'How much does Done-For-You Setup cost, and why can the price vary?',
    a: 'Done-For-You Setup starts from $499 USD. The final price depends on the amount and complexity of configuration, the QuoteCore+ plan your business needs and any additional guidance you want. We agree the scope and final price before any setup work begins.',
  },
  {
    q: 'What do I need to send you?',
    a: 'Spreadsheets, price lists, labour rates, supplier information, old quotes and notes about how you estimate are all useful. It does not need to be tidy. We start with what you already use.',
  },
  {
    q: 'What happens during the guided session, and can I add more?',
    a: 'Every setup includes at least one one-hour personalised session using your configured account, your own pricing and one of your real or previous jobs where practical. If you want more time or sessions for your team, we can include them in the agreed scope.',
  },
  {
    q: 'What happens after the three included months?',
    a: 'You continue on the QuoteCore+ subscription plan agreed during setup at its normal monthly price. We make the ongoing plan and price clear before you commit to the Done-For-You setup.',
  },
  {
    q: 'Will you decide what I should charge customers?',
    a: 'No. You remain in control of your pricing. We configure the information and rules you provide, then guide you through using them inside QuoteCore+. You still verify measurements and approve every final quote.',
  },
];

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type': 'Question',
    name: faq.q,
    acceptedAnswer: { '@type': 'Answer', text: faq.a },
  })),
};

const process = [
  {
    step: '01',
    title: 'Show us how you work',
    body: 'Walk us through how you currently price and quote. Share the spreadsheets, supplier information, labour rates, old quotes and rules you already rely on. It does not need to be cleaned up first.',
  },
  {
    step: '02',
    title: 'We configure your account around it',
    body: 'We build the agreed pricing, Smart Components and workflow into QuoteCore+ around the way your business already operates, rather than asking you to rebuild everything around the software.',
  },
  {
    step: '03',
    title: 'We guide you through using it',
    body: 'We work through your configured account using your own pricing and one of your real or previous jobs. Then we stay available for the next three months while you start using QuoteCore+ for real work.',
  },
];

const priceFactors = [
  {
    title: 'Scope and complexity',
    body: 'The amount of pricing, components, labour rules and workflow configuration needed to make the account useful for your business.',
  },
  {
    title: 'Your QuoteCore+ plan',
    body: 'The features, expected usage and storage your business needs. The first three months of the agreed plan are included in the setup price.',
  },
  {
    title: 'Additional guidance',
    body: 'At least one one-hour personalised session is included. Extra sessions for you or your team can be added when we agree the scope.',
  },
];

const bestFor = [
  'You already know how you price and quote, but do not want to rebuild it all yourself inside new software.',
  'Your estimating information is spread across spreadsheets, supplier lists, old quotes or one person\'s head.',
  'You want someone beside you while you move into the system, rather than being left alone after setup.',
];

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h13m-5-5 5 5-5 5" /></svg>;
}

function CheckIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.2 4.2L19 7" /></svg>;
}

export default function DoneForYouSetupPage() {
  return (
    <>
      <BlogHeader />
      <DfyPageViewTracker />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <main className={styles.page}>
        <section className={styles.hero} aria-labelledby="dfy-title">
          <div className={styles.heroGrid} aria-hidden="true" />
          <div className={styles.container}>
            <div className={styles.heroLayout}>
              <div className={styles.heroCopy}>
                <p className={styles.eyebrow}>Done-For-You QuoteCore+ setup</p>
                <h1 id="dfy-title"><span className={styles.heroPrimary}>Show us how you currently work.</span><br /><span className={styles.heroSecondary}>We’ll tailor your account around it.</span><br /><span className={styles.heroTertiary}>So you can work faster, with less effort.</span></h1>
                <p className={styles.heroLead}>Tell us how you currently price, quote and run your jobs. We’ll configure your QuoteCore+ account around that workflow, guide you through using it on your own jobs, and stay available while you get comfortable with it.</p>
                <div className={styles.heroActions}>
                  <DfyBookButton cta="hero" size="large" label="Book a free 20-minute call" />
                  <MarketingButton href="#how-it-works" variant="glass" size="large">See how it works</MarketingButton>
                </div>
                <p className={styles.heroNote}>Free discovery call. No obligation. Talk to a real person with roofing and construction industry experience.</p>
              </div>

              <aside className={styles.offerCard} aria-label="Done-For-You setup starting price and inclusions">
                <p className={styles.offerKicker}>Done-For-You setup</p>
                <div className={styles.startPrice}><span>From</span><strong>$499</strong><small>USD</small></div>
                <div className={styles.offerRule} />
                <ul>
                  <li><CheckIcon /><span><strong>Your account configured for you</strong><br />Pricing, components and agreed workflow</span></li>
                  <li><CheckIcon /><span><strong>At least 1 hour of personalised guidance</strong><br />Using your pricing and your own job</span></li>
                  <li><CheckIcon /><span><strong>3 months of QuoteCore+</strong><br />Your agreed subscription plan included</span></li>
                  <li><CheckIcon /><span><strong>3 months of ongoing support</strong><br />Help while you start using the system</span></li>
                </ul>
              </aside>
            </div>

            <div className={styles.heroProof} aria-label="What makes the setup different">
              <div><img src="/marketing/done-for-you/dfy-build.webp" alt="" aria-hidden="true" /><span><strong>We configure</strong>Your account</span></div>
              <div><img src="/marketing/done-for-you/dfy-train.webp" alt="" aria-hidden="true" /><span><strong>We guide</strong>On your jobs</span></div>
              <div><img src="/marketing/done-for-you/dfy-support.webp" alt="" aria-hidden="true" /><span><strong>We support</strong>For 3 months</span></div>
              <div><img src="/marketing/done-for-you/dfy-experience.webp" alt="" aria-hidden="true" /><span><strong>20+ years</strong>Roofing & construction experience</span></div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className={styles.processSection} aria-labelledby="process-title">
          <div className={styles.container}>
            <div className={styles.sectionIntro}>
              <div>
                <p className={styles.lightEyebrow}>How Done For You works</p>
                <h2 id="process-title">From your current workflow to a configured account in three steps.</h2>
              </div>
              <p>We start with what already works in your business, configure QuoteCore+ around it, then guide you through the transition using your own work.</p>
            </div>
            <ol className={styles.processList}>
              {process.map((item) => (
                <li key={item.step}>
                  <span className={styles.processNum}>{item.step}</span>
                  <div><h3>{item.title}</h3><p>{item.body}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={styles.pricingSection} aria-labelledby="pricing-title">
          <div className={styles.container}>
            <div className={styles.pricingHeader}>
              <div>
                <p className={styles.lightEyebrow}>Scoped to your business</p>
                <h2 id="pricing-title">Starting from $499. Scoped around what you actually need.</h2>
              </div>
            </div>
            <p className={styles.pricingLead}>After the free call, we scope the work and give you the final price before anything begins. Three things have the biggest effect on that price:</p>
            <div className={styles.factorGrid}>
              {priceFactors.map((factor, index) => (
                <article className={styles.factorCard} key={factor.title}>
                  <span>0{index + 1}</span>
                  <h3>{factor.title}</h3>
                  <p>{factor.body}</p>
                </article>
              ))}
            </div>
            <div className={styles.pricingFooter}>
              <div><strong>No surprises:</strong> we agree the scope and final price with you before any setup work begins.</div>
              <DfyBookButton cta="pricing" label="Book free 20-minute call" />
            </div>
          </div>
        </section>

        <section className={styles.fitSection} aria-labelledby="fit-title">
          <div className={`${styles.container} ${styles.fitLayout}`}>
            <div className={styles.fitCopy}>
              <p className={styles.lightEyebrow}>Is Done For You right for you?</p>
              <h2 id="fit-title">Best when you know your business, but do not want to rebuild it inside software.</h2>
              <ul className={styles.fitList}>
                {bestFor.map((item) => <li key={item}><CheckIcon /><span>{item}</span></li>)}
              </ul>
            </div>

            <aside className={styles.controlCard} aria-labelledby="control-title">
              <p className={styles.controlKicker}>You stay in control</p>
              <h3 id="control-title">We configure the system. You make the decisions.</h3>
              <p>We work from the pricing, measurements and rules you provide. You still decide what you charge, verify your measurements and approve every final quote.</p>
              <div className={styles.controlRule} />
              <p className={styles.controlNote}>Done For You removes the setup work. It does not take control of your business away from you.</p>
            </aside>
          </div>
        </section>

        <section className={styles.finalSection} aria-labelledby="final-title">
          <div className={styles.finalGlow} aria-hidden="true" />
          <div className={`${styles.container} ${styles.finalInner}`}>
            <p className={styles.eyebrow}>Free 20-minute discovery call</p>
            <h2 id="final-title">Show us how you work. We’ll tell you whether Done For You makes sense.</h2>
            <p>Use the call to walk us through your current process, ask questions and see whether having us configure the account would make your move into QuoteCore+ easier.</p>
            <div className={styles.finalActions}>
              <DfyBookButton cta="final" size="large" label="Book free 20-minute call" />
            </div>
            <small>Done-For-You setup starts from $499 USD. No obligation to continue after the call.</small>
          </div>
        </section>

        <section className={styles.faqSection} aria-labelledby="faq-title">
          <div className={`${styles.container} ${styles.faqGrid}`}>
            <div className={styles.faqIntro}>
              <p className={styles.lightEyebrow}>Common questions</p>
              <h2 id="faq-title">Anything else you need to know.</h2>
              <p>The details that matter before you decide whether to book the call.</p>
              <MarketingButton href="/pricing" variant="glass">View QuoteCore+ plans</MarketingButton>
            </div>
            <div className={styles.faqList}>
              {faqs.map((faq) => (
                <details key={faq.q} className={styles.faqItem}>
                  <summary>{faq.q}<span><ArrowIcon /></span></summary>
                  <p>{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
