import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import { MarketingButton } from '@/components/marketing/MarketingButton';
import { DeviceBadge } from './DeviceBadge';
import { HeroVisual } from './HeroVisual';
import { DemoCallButton } from './DemoCall';
import { DemoSection } from './DemoSection';
import { DoneForYouSection } from './DoneForYouSection';
import { PricingSection } from './PricingSection';
import { TestimonialsSection } from './TestimonialsSection';
import { FaqSection } from './FaqSection';
import { FinalCtaSection } from './FinalCtaSection';
import { doneForYouConfig } from './done-for-you-config';
import { ExploreNextSteps } from './ExploreNextSteps';
import { WorkflowExplorer } from './WorkflowExplorer';
import { Icon, type IconName } from './Icon';
import { homepageConfig, type HomepageConfig } from './homepage-config';
import { comparisonRows, placeholderReview, publishedHeroReview } from './homepage-content';
import s from './Homepage.module.css';

/** Server-rendered page composition with isolated interactive client components.
 * Header, footer and domain/auth helpers remain the site's existing components. */
export default function MarketingHomepage({ config = homepageConfig, preview = false }: { config?: HomepageConfig; preview?: boolean }) {
  const demo = (label = 'Try the Demo', className = '') => <MarketingButton href={config.demoHref} variant="primary" size="large" className={`${s.button} ${className}`} icon={<Icon name="arrow" />}>{label}</MarketingButton>;
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
            <p className={s.eyebrow}>Built for roofing first</p>
            <h1 id="hero-title">Measure the job.<br /><span className={s.heroGradient}>Gain your price.<br />Send the quote.</span></h1>
            <p className={s.heroLead}>Faster estimating and quoting for roofing and construction businesses.</p>
            <p className={s.heroBody}>Built from industry experience and contractor feedback. Powerful tools, made simple.</p>
            <div className={s.heroDevice}><DeviceBadge /></div>
            <div className={s.heroActions} data-analytics-location="homepage_hero" data-analytics-surface="homepage_hero_actions">{demo()}<DemoCallButton bookingHref={config.bookingHref} /><MarketingButton href="/pricing" variant="glass" size="large" className={`${s.button} ${s.heroPricing}`} icon={<Icon name="arrow" />}>Check Pricing</MarketingButton></div>
            <div className={s.reassurance}><span><Icon name="check" size={16} />No signup for the demo</span><span><Icon name="check" size={16} />Real project data</span></div>
          </div>
          <HeroVisual review={config.showPlaceholderReview ? placeholderReview : publishedHeroReview} />
        </div>
        <div className={s.heroBottomLine} aria-hidden="true" />
      </section>

      <WorkflowExplorer demoHref={config.demoHref} config={config} />

      <ExploreNextSteps config={config} />

      <DemoSection config={config} />

{/* "How it works" section - hidden for now (owner request 2026-10-11). Re-enable by removing this wrapper. */}
      {false && (
      <section id="how-it-works" className={`${s.section} ${s.dark} ${s.waysSection}`} aria-labelledby="ways-title">
        <div className={s.container}>
          <div className={s.sectionIntro}><div><p className={s.eyebrow}>How it works</p><h2 id="ways-title" className={s.sectionTitle}>Two steps to your first quote.<br /><span className={s.mutedHeading}>One step for every job after.</span></h2></div><p className={s.introAside}>Most of the work happens once.</p></div>
          <div className={s.waysFlow}>
            <div className={s.stepCard}>
              <span className={s.stepBadge}>Step 1 · Once</span>
              <h3>Create your pricing</h3>
              <p>Your materials, labour, waste and margins, saved as Smart Components™. Set it up once, or let us do it with you.</p>
              <a href="/features/smart-components" className={s.textLink}>See Smart Components™<Icon name="arrow" size={16} /></a>
            </div>
            <div className={s.stepCard}>
              <span className={s.stepBadge}>Step 2 · Every job</span>
              <h3>Add your measurements, any way you like</h3>
              <div className={s.wayChips}>{([
                ['document', 'Enter the numbers'],
                ['ruler', 'Measure in the app'],
                ['spark', 'Tell the assistant'],
              ] as [IconName, string][]).map(([icon, label]) => <span className={s.wayChip} key={label}><Icon name={icon} size={15} />{label}</span>)}
              </div>
              <p className={s.chipNote}>Any of the three, the price builds itself.</p>
            </div>
          </div>
          <div className={s.waysOutcome}><Icon name="arrow" size={18} /><p>Quote, materials order, invoice, <strong>ready to send in a click or two.</strong></p></div>
        </div>
      </section>
      )}

      <DoneForYouSection config={doneForYouConfig} preview={preview} />

      <PricingSection />

      <TestimonialsSection />

      {/* "The difference" comparison table, hidden for now (owner request 2026-10-05). Re-enable by removing this wrapper. */}
      {false && (
      <section className={`${s.section} ${s.dark} ${s.differenceSection}`} aria-labelledby="difference-title">
        <div className={s.container}><div className={s.sectionIntro}><div><p className={s.eyebrow}>The difference</p><h2 id="difference-title" className={s.sectionTitle}>Keep the job moving.<br />Not the same data.</h2></div><p className={s.introAside}>Replace the hand-offs between spreadsheets, documents and email with one connected workflow.</p></div>
          <div className={s.comparisonWrap} tabIndex={0} role="region" aria-label="Workflow comparison, scroll horizontally on smaller screens"><table className={s.comparison}><caption className={s.srOnly}>Spreadsheets and email compared with QuoteCore+</caption><thead><tr><th scope="col">The task</th><th scope="col">Spreadsheets + email</th><th scope="col"><span className={s.comparisonBrand}>QuoteCore<span>+</span></span></th></tr></thead><tbody>{comparisonRows.map(([task, old, connected]) => <tr key={task}><th scope="row">{task}</th><td>{old}</td><td><span><Icon name="check" size={17} />{connected}</span></td></tr>)}</tbody></table></div>
        </div>
      </section>
      )}

{/* "Start with something useful" free tools section - hidden for now (owner request 2026-10-11). Re-enable by removing this wrapper. */}
      {false && (
      <section id="free-tools" className={`${s.section} ${s.toolsSection}`} aria-labelledby="tools-title"><div className={s.container}>
        <div className={s.sectionIntro}><div><p className={s.eyebrow}>Start with something useful</p><h2 id="tools-title" className={s.sectionTitle}>Your plan. Our free tools.</h2></div><a href="/free-tools" className={s.textLink}>Explore all free tools<Icon name="arrow" size={18} /></a></div>
        <div className={s.toolsGrid}>{([
          ['ruler', 'Free roofing digital takeoff', 'Upload a plan and try the measuring tools.', '/free-roof-takeoff'],
          ['calculator', 'Roofing calculators', 'Useful calculations, no spreadsheet needed.', '/free-calculators'],
          ['document', 'Find your next tool', 'Something useful for the job in front of you.', '/free-tools'],
        ] as [IconName, string, string, string][]).map(([icon, title, text, href]) => <a href={href} className={s.toolCard} key={title}><Icon name={icon} size={28} /><h3>{title}</h3><p>{text}</p><span>Open tool<Icon name="arrow" size={18} /></span></a>)}</div>
      </div></section>
      )}

      <FinalCtaSection config={config} />

      <FaqSection config={config} />

    </main>
    <div className={s.footerWrap}><SiteFooter /></div>
  </div>;
}
