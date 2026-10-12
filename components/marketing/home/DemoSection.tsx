import { MarketingButton } from '@/components/marketing/MarketingButton';
import { DemoCallButton } from './DemoCall';
import { DeviceBadge } from './DeviceBadge';
import { DemoCarousel } from './DemoCarousel';
import { Icon } from './Icon';
import type { HomepageConfig } from './homepage-config';
import s from './Homepage.module.css';

/** These are capabilities to explore, not a list of the demo's guided tasks. */
export function DemoSection({ config }: { config: Pick<HomepageConfig, 'demoHref' | 'bookingHref'> }) {
  return (
    <section id="try-it" className={`${s.section} ${s.demoSection}`} aria-labelledby="demo-title">
      <div className={`${s.container} ${s.demoGrid}`}>
        <div className={s.demoCopy}>
          <div className={s.demoDevice}><DeviceBadge label="Mobile + desktop" /></div>
          <p className={s.eyebrow}>The guided demo</p>
          <h2 id="demo-title" className={s.sectionTitle}>Try the app features yourself.</h2>
          <p className={s.bodyCopy}>Step into a ready-made roofing business and follow a guided demo from creating a pricing component and measuring a roof to editing a customer quote, then asking your Smart Assistant to complete tasks for you.</p>
          <div className={s.demoCtas}>
            <MarketingButton href={config.demoHref} variant="primary" size="large" className={s.button} icon={<Icon name="arrow" />}>Start the guided demo</MarketingButton>
            <DemoCallButton bookingHref={config.bookingHref} location="try-it" />
          </div>
          <div className={s.reassurance}>
            <span><Icon name="check" size={16} />No sign-up</span>
            <span><Icon name="check" size={16} />No credit card</span>
            <span><Icon name="check" size={16} />No trial</span>
          </div>
        </div>
        <DemoCarousel />
      </div>
    </section>
  );
}
