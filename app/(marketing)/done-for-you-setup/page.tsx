import type { Metadata } from 'next';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import DfyPageViewTracker from '@/components/DfyPageViewTracker';
import { DoneForYouInquiryButton } from '@/components/marketing/DoneForYouInquiryButton';
import { MarketingButton } from '@/components/marketing/MarketingButton';
import { doneForYouCallHref } from '@/lib/booking';
import YouTubeLite from '@/components/YouTubeLite';
import { siteUrl, buildBreadcrumbSchema } from '@/lib/schema';
import { hreflangLanguages } from '@/lib/seo/hreflang';
import styles from './DoneForYouSetup.module.css';

export const metadata: Metadata = {
  title: 'Done For You QuoteCore+ Setup | Get a Tailored Proposal',
  description: 'From US$199: up to 15 Smart Components, three months of entry-level QuoteCore+, personalised training and three months of support. Enquire or book a 25-minute call before paying.',
  alternates: {
    canonical: 'https://quote-core.com/done-for-you-setup',
    languages: hreflangLanguages('/done-for-you-setup'),
  },
  openGraph: {
    title: 'Done For You QuoteCore+ Setup | Get a Tailored Proposal',
    description: 'Done For You QuoteCore+ setup from US$199. Pricing components, three months of software, a live or recorded walkthrough, and three months of support.',
    url: 'https://quote-core.com/done-for-you-setup',
    siteName: 'QuoteCore+',
    type: 'website',
    images: [{ url: '/images/social/og-done-for-you.jpg', width: 1200, height: 630, alt: 'QuoteCore+ Done For You Setup' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Done For You QuoteCore+ Setup | Get a Tailored Proposal',
    description: 'A tailored Done For You setup from US$199. Talk to our team or send a form, agree the full scope, then pay.',
    images: ['/images/social/og-done-for-you.jpg'],
  },
};

const breadcrumbSchema = buildBreadcrumbSchema([
  { name: 'Home', url: siteUrl },
  { name: 'Done For You Setup', url: `${siteUrl}/done-for-you-setup` },
]);

const faqs = [
  { q: 'Do I need to pay before sending my details?', a: 'No. Send an enquiry or book a 25-minute call. Our team reviews your setup, asks for anything missing, and sends a proposal with the full scope, subscription and price. A secure Stripe payment link is provided only after you agree.' },
  { q: 'What does the US$199 base package include?', a: 'Up to 15 Smart Components using your supplied pricing and rules, the entry paid QuoteCore+ configuration for three months, a live handover or custom recorded walkthrough, and three months of reasonable setup and product support. More pricing components, higher usage or extended services are quoted separately.' },
  { q: 'Can I change the proposal?', a: 'Yes. We can adjust the number of components, features and training before you accept or pay.' },
  { q: 'What do I need to provide?', a: 'Tell us how you measure and quote, how many products and rates you use, and what you would like configured. Spreadsheets, supplier lists, labour rates, old quotes and notes are all helpful. We will request files or details we still need.' },
  { q: 'What happens after the first three months?', a: 'You can continue on the paid configuration agreed in your proposal at the disclosed ongoing monthly price, or change or cancel it under the subscription terms. We will explain this before you make a payment.' },
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

const callSteps = [
  { step: '01 · SHARE', title: 'Tell us what you need', body: 'Send the step-by-step enquiry or book a free 25-minute call. Explain how you work and which pricing or tools you would like.' },
  { step: '02 · AGREE', title: 'We scope your setup', body: 'A member of our team reviews the details, asks questions if needed, and sends a proposal with the exact configuration, subscription and one-time price.' },
  { step: '03 · BEGIN', title: 'Approve, then pay securely', body: 'You can request changes or decline. Once you approve the scope, we send your Stripe payment link. Only then do we start the agreed setup.' },
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
                <p className={styles.eyebrow}>Done For You QuoteCore+ setup</p>
                <h1 id="dfy-title"><span className={styles.heroPrimary}>Your setup, handled for you.</span><br /><span className={styles.heroGradient}>From US$199.</span></h1>
                <p className={styles.heroLead}>We configure your pricing, help you choose the right tools, and show you how to use QuoteCore+ on your own work. Send an enquiry or book a 25-minute call. We confirm the full price before you pay.</p>
                <div className={styles.heroActions}>
                  <DoneForYouInquiryButton formOnly size="large" source="dfy-hero">Send a setup enquiry</DoneForYouInquiryButton>
                  <MarketingButton href={doneForYouCallHref} size="large" variant="glass">Book a 25-minute call</MarketingButton>
                </div>
                <div className={styles.tipStrip}>
                  <img src="/shaun-smiling.jpg" alt="" aria-hidden="true" />
                  <p><strong>Prefer to talk it through?</strong> Book 25 minutes to discuss your workflow, required pricing and features. We will send a proposal you can review and change, with no obligation.</p>
                </div>
              </div>

              <aside className={styles.offerCard} aria-label="Done For You setup starting price and inclusions">
                <p className={styles.offerKicker}>Done For You setup</p>
                <div className={styles.startPrice}><strong>$199</strong><small>USD · from</small></div>
                <div className={styles.offerRule} />
                <ul>
                  <li><CheckIcon /><span><strong>Your account configured for you</strong><br />Up to 15 components and agreed core setup</span></li>
                  <li><CheckIcon /><span><strong>3 months of QuoteCore+ included</strong><br />Entry paid configuration; higher tiers quoted separately</span></li>
                  <li><CheckIcon /><span><strong>Personalised handover</strong><br />One live walkthrough or a custom recording</span></li>
                  <li><CheckIcon /><span><strong>3 months of ongoing support</strong><br />Setup and product help after handover</span></li>
                </ul>
              </aside>
            </div>
          </div>
        </section>

        <section id="how-it-works" className={styles.processSection} aria-labelledby="process-title">
          <div className={styles.container}>
            <div className={styles.sectionIntroSingle}>
              <p className={styles.lightEyebrow}>Prefer to talk it through?</p>
              <h2 id="process-title">Tell us what you need. We’ll do the setup.</h2>
            </div>
            <ol className={styles.processList}>
              {callSteps.map((item) => (
                <li key={item.step}>
                  <span className={styles.processNum}>{item.step}</span>
                  <div><h3>{item.title}</h3><p>{item.body}</p></div>
                </li>
              ))}
            </ol>
            <div className={styles.discoveryNote}>
              <p><strong>There is no obligation to purchase anything after the call or enquiry.</strong> A member of our team will confirm the setup requirements, suggested subscription and final price. You can ask for changes before we send the secure Stripe payment link.</p>
              <DoneForYouInquiryButton formOnly source="dfy-process">Send an enquiry</DoneForYouInquiryButton>
            </div>
          </div>
        </section>

        <section className={styles.videoSection} aria-labelledby="video-title">
          <div className={styles.container}>
            <div className={styles.videoIntro}>
              <div>
                <p className={styles.lightEyebrow}>See how it works</p>
                <h2 id="video-title">A closer look at Done For You.</h2>
              </div>
              <p>See the Done For You process in context before deciding whether you want to talk it through or send an enquiry.</p>
            </div>
            <YouTubeLite videoId="fJYVEnVTcOA" title="How QuoteCore+ Done For You Setup works" uploadDate="2026-10-15" className={styles.videoPlayer} />
          </div>
        </section>

        <section className={styles.pricingSection} aria-labelledby="pricing-title">
          <div className={styles.container}>
            <div className={styles.pricingHeader}>
              <div>
                <p className={styles.lightEyebrow}>Scoped to your business</p>
                <h2 id="pricing-title">Why can the price change?<br /><span className={styles.pricingGradient}>A solo operator and a larger roofing business can need very different setups.</span></h2>
              </div>
            </div>
            <p className={styles.pricingLead}>Done For You starts at US$199 for up to 15 Smart Components, three months of the entry paid configuration, your choice of live or recorded training, and three months of support. More components, higher-feature subscriptions or more extensive work receive an agreed custom price. No payment is requested until you accept the proposal.</p>
          </div>
        </section>

        <section className={styles.fitSection} aria-labelledby="handover-title">
          <div className={`${styles.container} ${styles.handoverLayout}`}>
            <div className={styles.handoverHead}>
              <p className={styles.lightEyebrow}>If you choose Done For You</p>
              <h2 id="handover-title">We set it up, then hand it over in the way that suits you.</h2>
              <p className={styles.handoverIntro}>Choose the handover that works best for you.</p>
            </div>
            <div className={styles.handoverBody}>
              <div className={styles.choiceGrid}>
                <article className={styles.choiceCard}>
                  <span>Option 1</span>
                  <h3>Live one-to-one</h3>
                  <p>Work through your configured account with Shaun using your pricing and one of your own real or previous jobs. The standard package includes one live training session.</p>
                </article>
                <article className={styles.choiceCard}>
                  <span>Option 2</span>
                  <h3>Custom recorded walkthrough</h3>
                  <p>If calls are inconvenient, Shaun can record a personalised walkthrough of your configured account, typically around 20 to 30 minutes, for you to watch and rewatch when it suits you.</p>
                </article>
              </div>
              <div className={styles.supportBox}>
                <strong>Then you have Shaun&apos;s support for three months.</strong>
                <p>Ask questions about the configuration and using the included features. Additional custom builds or new pricing work are quoted separately.</p>
              </div>
            </div>

            <aside className={styles.shaunCard}>
              <div className={styles.shaunTop}>
                <img src="/shaun-smiling.jpg" alt="Shaun, founder of QuoteCore+" />
                <div><strong>Shaun · Founder</strong><span>20+ years roofing & construction</span></div>
              </div>
              <p>You are dealing directly with someone who understands both roofing and the QuoteCore+ setup, not a generic software onboarding team.</p>
            </aside>
          </div>
        </section>

        <section className={styles.finalSection} aria-labelledby="final-title">
          <div className={styles.finalGlow} aria-hidden="true" />
          <div className={`${styles.container} ${styles.finalInner}`}>
            <p className={styles.eyebrow}>Done For You enquiry</p>
            <h2 id="final-title">Tell us how you work.<br />Get a tailored proposal.</h2>
            <p>Tell us about your business through the form or a free 25-minute call. We will recommend a setup, agree the price with you, and send a payment link only when you are happy with the proposal.</p>
            <div className={styles.finalActions}>
              <DoneForYouInquiryButton formOnly size="large" source="dfy-final">Send a setup enquiry</DoneForYouInquiryButton>
              <MarketingButton href={doneForYouCallHref} variant="glass" size="large">Book a 25-minute call</MarketingButton>
            </div>
            <div className={styles.finalTip}><img src="/shaun-smiling.jpg" alt="" aria-hidden="true" /><span><strong>No obligation:</strong> review and revise the proposal before you make any payment.</span></div>
          </div>
        </section>

        <section className={styles.faqSection} aria-labelledby="faq-title">
          <div className={`${styles.container} ${styles.faqGrid}`}>
            <div className={styles.faqIntro}>
              <p className={styles.lightEyebrow}>Common questions</p>
              <h2 id="faq-title">A few things worth knowing.</h2>
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
