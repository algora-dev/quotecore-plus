import { MarketingButton } from '@/components/marketing/MarketingButton';
import styles from './LimitedTimeJobStrip.module.css';

/** Homepage-only strip, immediately after hero. One CTA, no extra claims. */
export function LimitedTimeJobStrip() {
  return <section className={styles.strip} aria-label="Limited-time personalized job demonstration">
    <div className={styles.inner}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>LIMITED-TIME OFFER</p>
        <h2>Send us a job you’ve already quoted. <strong>We’ll show you how it could be faster or easier in QuoteCore+.</strong></h2>
        <p className={styles.finePrint}>Fill our short form and we’ll email you a screen recording showing how we’d quote your job in the app.</p>
      </div>
      <MarketingButton href="/your-job-demo" variant="glass" size="large" className={styles.cta}>Learn more <span aria-hidden="true">→</span></MarketingButton>
    </div>
  </section>;
}
