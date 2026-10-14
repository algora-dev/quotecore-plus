import { MarketingButton } from '@/components/marketing/MarketingButton';
import { DemoCallButton } from './DemoCall';
import { Icon } from './Icon';
import type { HomepageConfig } from './homepage-config';
import s from './Homepage.module.css';
import c from './FinalCtaSection.module.css';

export function FinalCtaSection({ config }: { config: Pick<HomepageConfig, 'demoHref' | 'bookingHref'> }) {
  return <section id="next-step" className={c.section} aria-labelledby="next-step-title">
    <div className={`${s.container} ${c.inner}`}>
      <div className={c.heading}>
        <div><p className={`${s.eyebrow} ${c.eyebrow}`}>Your next step</p>
          <h2 id="next-step-title">Your next quote starts here.</h2></div>
        <p>Try a job, build your plan, or talk it through with us.</p>
      </div>
      <div className={c.paths}>
        <article className={c.path}>
          <span className={`${c.icon} ${c.demoIcon}`}><Icon name="play" size={23} /></span>
          <h3>See it for yourself.</h3>
          <p>Explore a sample roofing job at your own pace. No account needed.</p>
          <div className={c.actions}><MarketingButton href={config.demoHref} variant="primary" icon={<Icon name="arrow" size={17} />}>Explore the demo</MarketingButton></div>
        </article>
        <article className={c.path}>
          <span className={c.icon}><Icon name="calculator" size={23} /></span>
          <h3>Make it your own.</h3>
          <p>Choose the tools your business needs, see your price and get started.</p>
          <div className={c.actions}><MarketingButton href="/pricing" variant="glass" icon={<Icon name="arrow" size={17} />}>See pricing &amp; build your plan</MarketingButton></div>
        </article>
        <article className={c.path}>
          <span className={c.icon}><Icon name="people" size={23} /></span>
          <h3>Let’s talk it through.</h3>
          <p>A free 15-minute demo call. Tell us how you work and ask what you need.</p>
          <div className={c.actions}><DemoCallButton bookingHref={config.bookingHref} label="Book a free call" location="final-cta" /></div>
          <a className={c.setupLink} href="/done-for-you-setup" target="_blank" rel="noopener noreferrer">Want us to set it up? Explore Done For You<Icon name="arrow" size={14} /></a>
        </article>
      </div>
      <div className={c.footer}><span><Icon name="check" size={16} />Start your way. We’re here to help.</span>
        <a href="#questions">Still have questions? Browse the FAQs below<Icon name="chevron" size={16} /></a></div>
    </div>
  </section>;
}
