import type { Metadata } from 'next';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import { MarketingButton } from '@/components/marketing/MarketingButton';
import { JobDemoInquiryForm } from './JobDemoInquiryForm';
import { workflowCallHref } from '@/lib/booking';
import styles from './JobDemo.module.css';

export const metadata: Metadata = {
  title: 'See Your Own Quoted Job in QuoteCore+ | Limited-Time Offer',
  description: 'Send us a job you have already quoted. We will record a personalized walkthrough showing how that job could be measured, priced and quoted faster or more easily in QuoteCore+.',
  alternates: { canonical: 'https://quote-core.com/your-job-demo' },
};

export default function YourJobDemoPage() {
  return <>
    <BlogHeader />
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="job-demo-heading">
        <div className={styles.container}>
          <p className={styles.darkEyebrow}>LIMITED-TIME OFFER</p>
          <h1 id="job-demo-heading">You’ve already quoted the job.<br/><span>Now see a better way to do it.</span></h1>
          <p className={styles.heroLead}>Send us what you used to measure, price and quote a real job. We’ll record a personalized QuoteCore+ walkthrough and send you the video to keep.</p>
          <div className={styles.heroActions}>
            <MarketingButton href="#send-your-job" variant="primary" size="large">Show us your job <span aria-hidden="true">→</span></MarketingButton>
            <a className={styles.callLink} href={workflowCallHref}>Prefer a 25-minute call?</a>
          </div>
        </div>
      </section>
      <section className={styles.how} aria-label="How the offer works">
        <div className={styles.container}>
          <div className={styles.howRow}><span><b>01</b> Share a job you quoted</span><span><b>02</b> We recreate your workflow</span><span><b>03</b> We email your recording</span></div>
        </div>
      </section>
      <section className={styles.formSection} id="send-your-job" aria-labelledby="send-job-title">
        <div className={styles.container}>
          <div className={styles.intro}><p className={styles.lightEyebrow}>YOUR JOB, YOUR RECORDING</p><h2 id="send-job-title">Show us what you have.</h2><p>An old quote, photos, measurements or a roof plan are all useful. More information helps us make your video relevant. If we need anything else, we’ll reply by email.</p></div>
          <JobDemoInquiryForm />
        </div>
      </section>
    </main>
    <SiteFooter />
  </>;
}
