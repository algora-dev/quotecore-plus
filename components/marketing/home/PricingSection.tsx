import { MarketingButton } from '@/components/marketing/MarketingButton';
import { Icon } from './Icon';
import s from './Homepage.module.css';
import p from './PricingSection.module.css';

/** Subscription pricing: a short introduction to the dedicated pricing tool. */
export function PricingSection({ pricingHref = '/pricing' }: { pricingHref?: string }) {
  return <section id="pricing" className={p.section} aria-labelledby="pricing-title">
    <svg className={p.backdrop} viewBox="0 0 1440 360" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="pricing-paper-dots" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r=".7" fill="#758398" />
        </pattern>
      </defs>
      <g className={p.topPattern}>
        <path d="M0 0h282l-42 22H0Z" fill="#e8edf3" />
        <path d="M-40 12h270l65-44M-40 23h276l80-55M-40 34h282l95-66" fill="none" stroke="#8a99ac" strokeWidth="1" opacity=".24" />
        <path d="M-20 45h268l62-42" fill="none" stroke="#f05b22" strokeWidth="1" opacity=".22" />
      </g>
      <path d="M1204 360l154-154h82v154Z" fill="#e8edf3" />
      <path d="M1294 360l116-116h30v116Z" fill="#faeadd" />
      <g fill="none" stroke="#8a99ac" strokeWidth="1" opacity=".24">
        <path d="M1135 382l210-210h150M1160 382l210-210h125M1185 382l210-210h100M1210 382l210-210h75" />
      </g>
      <path d="M1235 382l185-185h70" fill="none" stroke="#f05b22" strokeWidth="1" opacity=".28" />
      <g fill="url(#pricing-paper-dots)" opacity=".16">
        <path d="M0 314h208v46H0Z" />
        <path d="M1344 0h96v54h-96Z" />
      </g>
    </svg>
    <div className={`${s.container} ${p.layout}`}>
      <div className={p.heading}>
        <p className={`${s.eyebrow} ${p.eyebrow}`}>Flexible subscriptions</p>
        <h2 id="pricing-title" className={p.title}>Only pay for what<br className={p.lineBreak} /> <span>your business needs.</span></h2>
      </div>
      <div className={p.content}>
        <p className={p.description}>Different businesses need different tools. Choose the features you want and build a QuoteCore+ subscription around the way you work.</p>
        <MarketingButton href={pricingHref} variant="primary" size="large" className={`${s.button} ${p.cta}`} icon={<Icon name="arrow" size={18} />}>Explore Pricing</MarketingButton>
      </div>
    </div>
  </section>;
}
