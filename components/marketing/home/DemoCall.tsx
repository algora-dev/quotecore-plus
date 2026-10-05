'use client';
import { useState } from 'react';
import { trackEvent } from '@/lib/analytics';
import { FocusDialog } from './FocusDialog';
import { Icon } from './Icon';
import { safeBookingHref } from './homepage-config';
import s from './Homepage.module.css';
import controls from '../MarketingButton.module.css';

export function DemoCallButton({ bookingHref, label = 'Book a Free Demo Call', location = 'hero', primary = false }: {
  bookingHref: string; label?: string; location?: string; primary?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const href = safeBookingHref(bookingHref);
  return <>
    <button type="button" className={`${controls.button} ${s.button} ${primary ? s.primary : `${controls.glass} ${s.glass}`}`} aria-haspopup="dialog"
      onClick={() => { setOpen(true); trackEvent('homepage_demo_call_open', { location }); }}>
      <Icon name="calendar" />{label}
    </button>
    {open && <FocusDialog eyebrow="15 minutes · Free · No pressure" title="See how it could fit the way you work" onClose={() => setOpen(false)}>
      {/* Approved explanatory copy from pricing-selector v5 ActionModals.tsx. */}
      <p className={s.dialogIntro}>Tell us how you measure and price today. We’ll share our screen, show the tools that fit and answer your questions.</p>
      <ol className={s.dialogSteps}>
        {[
          ['Your workflow', 'Tell us how you work today.'],
          ['A relevant demo', 'See the tools that make sense for your business.'],
          ['Your questions', 'Ask what you need. No pressure to sign up.'],
        ].map(([title, text], i) => <li key={title}><span>0{i + 1}</span><div><strong>{title}</strong><p>{text}</p></div></li>)}
      </ol>
      <div className={s.teamStrip}><Icon name="people" size={26} /><p><strong>A real member of the QuoteCore+ team.</strong><span>A conversation about your work, not a sales script.</span></p></div>
      <div className={s.dialogAction}>
        {href ? <a href={href} className={`${s.button} ${s.primary}`} target="_blank" rel="noopener noreferrer"
          onClick={() => trackEvent('homepage_booking_calendar_open', { location })}>Choose a time<Icon name="arrow" /></a>
          : <><button type="button" className={`${s.button} ${s.primary}`} disabled>Choose a time<Icon name="arrow" /></button>
            <p className={s.connectionNote}>The booking calendar is not connected yet. No appointment can be booked from this preview.</p></>}
        <p className={s.smallNote}>{href ? 'Opens the booking calendar in a new tab. ' : ''}Opening this window does not book an appointment.</p>
      </div>
    </FocusDialog>}
  </>;
}
