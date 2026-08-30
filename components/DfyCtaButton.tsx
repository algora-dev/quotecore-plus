'use client';

import Link from 'next/link';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

const styles = {
  primary:
    'inline-block rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]',
  outline:
    'inline-block rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 transition-all hover:border-slate-400 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]',
};

/** Tracked CTA link for the Done-For-You page. */
export default function DfyCtaButton({
  event,
  label = 'Book a 15-minute fit call',
  variant = 'primary',
}: {
  event: string;
  label?: string;
  variant?: 'primary' | 'outline';
}) {
  return (
    <Link
      href="/contact"
      className={styles[variant]}
      onClick={() => {
        if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
          window.gtag('event', event);
        }
      }}
    >
      {label}
    </Link>
  );
}
