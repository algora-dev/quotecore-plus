import { FreeWorkspaceButton } from '@/components/marketing/FreeWorkspaceButton';
import { DemoCallButton } from './DemoCall';
import { Icon } from './Icon';
import type { HomepageConfig } from './homepage-config';
import s from './Homepage.module.css';
import c from './FinalCtaSection.module.css';

export function FinalCtaSection({ config }: { config: Pick<HomepageConfig, 'bookingHref'> }) {
  return <section id="next-step" className={c.section} aria-labelledby="next-step-title" data-analytics-location="homepage_final" data-analytics-surface="homepage_final_cta">
    <div className={`${s.container} ${c.inner}`}>
      <div className={c.heading}>
        <div><p className={`${s.eyebrow} ${c.eyebrow}`}>Two ways to start</p>
          <h2 id="next-step-title">Try it yourself, or talk it through with Shaun.</h2></div>
        <p>No card. No expiry. No need to pick a paid plan first.</p>
      </div>
      <div className={c.paths}>
        <article className={c.path}>
          <span className={`${c.icon} ${c.demoIcon}`}><Icon name="spark" size={23} /></span>
          <h3>Create your Free Workspace.</h3>
          <p>Use QuoteCore+ on your own jobs, try the optional guided walkthrough and keep the workspace for as long as you want.</p>
          <div className={c.actions}><FreeWorkspaceButton variant="primary" icon={<Icon name="arrow" size={17} />}>Create Free Workspace</FreeWorkspaceButton></div>
        </article>
        <article className={c.path}>
          <span className={c.icon}><Icon name="people" size={23} /></span>
          <h3>Spend 25 minutes with Shaun.</h3>
          <p>Tell Shaun how you quote now, see where QuoteCore+ could help, and take away his #1 tip for winning more of the jobs you already quote.</p>
          <div className={c.actions}><DemoCallButton bookingHref={config.bookingHref} label="Book a free 25-minute call" location="final-cta" primary /></div>
        </article>
      </div>
      <div className={c.footer}><span><Icon name="check" size={16} />Start whichever way suits you.</span>
        <a href="#questions">Still have questions? Browse the FAQs below<Icon name="chevron" size={16} /></a></div>
    </div>
  </section>;
}
