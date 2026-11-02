import type { Metadata } from 'next';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import DfyPageViewTracker from '@/components/DfyPageViewTracker';
import { MarketingButton } from '@/components/marketing/MarketingButton';
import { DoneForYouInquiryButton } from '@/components/marketing/DoneForYouInquiryButton';
import YouTubeLite from '@/components/YouTubeLite';
import { siteUrl, buildBreadcrumbSchema } from '@/lib/schema';
import { hreflangLanguages } from '@/lib/seo/hreflang';
import styles from './DoneForYouSetup.module.css';

export const metadata: Metadata = {
  title: 'Done For You QuoteCore+ Setup | Get a Tailored Proposal',
  description: 'Tell us how you currently work and get a tailored Done For You proposal. Book 25 minutes with Shaun or send a quick enquiry in around 60 seconds.',
  alternates: {
    canonical: 'https://quote-core.com/done-for-you-setup',
    languages: hreflangLanguages('/done-for-you-setup'),
  },
  openGraph: {
    title: 'Done For You QuoteCore+ Setup | Get a Tailored Proposal',
    description: 'Tell us how you measure, price and quote. Choose a 25-minute call with Shaun or a quick enquiry and get a tailored Done For You proposal.',
    url: 'https://quote-core.com/done-for-you-setup',
    siteName: 'QuoteCore+',
    type: 'website',
    images: [{ url: '/images/social/og-done-for-you.jpg', width: 1200, height: 630, alt: 'QuoteCore+ Done For You Setup' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Done For You QuoteCore+ Setup | Get a Tailored Proposal',
    description: 'Book 25 minutes with Shaun or send a quick 60-second enquiry and get a tailored Done For You proposal.',
    images: ['/images/social/og-done-for-you.jpg'],
  },
};

const breadcrumbSchema = buildBreadcrumbSchema([
  { name: 'Home', url: siteUrl },
  { name: 'Done For You Setup', url: `${siteUrl}/done-for-you-setup` },
]);

const faqs = [
  {
    q: 'Do I have to book a call?',
    a: 'No. If you prefer, send a quick enquiry in around 60 seconds. Shaun can review how you work, your quote volume, how many pricing elements need configuring and your preferred handover, then email you a tailored proposal without a call.',
  },
  {
    q: 'What do I need to send Shaun?',
    a: 'Whatever you already use can help: price lists, spreadsheets, supplier information, labour rates, old quotes or notes. It does not need to be cleaned up first, and you may not need to send anything until after the initial enquiry.',
  },
  {
    q: 'What happens after the first three months?',
    a: 'You can continue on the QuoteCore+ plan that makes sense for your ongoing usage. The expected plan and price are made clear as part of the Done For You scope before you commit.',
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

const callSteps = [
  {
    step: '01 · Tell',
    title: 'Tell Shaun how you currently work',
    body: 'How you measure, price and quote today, roughly how often you quote, what pricing you already have, and what currently feels slow or difficult.',
  },
  {
    step: '02 · Work it out',
    title: 'Figure out what you would actually need',
    body: 'Which QuoteCore+ features would help, roughly how much you would use them, how much setup work is involved, and what kind of handover would suit you.',
  },
  {
    step: '03 · 25 minutes well spent',
    title: '25 minutes well spent, either way',
    body: 'Whether we set everything up or you decide to do it yourself, you will leave with a much clearer understanding of how QuoteCore+ can help, plus one practical idea you can use to win more of the quotes you already send.',
  },
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
                <h1 id="dfy-title"><span className={styles.heroPrimary}>Tell us how you work.</span><br /><span className={styles.heroGradient}>We&apos;ll scope the rest.</span></h1>
                <p className={styles.heroLead}>Book 25 minutes with Shaun, or send a quick enquiry in around 60 seconds. We&apos;ll work out how QuoteCore+ could make measuring, pricing and quoting faster, what setup is involved, and what a tailored Done For You proposal would look like.</p>
                <div className={styles.heroActions}>
                  <DoneForYouInquiryButton size="large" source="dfy-hero">Inquire about Done For You</DoneForYouInquiryButton>
                  <MarketingButton href="#how-it-works" variant="glass" size="large">See how it works</MarketingButton>
                </div>
                <div className={styles.tipStrip}>
                  <img src="/shaun-smiling.jpg" alt="" aria-hidden="true" />
                  <p><strong>Prefer to talk it through?</strong> Spend 25 minutes with Shaun. Tell him how you currently work, see how QuoteCore+ could make it faster and easier, and take away his #1 tip for winning more of the jobs you already quote.</p>
                </div>
              </div>

              <aside className={styles.offerCard} aria-label="Done For You setup starting price and inclusions">
                <p className={styles.offerKicker}>Done For You setup</p>
                <div className={styles.startPrice}><strong>$499+</strong><small>USD</small></div>
                <div className={styles.offerRule} />
                <ul>
                  <li><CheckIcon /><span><strong>Your account configured for you</strong><br />Pricing, components and agreed workflow</span></li>
                  <li><CheckIcon /><span><strong>3 months of QuoteCore+ included</strong><br />The subscription level your setup actually needs</span></li>
                  <li><CheckIcon /><span><strong>Personalised handover</strong><br />Live one-to-one or a custom recorded walkthrough</span></li>
                  <li><CheckIcon /><span><strong>3 months of ongoing support</strong><br />Help while you start using it for real</span></li>
                </ul>
              </aside>
            </div>
          </div>
        </section>

        <section id="how-it-works" className={styles.processSection} aria-labelledby="process-title">
          <div className={styles.container}>
            <div className={styles.sectionIntroSingle}>
              <p className={styles.lightEyebrow}>Prefer to talk it through?</p>
              <h2 id="process-title">25 minutes with Shaun is still the fastest way to scope it.</h2>
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
              <p><strong>There is no obligation to purchase anything on the call.</strong> It is a discovery call designed to learn how you work and what you are likely to need. Tell Shaun what you can, there is no need to be on camera or physically show him anything, and we can send you a tailored proposal after the call for you to review, accept or decline in your own time.</p>
              <DoneForYouInquiryButton source="dfy-process">Inquire about Done For You</DoneForYouInquiryButton>
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
            <p className={styles.pricingLead}>Done For You starts from $499. Your final price reflects the amount of pricing and configuration work involved, the QuoteCore+ features and usage your first three months need to include, and any additional one-to-one help you want.</p>
          </div>
        </section>

        <section className={styles.fitSection} aria-labelledby="handover-title">
          <div className={`${styles.container} ${styles.handoverLayout}`}>
            <aside className={styles.shaunCard}>
              <div className={styles.shaunTop}>
                <img src="/shaun-smiling.jpg" alt="Shaun, founder of QuoteCore+" />
                <div><strong>Shaun · Founder</strong><span>20+ years roofing & construction</span></div>
              </div>
              <p>You are dealing directly with someone who understands both roofing and the QuoteCore+ setup, not a generic software onboarding team.</p>
            </aside>

            <div className={styles.handoverCopy}>
              <p className={styles.lightEyebrow}>If you choose Done For You</p>
              <h2 id="handover-title">We set it up, then hand it over in the way that suits you.</h2>
              <p className={styles.handoverIntro}>Choose the handover that works best for you.</p>
              <div className={styles.choiceGrid}>
                <article className={styles.choiceCard}>
                  <span>Option 1</span>
                  <h3>Live one-to-one</h3>
                  <p>Work through your configured account with Shaun using your pricing and one of your own real or previous jobs. The standard package includes one one-hour session.</p>
                </article>
                <article className={styles.choiceCard}>
                  <span>Option 2</span>
                  <h3>Custom recorded walkthrough</h3>
                  <p>If calls are inconvenient, Shaun can record a personalised walkthrough of your configured account, typically around 20 to 30 minutes, for you to watch and rewatch when it suits you.</p>
                </article>
              </div>
              <div className={styles.supportBox}>
                <strong>Then you have Shaun&apos;s support for three months.</strong>
                <p>A quick answer, a short video, a quick call, or help inside your account when something needs fixing or explaining. Whatever makes the most sense for the problem.</p>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.finalSection} aria-labelledby="final-title">
          <div className={styles.finalGlow} aria-hidden="true" />
          <div className={`${styles.container} ${styles.finalInner}`}>
            <p className={styles.eyebrow}>Done For You enquiry</p>
            <h2 id="final-title">Tell us how you work.<br />Get a tailored proposal.</h2>
            <p>Choose a 25-minute call with Shaun or send a quick enquiry in around 60 seconds. We&apos;ll use what you tell us to scope the setup, likely QuoteCore+ features and indicative price or range.</p>
            <div className={styles.finalActions}>
              <DoneForYouInquiryButton size="large" source="dfy-final">Inquire about Done For You</DoneForYouInquiryButton>
            </div>
            <div className={styles.finalTip}><img src="/shaun-smiling.jpg" alt="" aria-hidden="true" /><span><strong>No obligation:</strong> choose the call or the form, then review the proposal in your own time.</span></div>
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
