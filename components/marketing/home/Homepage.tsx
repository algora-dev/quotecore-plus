import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import { MarketingButton } from '@/components/marketing/MarketingButton';
import { HeroVisual } from './HeroVisual';
import { DemoCallButton } from './DemoCall';
import { OverviewVideo } from './OverviewVideo';
import { WorkflowExplorer } from './WorkflowExplorer';
import { FitQuizSection } from './FitQuiz';
import { Icon, type IconName } from './Icon';
import { homepageConfig, type HomepageConfig } from './homepage-config';
import { homepageFaqs, testimonials, comparisonRows, placeholderReview, publishedHeroReview } from './homepage-content';
import s from './Homepage.module.css';

/** Server-rendered page composition with isolated interactive client components.
 * Header, footer and domain/auth helpers remain the site's existing components. */
export default function MarketingHomepage({ config = homepageConfig }: { config?: HomepageConfig }) {
  const demo = (label = 'Try the Demo', className = '') => <MarketingButton href={config.demoHref} variant="primary" size="large" className={`${s.button} ${className}`} icon={<Icon name="arrow" />}>{label}</MarketingButton>;
  return <div className={s.root}>
    <a className={s.skipLink} href="#homepage-main">Skip to content</a>
    <BlogHeader />
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
            <h1 id="hero-title">Measure the job.<br />Calculate the price.<br />Send the quote.</h1>
            <p className={s.heroLead}>From a plan to a priced quote.<br className={s.leadBreak} /> Without the back and forth.</p>
            <p className={s.heroBody}>Measure from an uploaded plan or image, or start with measurements you already have. Smart Components™ turn your areas, lengths and quantities into materials, labour, waste and pricing.</p>
            <div className={s.heroActions}>{demo()}<DemoCallButton bookingHref={config.bookingHref} /></div>
            <div className={s.reassurance}><span><Icon name="check" size={16} />No signup for the demo</span><span><Icon name="check" size={16} />Real project data</span></div>
          </div>
          <HeroVisual review={config.showPlaceholderReview ? placeholderReview : publishedHeroReview} />
        </div>
        <div className={s.heroBottomLine} aria-hidden="true" />
      </section>

      <OverviewVideo config={config} />

      <section id="try-it" className={`${s.section} ${s.demoSection}`} aria-labelledby="demo-title">
        <div className={`${s.container} ${s.demoGrid}`}>
          <div><p className={s.eyebrow}>Try it yourself</p><h2 id="demo-title" className={s.sectionTitle}>A real job.<br />A proper test drive.</h2><p className={s.bodyCopy}>Explore a sample roof plan and see how measurements become a customer-ready quote. No signup. No blank screen to figure out.</p><div className={s.inlineActions}>{demo()}<span className={s.demoNote}><Icon name="clock" size={21} /><span>Jump straight in.<br /><strong>It’s your time to explore.</strong></span></span></div></div>
          <div className={s.demoSteps}>
            {([
              ['roof', 'Measure the roof', 'Try the digital takeoff tools on a real sample plan.'],
              ['calculator', 'See the calculations', 'Explore components, quantities and pricing.'],
              ['document', 'Generate the quote', 'See the professional quote your customer receives.'],
            ] as [IconName, string, string][]).map(([icon, title, text], i) => <div className={s.demoStep} key={title}><span className={s.demoStepIcon}><Icon name={icon} size={26} /></span><div><span className={s.tinyLabel}>0{i + 1}</span><h3>{title}</h3><p>{text}</p></div><Icon name="arrow" size={18} /></div>)}
          </div>
        </div>
      </section>

      <section id="how-it-works" className={`${s.section} ${s.dark} ${s.waysSection}`} aria-labelledby="ways-title">
        <div className={s.container}>
          <div className={s.sectionIntro}><div><p className={s.eyebrow}>How it works</p><h2 id="ways-title" className={s.sectionTitle}>Two steps to your first quote.<br /><span className={s.mutedHeading}>One step for every job after.</span></h2></div><p className={s.introAside}>Most of the work happens once.</p></div>
          <div className={s.waysFlow}>
            <div className={s.stepCard}>
              <span className={s.stepBadge}>Step 1 · Once</span>
              <h3>Create your pricing</h3>
              <p>Your materials, labour, waste and margins — saved as Smart Components™. Set it up once, or let us do it with you.</p>
              <a href="/features/smart-components" className={s.textLink}>See Smart Components<Icon name="arrow" size={16} /></a>
            </div>
            <div className={s.stepCard}>
              <span className={s.stepBadge}>Step 2 · Every job</span>
              <h3>Add your measurements — any way you like</h3>
              <div className={s.wayChips}>{([
                ['document', 'Enter the numbers'],
                ['ruler', 'Measure in the app'],
                ['spark', 'Tell the assistant'],
              ] as [IconName, string][]).map(([icon, label]) => <span className={s.wayChip} key={label}><Icon name={icon} size={15} />{label}</span>)}
              </div>
              <p className={s.chipNote}>Any of the three — the price builds itself.</p>
            </div>
          </div>
          <div className={s.waysOutcome}><Icon name="arrow" size={18} /><p>Quote, materials order, invoice — <strong>ready to send in a click or two.</strong></p></div>
        </div>
      </section>

      <FitQuizSection />

      <section id="setup" className={`${s.section} ${s.setupSection}`} aria-labelledby="setup-title">
        <div className={`${s.container} ${s.setupGrid}`}>
          <div className={s.setupPortrait}><img src="/shaun-smiling.jpg" width={795} height={1066} alt="Shaun, the founder of QuoteCore+" loading="lazy" decoding="async" /><div className={s.founderCaption}><strong>Real people. Practical help.</strong><span>Shaun · Founder, QuoteCore+</span></div></div>
          <div className={`${s.dark} ${s.setupCard}`}><p className={s.eyebrow}>Done For You Setup</p><h2 id="setup-title" className={s.sectionTitle}>Another app to set up?<br /><span className={s.mutedHeading}>Not another thing<br />on your list.</span></h2><p className={s.bodyCopy}>Let’s build it around the way you already work. We’ll help load your pricing and services, shape your setup around your business, and teach you using your own jobs.</p>
            <div className={s.setupPoints}><span><Icon name="check" size={18} />Your products and pricing</span><span><Icon name="check" size={18} />Your workflow, configured</span><span><Icon name="check" size={18} />Personal, practical training</span></div>
            <MarketingButton href="/done-for-you-setup" variant="primary" size="large" className={s.button} icon={<Icon name="arrow" />}>Explore Done For You Setup</MarketingButton><p className={s.smallNote}>Start with a conversation. Scope and pricing agreed with you.</p>
          </div>
        </div>
      </section>

      <WorkflowExplorer />

      <section id="smart-components" className={`${s.section} ${s.smartSection}`} aria-labelledby="smart-title">
        <div className={s.container}>
          <div className={s.sectionIntro}><div><p className={s.eyebrow}>The thinking behind your quote</p><h2 className={s.sectionTitle} id="smart-title">Most software remembers<br />what you charged.<br /><span className={s.orangeInk}>We remember how you work.</span></h2></div><div className={s.introAside}><p>Labour rates. Waste factors. Pack sizes. Formulas. Save your know-how as Smart Components™ and put it to work on every quote.</p><a href="/features/smart-components" className={s.textLink}>Discover Smart Components<Icon name="arrow" size={17} /></a></div></div>
          <div className={s.smartVisual}><div className={s.smartVisualHeading}><span><Icon name="spark" size={20} />Your business logic, connected.</span><span>Set it up once. Reuse it.</span></div><img src="/smart-components-mapping.png" width={1916} height={821} alt="Actual Smart Components illustration showing spreadsheet rows mapped into the QuoteCore+ component library" loading="lazy" decoding="async" /></div>
          <div className={s.smartPillars}>{[['Your materials', 'Products, quantities and pack sizes.'], ['Your labour', 'Rates and time that reflect your work.'], ['Your pricing', 'Waste, margins and rules — remembered.']].map(([title, text]) => <div key={title}><Icon name="check" size={19} /><span><strong>{title}</strong><small>{text}</small></span></div>)}</div>
        </div>
      </section>

      <section id="reviews" tabIndex={-1} className={`${s.section} ${s.dark} ${s.reviewsSection}`} aria-labelledby="reviews-title">
        <div className={s.container}><div className={s.sectionIntro}><div><p className={s.eyebrow}>From people doing the work</p><h2 id="reviews-title" className={s.sectionTitle}>Different businesses.<br />A familiar story.</h2></div><p className={s.introAside}>Less switching between tools.<br />More working the way that makes sense.</p></div>
          <div className={s.reviewsGrid}>{testimonials.map(review => <figure key={review.name} className={s.testimonial}><Icon name="quote" className={s.quoteMark} size={29} /><blockquote>“{review.quote}”</blockquote><figcaption><span className={s.avatar} aria-hidden="true">{review.initials}</span><span><strong>{review.name}</strong><small>{review.business}</small></span></figcaption></figure>)}</div>
        </div>
      </section>

      {/* "The difference" comparison table — hidden for now (owner request 2026-10-05). Re-enable by removing this wrapper. */}
      {false && (
      <section className={`${s.section} ${s.dark} ${s.differenceSection}`} aria-labelledby="difference-title">
        <div className={s.container}><div className={s.sectionIntro}><div><p className={s.eyebrow}>The difference</p><h2 id="difference-title" className={s.sectionTitle}>Keep the job moving.<br />Not the same data.</h2></div><p className={s.introAside}>Replace the hand-offs between spreadsheets, documents and email with one connected workflow.</p></div>
          <div className={s.comparisonWrap} tabIndex={0} role="region" aria-label="Workflow comparison, scroll horizontally on smaller screens"><table className={s.comparison}><caption className={s.srOnly}>Spreadsheets and email compared with QuoteCore+</caption><thead><tr><th scope="col">The task</th><th scope="col">Spreadsheets + email</th><th scope="col"><span className={s.comparisonBrand}>QuoteCore<span>+</span></span></th></tr></thead><tbody>{comparisonRows.map(([task, old, connected]) => <tr key={task}><th scope="row">{task}</th><td>{old}</td><td><span><Icon name="check" size={17} />{connected}</span></td></tr>)}</tbody></table></div>
        </div>
      </section>
      )}

      <section id="free-tools" className={`${s.section} ${s.toolsSection}`} aria-labelledby="tools-title"><div className={s.container}>
        <div className={s.sectionIntro}><div><p className={s.eyebrow}>Start with something useful</p><h2 id="tools-title" className={s.sectionTitle}>Your plan. Our free tools.</h2></div><a href="/free-tools" className={s.textLink}>Explore all free tools<Icon name="arrow" size={18} /></a></div>
        <div className={s.toolsGrid}>{([
          ['ruler', 'Free roofing digital takeoff', 'Upload a plan and try the measuring tools.', '/free-roof-takeoff'],
          ['calculator', 'Roofing calculators', 'Useful calculations, no spreadsheet needed.', '/free-calculators'],
          ['document', 'Find your next tool', 'Something useful for the job in front of you.', '/free-tools'],
        ] as [IconName, string, string, string][]).map(([icon, title, text, href]) => <a href={href} className={s.toolCard} key={title}><Icon name={icon} size={28} /><h3>{title}</h3><p>{text}</p><span>Open tool<Icon name="arrow" size={18} /></span></a>)}</div>
      </div></section>

      <section id="questions" className={`${s.section} ${s.dark} ${s.faqSection}`} aria-labelledby="faq-title"><div className={s.container}>
        <div className={s.faqGrid}><div><p className={s.eyebrow}>A few things worth knowing</p><h2 id="faq-title" className={s.sectionTitle}>Good questions.<br />Straight answers.</h2><p className={s.bodyCopy}>Have a question about your business?<br />Let’s talk through it.</p><DemoCallButton bookingHref={config.bookingHref} label="Book a Free Demo Call" location="faq" /></div>
          <div className={s.faqList}>{homepageFaqs.map((faq, i) => <details className={s.faqItem} key={faq.question}><summary><span><small>0{i + 1}</small>{faq.question}</span><Icon name="chevron" size={19} /></summary><p>{faq.answer}</p></details>)}</div>
        </div>
        <div className={s.closing}><p className={s.eyebrow}>Less back and forth. More getting it done.</p><h2>Make your next quote<br /><span className={s.mutedHeading}>a better experience.</span></h2><div className={s.closingActions}>{demo()}<MarketingButton href="/pricing" variant="glass" size="large" className={`${s.button} ${s.glass}`}>Explore pricing<Icon name="arrow" size={18} /></MarketingButton></div><p className={s.smallNote}>No signup for the demo. A real job, ready to explore.</p></div>
      </div></section>
    </main>
    <div className={s.footerWrap}><SiteFooter /></div>
  </div>;
}
