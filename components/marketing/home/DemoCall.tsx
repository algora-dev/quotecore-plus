'use client';
import { useState } from 'react';
import { trackEvent } from '@/lib/analytics';
import { FocusDialog } from './FocusDialog';
import { Icon } from './Icon';
import { safeBookingHref } from './homepage-config';
import s from './Homepage.module.css';
import controls from '../MarketingButton.module.css';

/**
 * Founder call CTA retained under the historical component name to avoid broad
 * import churn. Public copy is intentionally call-first, not demo-first.
 */
export function DemoCallButton({ bookingHref, label = 'Book 25 minutes with Shaun', location = 'hero', primary = false }: {
  bookingHref: string; label?: string; location?: string; primary?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const href = safeBookingHref(bookingHref);
  return <>
    <button type="button" className={`${controls.button} ${s.button} ${primary ? s.primary : `${controls.glass} ${s.glass}`}`} aria-haspopup="dialog"
      onClick={() => { setOpen(true); trackEvent('homepage_shaun_call_open', { location }); }}>
      <Icon name="calendar" />{label}
    </button>
    {open && <FocusDialog eyebrow="25 minutes · Free · No pressure" title="Tell Shaun how you work" onClose={() => setOpen(false)}>
      <p className={s.dialogIntro}>Talk Shaun through how you currently measure, price and quote. He’ll help you work out where QuoteCore+ could make the process faster or easier.</p>
      <ol className={s.dialogSteps}>
        {[
          ['Tell Shaun', 'Explain how you work today. No presentation or camera required.'],
          ['See what fits', 'Talk through the QuoteCore+ workflow and features that could actually help.'],
          ['Take something useful', 'Get Shaun’s #1 tip for winning more of the jobs you already quote.'],
        ].map(([title, text], i) => <li key={title}><span>0{i + 1}</span><div><strong>{title}</strong><p>{text}</p></div></li>)}
      </ol>
      <div className={s.teamStrip}><Icon name="people" size={26} /><p><strong>Shaun · Founder</strong><span>20+ years in roofing and construction. No obligation to buy anything on the call.</span></p></div>
      <div className={s.dialogAction}>
        {href ? <a href={href} className={`${s.button} ${s.primary}`} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
          onClick={() => trackEvent('homepage_booking_calendar_open', { location })}>Choose a time<Icon name="arrow" /></a>
          : <a href="/contact" className={`${s.button} ${s.primary}`}>Contact Shaun<Icon name="arrow" /></a>}
        <p className={s.smallNote}>Opening this window does not book an appointment.</p>
      </div>
    </FocusDialog>}
  </>;
}
