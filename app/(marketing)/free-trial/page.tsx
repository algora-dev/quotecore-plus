import type { Metadata } from 'next';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import { FreeWorkspaceButton } from '@/components/marketing/FreeWorkspaceButton';
import { homepageConfig } from '@/components/marketing/home/homepage-config';
import { buildBreadcrumbSchema, buildSoftwareApplicationSchema, siteUrl } from '@/lib/schema';
import { hreflangLanguages } from '@/lib/seo/hreflang';
import ZoomableImage from './ZoomableImage';
import styles from './FreeWorkspaceLocked.module.css';

export const metadata: Metadata = {
  title: 'See How QuoteCore+ Works | Free Workspace & Guided Demo',
  description:
    'Discover how QuoteCore+ turns site measurements, roof sketches, plans and satellite images into priced roofing quotes. Explore the guided demo and create a free workspace.',
  alternates: {
    canonical: 'https://quote-core.com/free-trial',
    languages: hreflangLanguages('/free-trial'),
  },
};

const imageBase = '/marketing/free-trial';
const images = {
  written: { src: `${imageBase}/demo-measurements-written.webp`, width: 1055, height: 1491 },
  sketch: { src: `${imageBase}/demo-roof-sketch.webp`, width: 1491, height: 1055 },
  plan: { src: `${imageBase}/demo-roof-plan.webp`, width: 998, height: 786 },
  satellite: { src: `${imageBase}/demo-roof-satellite.webp`, width: 1413, height: 1113 },
  quote: { src: `${imageBase}/demo-finished-quote.webp`, width: 964, height: 1336 },
} as const;

const workflowMethods = [
  {
    number: 1,
    title: 'Measured on site',
    description: 'You already have the quantities and measurements written down.',
    image: images.written,
    alt: 'Handwritten roofing measurements and quantities on lined paper.',
    dialogTitle: 'Written measurements and quantities from the demo job',
  },
  {
    number: 2,
    title: 'Sketched by hand',
    description: 'You draw the roof shape and label the hips, ridges, valleys, and dimensions yourself.',
    image: images.sketch,
    alt: 'Hand-drawn roof plan with measurements written onto the sketch.',
    dialogTitle: 'Roof sketch with measurements from the demo job',
  },
  {
    number: 3,
    title: 'Supplied roof plan',
    description: 'You work from a plan and need to measure the roof from that document.',
    image: images.plan,
    alt: 'Architectural roof plan with labeled roof elements and dimensions.',
    dialogTitle: 'Architectural roof plan from the demo job',
  },
  {
    number: 4,
    title: 'Satellite measurement',
    description: 'You measure from the overhead roof image and build the quote from there.',
    image: images.satellite,
    alt: 'Satellite image of the same roof shown in the demo job.',
    dialogTitle: 'Satellite roof image from the demo job',
  },
] as const;

const steps = [
  {
    title: 'Try the guided demo',
    description: 'Walk through the exact roof job shown above and see the main workflow.',
  },
  {
    title: 'Explore the finished account',
    description: 'Browse ready-made jobs, pricing, and finished quotes to get your bearings.',
  },
  {
    title: 'Try your own workspace',
    description: 'Use your own quantities, roof images, or jobs and start applying the same process.',
  },
  {
    title: 'Add your pricing',
    description: 'Get your pricing into the app to really see how QuoteCore+ can save you time.',
  },
] as const;

function c(...classes: string[]) {
  return classes.map((name) => styles[name]).filter(Boolean).join(' ');
}

