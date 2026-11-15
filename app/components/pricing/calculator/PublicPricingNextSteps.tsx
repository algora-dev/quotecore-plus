'use client';

import Link from 'next/link';
import styles from './PublicPricingNextSteps.module.css';

/** Public-only next steps. No Stripe session, plan change or billing action. */
export function PublicPricingNextSteps({ callHref, doneForYouHref }: { callHref: string; doneForYouHref: string }) {
  return <section className={styles.steps} aria-label="What to do with your estimated QuoteCore+ plan">
    <p className={styles.heading}>Prefer someone to help?</p>
    <div className={styles.grid}>
      <a href={callHref} className={styles.card} target={callHref.startsWith('https://') ? '_blank' : undefined} rel={callHref.startsWith('https://') ? 'noopener noreferrer' : undefined}>
        <strong>Book a free 25-minute call <span aria-hidden="true">↗</span></strong>
        <span>Talk through your workflow and what features you need. No obligation.</span>
      </a>
      <Link href={doneForYouHref} className={styles.card}>
        <strong>Explore Done For You setup <span aria-hidden="true">→</span></strong>
        <span>We configure your pricing, help choose the plan and train you. From US$199.</span>
      </Link>
    </div>
    <p className={styles.footer}>Want this subscription? Create a free workspace using the button above. Paid plans are chosen and activated inside your account under Billing & Pricing, not on this page.</p>
  </section>;
}
