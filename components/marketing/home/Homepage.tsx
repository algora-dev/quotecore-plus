import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import { FreeWorkspaceButton } from '@/components/marketing/FreeWorkspaceButton';
import { DemoCallButton } from './DemoCall';
import { DoneForYouSection } from './DoneForYouSection';
import { PricingSection } from './PricingSection';
import { TestimonialsSection } from './TestimonialsSection';
import { FaqSection } from './FaqSection';
import { FinalCtaSection } from './FinalCtaSection';
import { doneForYouConfig } from './done-for-you-config';
import { WorkflowExplorer } from './WorkflowExplorer';
import { HeroSpeedProof } from './HeroSpeedProof';
import { FounderCallSection } from './FounderCallSection';
import { Icon } from './Icon';
import { homepageConfig, type HomepageConfig } from './homepage-config';
import s from './Homepage.module.css';

/** Server-rendered homepage composition using the current marketing system. */
export default function MarketingHomepage({ config = homepageConfig, preview = false }: { config?: HomepageConfig; preview?: boolean }) {
  return <div className={s.root}>
    <a className={s.skipLink} href="#homepage-main">Skip to content</a>
    <BlogHeader homepage />
    <main id="homepage-main" tabIndex={-1}>
      <section id="hero-section" className={s.hero} aria-labelledby="hero-title">
        <picture className={s.heroBackground}>
          <source media="(max-width: 640px)" srcSet="/marketing/home/roof-sunset-mobile.webp" />
          <img src="/marketing/home/roof-sunset.webp" width={1672} height={941} alt="" fetchPriority="high" loading="eager" decoding="async" />
        </picture>
        <div className={s.heroWash} aria-hidden="true" />
        <div className={`${s.container} ${s.heroGrid}`}>
          <div className={s.heroCopy}>
            <p className={s.eyebrow}>Roofing quoting software</p>
            <h1 id="hero-title">Quote roofing jobs <span className={s.heroGradient}>faster.</span><br />No matter how you <span className={s.heroGradient}>currently work.</span></h1>
            <p className={s.heroLead}>Use measurements you already have, or measure the job in QuoteCore+. Build the price, finish the quote and keep everything connected.</p>
            <div className={s.heroActions} data-analytics-location="homepage_hero" data-analytics-surface="homepage_hero_actions">
              <DemoCallButton bookingHref={config.bookingHref} label="Book a free 25-minute call with Shaun" location="hero" primary />
              <FreeWorkspaceButton variant="glass" size="large" className={`${s.button} ${s.heroPricing}`} icon={<Icon name="arrow" />}>Create Free Workspace</FreeWorkspaceButton>
            </div>
            <div className={s.heroFounderStrip}>
              <img src="/shaun-smiling.jpg" alt="" aria-hidden="true" />
              <p><strong>Shaun · Founder</strong><span>20+ years roofing & construction</span><em>Bring a job or tell me how you quote. I’ll show you a faster way.</em></p>
            </div>
            <div className={s.heroTip}><Icon name="spark" size={16} /><span>Plus, I’ll give you my #1 tip for turning more of your quotes into jobs.</span></div>
          </div>
          <HeroSpeedProof />
        </div>
        <div className={s.heroBottomLine} aria-hidden="true" />
      </section>

      <FounderCallSection bookingHref={config.bookingHref} />

      <DoneForYouSection config={doneForYouConfig} preview={preview} />

      <WorkflowExplorer demoHref="/signup" config={config} />

      <TestimonialsSection />

      <PricingSection />

      <FinalCtaSection config={config} />

      <FaqSection config={config} />
    </main>
    <div className={s.footerWrap}><SiteFooter /></div>
  </div>;
}
