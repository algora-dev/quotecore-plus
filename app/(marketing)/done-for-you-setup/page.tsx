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
    'Done-For-You QuoteCore+ setup starts from $499. Begin with a free 20-minute discovery call, then get your pricing, workflow, personalised training, three months of QuoteCore+ and ongoing support.',
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
    q: 'Is the first call free?',
    a: 'Yes. It is a free 20-minute discovery call with no obligation to proceed. Show us how you work, tell us what you want to improve and ask questions. If useful, we can also show you the parts of QuoteCore+ most relevant to your business.',
  },
  {
    q: 'How much does Done-For-You Setup cost?',
    a: 'Done-For-You Setup starts from $499 USD. If you decide you want to continue after the discovery call, we scope the setup around your business and give you the final price before any work begins.',
  },
  {
    q: 'What is included in the setup price?',
    a: 'Your agreed setup work, your first three months of the QuoteCore+ plan selected for your business, at least one one-hour personalised training session using your own pricing and a real or previous job, plus ongoing setup and product support throughout those three months.',
  },
  {
    q: 'Why does the final price vary?',
    a: 'Every business is different. Some have a small pricing list and simple workflow. Others have hundreds of items, multiple labour rules, larger storage needs or want more training. We scope the work so you pay for the setup and plan you actually need.',
  },
  {
    q: 'What do I need to send you?',
    a: 'Spreadsheets, price lists, labour rates, old quotes and notes about how you estimate are all useful. It does not need to be tidy.',
  },
  {
    q: 'What happens in the training session?',
    a: 'We use your configured account, your own pricing and one of your own jobs where practical. The goal is to show you how QuoteCore+ fits the way you already work, not teach you from a blank demo account.',
  },
  {
    q: 'Can I add more training sessions?',
    a: 'Yes. Every setup includes at least one one-hour session. If you want more sessions for yourself or your team, we can include them in the agreed scope.',
  },
  {
    q: 'What happens after the three included months?',
    a: 'You continue on the QuoteCore+ subscription plan agreed during setup at its normal monthly price. We make that ongoing plan and price clear before you commit to the Done-For-You setup.',
  },
  {
    q: 'Will you decide what I should charge customers?',
    a: 'No. You remain in control of your pricing. We structure and configure the information and rules you provide, then help you understand how to use them inside QuoteCore+.',
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

const valueItems = [
  { num: '01', title: 'Your account, configured', body: 'We set up the agreed QuoteCore+ structure around the way your business prices and quotes work.' },
  { num: '02', title: 'Your pricing, built in', body: 'Materials, labour, waste rules and reusable Smart Components are configured from the information you provide.' },
  { num: '03', title: 'Training on your own job', body: 'At least one one-hour session using your pricing and one of your real or previous jobs.' },
  { num: '04', title: '3 months of QuoteCore+', body: 'Your first three months of the subscription plan agreed for your business are included in your setup price.' },
  { num: '05', title: '3 months of support', body: 'Get ongoing setup and product support while you start using QuoteCore+ on real work.' },
  { num: '06', title: 'Extra training if you want it', body: 'Add more one-hour sessions for yourself or your team when we agree the scope.' },
];

const priceFactors = [
  { title: 'How much we need to build', body: 'The volume of components, pricing information and workflow configuration required.' },
  { title: 'How complex your setup is', body: 'Simple pricing takes less work than larger catalogues, multiple rules or more involved workflows.' },
  { title: 'The QuoteCore+ plan you need', body: 'Your features, expected usage and storage determine the subscription plan included for the first three months.' },
  { title: 'How much training you want', body: 'One one-hour personalised session is included. Additional sessions can be added to your setup.' },
];

const process = [
  { step: '01', title: 'Book a free 20-minute discovery call', body: 'Show us how you work, tell us what you want to improve and ask anything you need. If useful, we can show you the parts of QuoteCore+ most relevant to your business.' },
  { step: '02', title: 'We recommend the easiest way across', body: 'We map the simplest transition from your current workflow into QuoteCore+, including the plan, setup and training that make sense for you.' },
  { step: '03', title: 'You decide what happens next', body: 'If Done For You feels right after the call, we agree the scope and price before any setup work begins.' },
  { step: '04', title: 'Send us what you already use', body: 'Spreadsheets, price lists, labour rates, waste rules, old quotes and notes are all useful. They do not need to be cleaned up first.' },
  { step: '05', title: 'We build your system', body: 'We configure the agreed pricing, Smart Components and workflow inside your QuoteCore+ account, then test the setup with your information.' },
  { step: '06', title: 'Train on your own job, then go live', body: 'Your included one-hour session uses your configured account and your own work. Then you have three months of support behind you while you start using QuoteCore+ on real jobs.' },
];

const bestFor = [
  'You already know how you price work, but do not want to spend evenings rebuilding it in new software.',
  'Your estimating information lives across spreadsheets, supplier lists, old quotes or one person\'s head.',
  'You want QuoteCore+ configured around your business before you start relying on it.',
  'You would rather learn with your own pricing and real jobs than generic tutorial examples.',
  'You have tried software before and the setup work is what stopped you using it properly.',
  'You want help during the first few months instead of being left alone after onboarding.',
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
      <BlogHeader theme="dark" />
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
                <p className={styles.heroLead}>Tell us how you currently price, quote and run your jobs. We’ll configure your QuoteCore+ account around that workflow, train you using your own jobs, and stay available while you get comfortable using it.</p>
                <div className={styles.heroActions}>
                  <DfyBookButton cta="hero" size="large" label="Book a free 20-minute call" />
                  <MarketingButton href="#whats-included" variant="glass" size="large">See what is included</MarketingButton>
                </div>
                <p className={styles.heroNote}>Free discovery call. No obligation. Talk to a real person with roofing and construction industry experience.</p>
              </div>

              <aside className={styles.offerCard} aria-label="Done-For-You setup starting price and inclusions">
                <p className={styles.offerKicker}>Done-For-You setup</p>
                <div className={styles.startPrice}><span>From</span><strong>$499</strong><small>USD</small></div>
                <div className={styles.offerRule} />
                <ul>
                  <li><CheckIcon /><span><strong>3 months of QuoteCore+</strong><br />Your agreed subscription plan included</span></li>
                  <li><CheckIcon /><span><strong>At least 1 hour of personalised training</strong><br />Using your pricing and your own job</span></li>
                  <li><CheckIcon /><span><strong>3 months of ongoing support</strong><br />Help while you start using the system</span></li>
                  <li><CheckIcon /><span><strong>Your setup built for you</strong><br />Pricing, components and agreed workflow</span></li>
                </ul>
              </aside>
            </div>

            <div className={styles.heroProof} aria-label="What makes the setup different">
              <div><img src="/marketing/done-for-you/dfy-build.webp" alt="" aria-hidden="true" /><span><strong>We build</strong>Your system</span></div>
              <div><img src="/marketing/done-for-you/dfy-train.webp" alt="" aria-hidden="true" /><span><strong>We train</strong>On your job</span></div>
              <div><img src="/marketing/done-for-you/dfy-support.webp" alt="" aria-hidden="true" /><span><strong>We support</strong>For 3 months</span></div>
              <div><img src="/marketing/done-for-you/dfy-experience.webp" alt="" aria-hidden="true" /><span><strong>20+ years</strong>Roofing & construction experience</span></div>
            </div>
          </div>
        </section>

        <section id="whats-included" className={styles.valueSection} aria-labelledby="value-title">
          <div className={styles.container}>
            <div className={styles.sectionIntro}>
              <div>
                <p className={styles.lightEyebrow}>More than onboarding</p>
                <h2 id="value-title">Start with a system that already feels like yours.</h2>
              </div>
              <p>Instead of handing you an empty account and a tutorial library, we do the setup work with your information and teach you in the context of the jobs you actually price.</p>
            </div>
            <div className={styles.valueGrid}>
              {valueItems.map((item) => (
                <article key={item.num} className={styles.valueCard}>
                  <span>{item.num}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.subscriptionSection} aria-labelledby="subscription-title">
          <div className={`${styles.container} ${styles.subscriptionGrid}`}>
            <div className={styles.subscriptionCopy}>
              <p className={styles.eyebrow}>Three months included</p>
              <h2 id="subscription-title">Your first three months are already part of the setup.</h2>
              <p>Once we agree the QuoteCore+ plan that fits your features, usage and storage, its first three months are included in your setup price.</p>
              <p>So this is not just onboarding. It includes the software period, the setup work, personalised training and support while you start using it.</p>
            </div>
            <div className={styles.equation} aria-label="Done-For-You value breakdown">
              <div className={styles.equationItem}><span>01</span><strong>Setup</strong><small>Built with your information</small></div>
              <span className={styles.plus}>+</span>
              <div className={styles.equationItem}><span>02</span><strong>Training</strong><small>At least one 1-hour session</small></div>
              <span className={styles.plus}>+</span>
              <div className={styles.equationItem}><span>03</span><strong>3 months</strong><small>Your agreed QuoteCore+ plan</small></div>
              <span className={styles.plus}>+</span>
              <div className={styles.equationItem}><span>04</span><strong>Support</strong><small>Throughout those 3 months</small></div>
            </div>
          </div>
        </section>

        <section className={styles.pricingSection} aria-labelledby="pricing-title">
          <div className={styles.container}>
            <div className={styles.pricingHeader}>
              <div>
                <p className={styles.lightEyebrow}>A setup scoped to your business</p>
                <h2 id="pricing-title">Starting from $499. Scoped around what you actually need.</h2>
              </div>
              <div className={styles.priceCallout}><span>Starting price</span><strong>$499</strong><small>USD</small></div>
            </div>
            <p className={styles.pricingLead}>If Done For You looks useful, we scope the setup and give you the price before you decide. These are the main things that determine it:</p>
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
              <div><strong>Always included:</strong> three months of your agreed subscription plan, at least one one-hour training session, and support throughout the included three-month period.</div>
              <DfyBookButton cta="pricing" label="Book free 20-minute call" />
            </div>
          </div>
        </section>

        <section className={styles.trainingSection} aria-labelledby="training-title">
          <div className={`${styles.container} ${styles.trainingGrid}`}>
            <div className={styles.trainingPanel}>
              <p className={styles.eyebrow}>Training that makes sense</p>
              <h2 id="training-title">No blank demo account. No generic practice job.</h2>
              <p>We train you inside the QuoteCore+ account we configured for you, with your own pricing and one of your real or previous jobs wherever practical.</p>
              <ul>
                <li><CheckIcon /><span>See your existing workflow mapped into QuoteCore+.</span></li>
                <li><CheckIcon /><span>Learn using your own pricing and components.</span></li>
                <li><CheckIcon /><span>Work through one of your real or previous jobs.</span></li>
                <li><CheckIcon /><span>Ask questions while everything is fresh and relevant.</span></li>
              </ul>
            </div>
            <aside className={styles.sessionCard}>
              <span className={styles.sessionTag}>Included minimum</span>
              <strong>1 hour</strong>
              <h3>Personalised training session</h3>
              <p>Want more time, multiple sessions or team training? Add it when we agree your scope.</p>
            </aside>
          </div>
        </section>

        <section className={styles.processSection} aria-labelledby="process-title">
          <div className={styles.container}>
            <div className={styles.sectionIntroCompact}>
              <p className={styles.lightEyebrow}>A simple, no-pressure first step</p>
              <h2 id="process-title">From a free call to a system that feels familiar</h2>
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

        <section className={styles.fitSection} aria-labelledby="fit-title">
          <div className={styles.container}>
            <div className={styles.fitIntro}>
              <p className={styles.eyebrow}>Who gets the most value</p>
              <h2 id="fit-title">A good option when the software is not the hard part. The setup is.</h2>
              <p>If you already know your trade and how you price work, Done-For-You setup removes the part most people keep putting off: rebuilding that knowledge inside new software. You will speak with real people who understand roofing and construction workflows, and know there is more than one right way to run a job.</p>
            </div>
            <ul className={styles.fitGrid}>
              {bestFor.map((item) => <li key={item}><CheckIcon /><span>{item}</span></li>)}
            </ul>
          </div>
        </section>

        <section className={styles.boundariesSection} aria-labelledby="boundaries-title">
          <div className={`${styles.container} ${styles.boundariesGrid}`}>
            <div>
              <p className={styles.lightEyebrow}>You stay in control</p>
              <h2 id="boundaries-title">We build the system. You own the decisions.</h2>
              <p>We configure QuoteCore+ around the information and rules you provide. You still control what you charge, verify your measurements and approve your final quotes.</p>
            </div>
            <div className={styles.boundaryCards}>
              <article><strong>We do</strong><p>Build the agreed components, pricing structure, labour and waste rules, account setup and workflow configuration.</p></article>
              <article><strong>We do not</strong><p>Choose your selling prices, guarantee source information you provide, or replace your responsibility to review final measurements and quotes.</p></article>
            </div>
          </div>
        </section>

        <section className={styles.finalSection} aria-labelledby="final-title">
          <div className={styles.finalGlow} aria-hidden="true" />
          <div className={`${styles.container} ${styles.finalInner}`}>
            <p className={styles.eyebrow}>Free 20-minute discovery call</p>
            <h2 id="final-title">Curious, but not sure you need Done For You? That is exactly what the call is for.</h2>
            <p>Show us how you work, tell us what you want to improve and ask questions. We will help you work out the easiest way to move into QuoteCore+.</p>
            <div className={styles.finalActions}>
              <DfyBookButton cta="final" size="large" label="Book free 20-minute call" />
              <MarketingButton href="/demo" variant="glass" size="large">Try the demo first</MarketingButton>
            </div>
            <small>Done-For-You setup starts from $499 USD.</small>
          </div>
        </section>

        <section className={styles.faqSection} aria-labelledby="faq-title">
          <div className={`${styles.container} ${styles.faqGrid}`}>
            <div className={styles.faqIntro}>
              <p className={styles.lightEyebrow}>Common questions</p>
              <h2 id="faq-title">Before you book the call.</h2>
              <p>A chance to see whether Done For You would make your move into QuoteCore+ easier.</p>
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
