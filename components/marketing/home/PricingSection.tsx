import { MarketingButton } from '@/components/marketing/MarketingButton';
import { FreeWorkspaceButton } from '@/components/marketing/FreeWorkspaceButton';
import { Icon } from './Icon';
import s from './Homepage.module.css';
import p from './PricingSection.module.css';

/** Public pricing stays explanatory. Exact configuration lives inside Billing. */
export function PricingSection({ pricingHref = '/pricing' }: { pricingHref?: string }) {
  return <section id="pricing" className={p.section} aria-labelledby="pricing-title">
    <svg className={p.backdrop} viewBox="0 0 1440 360" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs><pattern id="pricing-paper-dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".7" fill="#758398" /></pattern></defs>
      <g className={p.topPattern}><path d="M0 0h282l-42 22H0Z" fill="#e8edf3" /><path d="M-40 12h270l65-44M-40 23h276l80-55M-40 34h282l95-66" fill="none" stroke="#8a99ac" strokeWidth="1" opacity=".24" /><path d="M-20 45h268l62-42" fill="none" stroke="#f05b22" strokeWidth="1" opacity=".22" /></g>
      <path d="M1204 360l154-154h82v154Z" fill="#e8edf3" /><path d="M1294 360l116-116h30v116Z" fill="#faeadd" />
    </svg>
    <div className={`${s.container} ${p.layout}`}>
      <div className={p.heading}>
        <p className={`${s.eyebrow} ${p.eyebrow}`}>Try first. Price later.</p>
        <h2 id="pricing-title" className={p.title}>Don&apos;t pay for something<br className={p.lineBreak} /> <span>you don&apos;t need.</span></h2>
      </div>
      <div className={p.content}>
        <p className={p.description}>Start with a Free Workspace. Learn which features actually help, then build your exact plan inside your account only if you need more features, capacity or usage.</p>
        <div className={p.actions}>
          <FreeWorkspaceButton variant="primary" size="large" className={`${s.button} ${p.cta}`} icon={<Icon name="arrow" size={18} />}>Create Free Workspace</FreeWorkspaceButton>
          <MarketingButton href={pricingHref} variant="glass" size="large" className={`${s.button} ${p.cta}`}>See how pricing works</MarketingButton>
        </div>
      </div>
    </div>
  </section>;
}
