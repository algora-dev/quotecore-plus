'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import { setPricingSetupPreference } from '../actions';
import '../setup.css';

type SetupOption = {
  title: string;
  body: string;
  category: string;
  linkText: string;
  href: string;
  service?: boolean;
  price?: string;
  recommended?: boolean;
};

export function PricingSetupEntry({ workspaceSlug, seen, alwaysOpenLibrary }: {
  workspaceSlug: string;
  seen: boolean;
  alwaysOpenLibrary: boolean;
}) {
  const [always, setAlways] = useState(alwaysOpenLibrary);
  const [error, setError] = useState('');
  useEffect(() => { if (!seen) void setPricingSetupPreference(false); }, [seen]);
  const options: SetupOption[] = [
    {
      title: 'Set up my pricing manually', category: 'DO IT MYSELF',
      body: 'Add the products, materials, labour rates and services you use. Start from scratch or use the guided creator.',
      linkText: 'Open manual setup', href: `/${workspaceSlug}/components`,
    },
    {
      title: 'Pricing Setup Assistant', category: 'SELF-SERVICE · RECOMMENDED',
      body: 'Upload a spreadsheet, PDF or photo of your prices, paste a list, or start from a ready-made roofing library. Bulk import — we help you review each component before it goes live.',
      linkText: 'Open setup assistant', href: `/${workspaceSlug}/pricing/assistant`, recommended: true,
    },
    {
      title: 'Quick Start', category: 'WE PREPARE YOUR PRICING', price: 'US$99',
      body: 'We set your pricing up — up to 15 individual components. Just send us enough information. A faster start that skips the learning curve and gets you quoting sooner.',
      linkText: 'View Quick Start package',
      href: `https://quote-core.com/quick-start-pricing?workspace=${encodeURIComponent(workspaceSlug)}`, service: true,
    },
    {
      title: 'Full Done For You Setup', category: 'WE CONFIGURE AND TRAIN', price: 'From US$499',
      body: 'Broader setup for your business, personal training, three months of software and extended support.',
      linkText: 'Explore full setup', href: 'https://quote-core.com/done-for-you-setup', service: true,
    },
  ];

  return <main className="ps-page" aria-labelledby="ps-title">
    <header className="ps-head">
      <p className="ps-eyebrow">MY PRICING LIBRARY</p>
      <h1 id="ps-title">How would you like to get your pricing set up?</h1>
      <p>Your pricing is the materials, products, labour rates, services and charges you use to quote a job. Choose how you want to get started.</p>
    </header>
    <div className="ps-grid" aria-label="Choose how to set up pricing">
      {options.map(option => <Link
        href={option.href} key={option.title}
        className={`ps-option ${option.service ? 'ps-option-service' : 'ps-option-self'} ${option.recommended ? 'ps-option-recommended' : ''}`}
        target={option.service ? '_blank' : undefined} rel={option.service ? 'noopener noreferrer' : undefined}
      >
        <div className="ps-option-top">
          <span className="ps-option-category">{option.category}</span>
          {option.price && <span className="ps-option-price">{option.price}</span>}
        </div>
        <h2>{option.title}</h2>
        <p>{option.body}</p>
        <span className="ps-option-link">{option.linkText}<span aria-hidden="true">{option.service ? ' ↗' : ' →'}</span></span>
        {option.service && <span className="ps-option-service-note">Opens the QuoteCore+ website</span>}
      </Link>)}
    </div>
    <section className="ps-foot" aria-label="Go straight to your pricing library">
      <div><h2>Already know your way around?</h2><p>Open your existing library. You can return to these options whenever you need help.</p></div>
      <Link className="qc-button" data-qc-variant="secondary" data-qc-size="md" href={`/${workspaceSlug}/components`}>Open My Pricing Library <QcIcon name="arrow" /></Link>
    </section>
    <label className="ps-preference"><input type="checkbox" checked={always} onChange={async e => {
      const next = e.target.checked;
      setAlways(next); setError('');
      const result = await setPricingSetupPreference(next);
      if (!result.ok) { setAlways(!next); setError(result.message || 'Could not save preference.'); }
    }} /> Always take me straight to My Pricing Library</label>
    {error && <p role="alert" className="ps-error">{error}</p>}
    <p className="ps-note">You can change how you get help at any time. Pricing from your own files requires review and confirmation. Ready-made practice prices stay clearly marked and cannot be sent to customers until verified.</p>
  </main>;
}
