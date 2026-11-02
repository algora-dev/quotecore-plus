import { FreeWorkspaceButton } from '@/components/marketing/FreeWorkspaceButton';
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
          <p className={s.eyebrow}>Inside your Free Workspace</p>
          <h2 id="demo-title" className={s.sectionTitle}>Learn the workflow, then use your own workspace.</h2>
          <p className={s.bodyCopy}>Create your real Free Workspace first. When you want a structured introduction, open the optional Guided Walkthrough and step into a ready-made roofing business for the four core tasks.</p>
          <div className={s.demoCtas}>
            <FreeWorkspaceButton variant="primary" size="large" className={s.button} icon={<Icon name="arrow" />}>Create Free Workspace</FreeWorkspaceButton>
            <DemoCallButton bookingHref={config.bookingHref} location="try-it" />
          </div>
          <div className={s.reassurance}>
            <span><Icon name="check" size={16} />No card</span>
            <span><Icon name="check" size={16} />No expiry</span>
            <span><Icon name="check" size={16} />Guided Walkthrough optional</span>
          </div>
        </div>
        <DemoCarousel />
      </div>
    </section>
  );
}