export default async function FreeWorkspacePage({
  searchParams,
}: {
  searchParams?: Promise<{ ref?: string }>;
}) {
  // Forward the ?ref tag inbound CTAs brought in, so signup attribution +
  // per-tool welcome survive the /free-trial hop (owner plan 2026-11-19).
  const refTag = (await searchParams)?.ref;
  // This is the verified, repo-configured booking destination, including env overrides.
  const bookingHref = homepageConfig.bookingHref || '/contact';
  const schemas = [
    buildBreadcrumbSchema([
      { name: 'Home', url: `${siteUrl}/` },
      { name: 'See How It Works', url: `${siteUrl}/free-trial` },
    ]),
    { '@context': 'https://schema.org', ...buildSoftwareApplicationSchema() },
  ];

  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
        />
      ))}
      <BlogHeader />
      <main className={styles.root}>
        <section className={c('hero', 'light', 'section')} aria-labelledby="hero-title">
          <div className={c('wrap', 'heroInner')}>
            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                <p className={styles.eyebrow}>See how it works</p>
                <h1 id="hero-title" className={styles.heroTitle}>
                  <span className={styles.plain}>Your </span>
                  <span className={styles.grad}>quickest</span>
                  <span className={styles.plain}> path to a </span>
                  <span className={styles.grad}>better quote.</span>
                </h1>
                <p className={styles.lead}>
                  Built by a roofer and shaped by real roofer feedback, QuoteCore+ is designed around the
                  ways roofers actually measure, price, and quote. No matter how you work today, we make it{' '}
                  <strong className={styles.heroLeadStrong}>easier</strong>,{' '}
                  <strong className={styles.heroLeadStrong}>faster</strong>, and more{' '}
                  <strong className={styles.heroLeadStrong}>accurate</strong> to turn roof measurements into
                  pricing and a finished quote.
                </p>
                <div className={styles.heroTrail} aria-label="What you will see below">
                  <span><b>01</b> Recognize your workflow</span>
                  <span><b>02</b> Get your pricing in</span>
                  <span><b>03</b> See the fastest next steps</span>
                </div>
              </div>
              <div className={styles.heroVisual} aria-label="Hand-drawn roof plan becoming a finished quotation">
                <div className={styles.heroGlow} aria-hidden="true" />
                <ZoomableImage
                  {...images.sketch}
                  alt="Hand-drawn roof plan with measurements used in the demo job."
                  title="Hand-drawn roof plan from the demo job"
                  className={c('heroMock', 'sketch')}
                  badge="Sketch by hand"
                  hint="View larger"
                  sizes="(max-width: 620px) 42vw, (max-width: 1100px) 35vw, 22vw"
                  priority
                />
                <ZoomableImage
                  {...images.quote}
                  alt="Finished quotation generated from the same demo roofing job."
                  title="Finished quotation from the demo job"
                  className={c('heroMock', 'quote')}
                  badge="Finished quote"
                  hint="View larger"
                  sizes="(max-width: 620px) 53vw, (max-width: 1100px) 50vw, 30vw"
                  priority
                />
                <div className={styles.heroConnector} aria-hidden="true">
                  <span className={styles.heroConnectorArrow}>→</span>
                  <span className={styles.heroConnectorText}>
                    <strong>From roof sketch to polished quote</strong>
                    <span>Using your pricing in QuoteCore+</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="examples" className={c('dark', 'section')} aria-labelledby="examples-title">
          <div className={styles.wrap}>
            <p className={styles.eyebrow}>01 / Recognize your workflow</p>
            <div className={styles.examplesIntro}>
              <h2 id="examples-title" className={c('examplesTitle', 'gradientText')}>
                You get your roof quantities and measurements one of these 4 ways.
              </h2>
              <aside className={styles.roofTypes} aria-label="Roofing materials supported">
                <span className={styles.roofTypesKicker}>Built for the roofing you do</span>
                <strong>Shingles · Tile · Slate · Long-run metal · Membrane</strong>
                <p>Whatever your roof covering, the path from measurements to a quote stays familiar.</p>
              </aside>
            </div>
            <p className={styles.examplesLead}>
              Whether you measure on site, sketch it yourself, work from plans, or measure from
              satellite, one of these should look familiar. All 4 examples below come from the
              exact same job used in the guided demo.
            </p>
            <div className={styles.demoGrid}>
              {workflowMethods.map((method) => (
                <article className={styles.demoCard} key={method.number}>
                  <ZoomableImage
                    {...method.image}
                    className={styles.demoShot}
                    title={method.dialogTitle}
                    alt={method.alt}
                    badge={`${method.number} / Demo job`}
                    hint="View larger"
                    sizes="(max-width: 620px) 92vw, (max-width: 1100px) 45vw, 24vw"
                  />
                  <div className={styles.demoText}>
                    <h3>{method.title}</h3>
                    <p>{method.description}</p>
                  </div>
                </article>
              ))}
            </div>
            <div className={styles.demoNote}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v6M12 8h.01" />
              </svg>
              <span>
                <strong>No matter which one looks like your workflow, the next step is the same.</strong>{' '}
                Turn those quantities and measurements into pricing and a quote as quickly and accurately as possible.
              </span>
            </div>
          </div>
        </section>

        <section id="pricing" className={c('white', 'section')} aria-labelledby="pricing-title">
          <div className={styles.wrap}>
            <p className={styles.eyebrow}>02 / The foundation of every quote</p>
            <div className={styles.pricingHead}>
              <h2 id="pricing-title" className={styles.pricingTitle}>
                <span>Get your pricing into <span className={styles.brandNowrap}>QuoteCore+.</span></span>
                <span className={styles.gradientText}>That&apos;s what turns measurements into a finished quote.</span>
              </h2>
            </div>
            <div className={styles.pricingBridge} aria-label="From roof measurements to a finished quote">
              <div className={styles.imagePanel}>
                <span className={styles.flowKicker}>Your measurements</span>
                <ZoomableImage
                  {...images.written}
                  className={styles.imageButton}
                  title="Your measurements from the demo job"
                  alt="Handwritten measurements and quantities for the roof used in the demo."
                  sizes="(max-width: 1100px) 94vw, 32vw"
                />
                <div className={styles.imageCaption}>
                  <p>The same measurements shown above. This is one of the exact inputs used in the demo job.</p>
                  <span className={styles.zoomLink}>Click to enlarge</span>
                </div>
              </div>
              <div className={styles.bridgeCenter}>
                <span className={styles.flowKicker}>QuoteCore+ in between</span>
                <h3>Your pricing in the app unlocks the result.</h3>
                <p>
                  Once your pricing is saved in QuoteCore+, you can enter or scan measurements,
                  apply your pricing rules, and turn raw quantities into a finished quote ready to send.
                </p>
                <div className={styles.bridgeArrow} aria-hidden="true">→</div>
                <div className={styles.miniList}>
                  <div className={styles.miniItem}>Save materials, labor, waste, pitch, and pricing rules once.</div>
                  <div className={styles.miniItem}>Use those saved pricing libraries on any measurements, plans, or roof images.</div>
                </div>
              </div>
              <div className={styles.imagePanel}>
                <span className={styles.flowKicker}>Finished quote</span>
                <ZoomableImage
                  {...images.quote}
                  className={styles.imageButton}
                  title="Finished quotation from the demo job"
                  alt="Finished QuoteCore+ quotation for the same demo roofing job."
                  sizes="(max-width: 1100px) 94vw, 32vw"
                />
                <div className={styles.imageCaption}>
                  <p>The output from that same demo job. The quote is built from the measurements once your pricing has been saved.</p>
                  <span className={styles.zoomLink}>Click to enlarge</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="workflows" className={c('dark', 'section', 'workflows')} aria-labelledby="workflows-title">
          <div className={styles.wrap}>
            <p className={styles.eyebrow}>03 / Work your way</p>
            <div className={styles.sectionHead}>
              <h2 id="workflows-title">
                Manual when you want.{' '}
                <span className={styles.gradientText}>
                  <span className={styles.workflowNoBreak}>AI-assisted</span> when you want it even faster.
                </span>
              </h2>
              <p className={styles.darkBodyCopy}>
                Both ways are designed to save time. Work manually, or let AI speed things up.
                You review the result either way.
              </p>
            </div>
            <div className={styles.workflowGrid}>
              <article className={styles.workCard}>
                <span className={styles.chip}>Manual workflow</span>
                <h3>Use the app directly, with less friction.</h3>
                <p>Enter measurements, apply your pricing, and let QuoteCore+ handle the calculations. No spreadsheets or double entry.</p>
                <div className={styles.workList}>
                  <span>Fast and easy even without AI</span>
                  <span>Full control on your phone or computer</span>
                </div>
              </article>
              <article className={styles.workCard}>
                <span className={styles.chip}>AI-assisted workflow</span>
                <h3>Use AI to speed up the same process.</h3>
                <p>Upload notes, plans, or images. AI helps extract measurements or speed up takeoff. Apply pricing, then check and edit.</p>
                <div className={styles.workList}>
                  <span>Speed up measuring and quoting</span>
                  <span>Review and confirm before sending</span>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="getting-started" className={c('white', 'section')} aria-labelledby="start-title">
          <div className={styles.wrap}>
            <p className={styles.eyebrow}>04 / Your next steps</p>
            <div className={styles.sectionHead}>
              <h2 id="start-title">The quickest way to see if it fits your business.</h2>
              <p>
                Follow the same path we recommend to new users. See how the demo works, explore
                the finished account, then add your pricing so you can judge how much time
                QuoteCore+ could save you on real work.
              </p>
            </div>
            <ol className={styles.steps}>
              {steps.map((step, index) => (
                <li className={styles.step} key={step.title}>
                  <div className={styles.stepTop}>
                    <span className={styles.stepNumber}>{index + 1}</span>
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </li>
              ))}
            </ol>
            {/* The single intentional signup entry on the page. The shared component now
                defaults to /free-trial; `direct` + forwarded ref keep this one on /signup. */}
            <FreeWorkspaceButton className={styles.signupCard} direct refTag={refTag}>
              <span className={styles.signupHeader}>
                <span className={styles.signupKicker}>Create My Free Workspace</span>
                <span className={styles.signupArrow} aria-hidden="true">↗</span>
              </span>
              <span className={styles.signupTitle}>Ready to see what QuoteCore<span className={styles.plusWhite}>+</span> can do for you?</span>
              <span className={styles.signupDescription}>
                Start with the guided demo, then try your own workspace and add your pricing.
              </span>
              <span className={styles.signupMeta}>
                <span>No credit card</span>
                <span>No expiry</span>
                <span>Guided demo included</span>
              </span>
            </FreeWorkspaceButton>
          </div>
        </section>

        <section id="help" className={c('dark', 'section', 'helpSection')} aria-labelledby="help-title">
          <div className={styles.wrap}>
            <p className={styles.eyebrow}>05 / We can help</p>
            <h2 id="help-title">Still unsure? We&apos;ll show you using your own jobs.</h2>
            <p className={styles.introCopy}>
              If you want help connecting QuoteCore+ to the way you already work, choose the option that suits you best.
            </p>
            <div className={styles.helpGrid}>
              {/* /your-job-demo verified live in the deployment branch (2026-11-19). */}
              <div className={styles.helpCell}>
                <a href="/your-job-demo" target="_blank" rel="noopener noreferrer" className={styles.helpCard}>
                <div className={styles.helpHead}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m10 9 5 3-5 3V9Z" />
                  </svg>
                  <span className={styles.helpTag}>FREE</span>
                </div>
                <h3>Send us a job</h3>
                <p>We will record how we would quote one of your jobs in QuoteCore+ so you can watch it in your own time.</p>
                <span className={styles.helpAction}>Request your video <b aria-hidden="true">↗</b></span>
                </a>
                <a href="/contact" target="_blank" rel="noopener noreferrer" className={styles.helpSubLink}>Or just get in touch with us <b aria-hidden="true">↗</b></a>
              </div>
              <a href={bookingHref} target="_blank" rel="noopener noreferrer" className={styles.helpCard}>
                <div className={styles.helpHead}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M7 3v4M17 3v4M3 10h18m-13 4h3m-3 3h6" />
                  </svg>
                  <span className={styles.helpTag}>FREE</span>
                </div>
                <h3>Book a call</h3>
                <p>Walk through your workflow live with Shaun and see how QuoteCore+ would fit the way you already quote today.</p>
                <span className={styles.helpAction}>Book 25 minutes <b aria-hidden="true">↗</b></span>
              </a>
              <a href="/quick-start-pricing" target="_blank" rel="noopener noreferrer" className={styles.helpCard}>
                <div className={styles.helpHead}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <circle cx="12" cy="12" r="5" />
                    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
                  </svg>
                  <span className={styles.helpTag}>SETUP</span>
                </div>
                <h3>Quick Start</h3>
                <p>Send us your pricing and we will help get it set up in the app faster so you can get to the useful part sooner.</p>
                <span className={styles.helpAction}>See Quick Start <b aria-hidden="true">↗</b></span>
              </a>
              <a href="/done-for-you-setup" target="_blank" rel="noopener noreferrer" className={styles.helpCard}>
                <div className={styles.helpHead}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 4l6 6M9 9l6 6M5 21l8-8M3 17l4 4" />
                    <path d="M13 3l8 8M15 5l-4 4M11 9l4 4M7 13l4 4" />
                  </svg>
                  <span className={styles.helpTag}>FULL SERVICE</span>
                </div>
                <h3>Done For You</h3>
                <p>Get setup, training, and support if you want the fastest path to becoming productive with QuoteCore+.</p>
                <span className={styles.helpAction}>See Done For You <b aria-hidden="true">↗</b></span>
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
