import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import { FreeWorkspaceButton } from '@/components/marketing/FreeWorkspaceButton';
import Link from 'next/link';
import { HomepageJourney } from './HomepageJourney';
import { HomepageHelp } from './HomepageHelp';
import { LimitedTimeJobStrip } from './LimitedTimeJobStrip';
import { homepageConfig, type HomepageConfig } from './homepage-config';
import styles from './HomeLocked.module.css';

function c(...names: string[]) { return names.map((name) => styles[name]).filter(Boolean).join(' '); }

export default function MarketingHomepage({ config = homepageConfig }: { config?: HomepageConfig; preview?: boolean }) {
  const bookingHref = config.bookingHref || '/contact';
  const bookingIsExternal = bookingHref.startsWith('https://');
  return <div className={styles.root}>
    <a className={c('skip-link')} href="#homepage-main">Skip to content</a>
    <BlogHeader homepage />
    <main id="homepage-main" tabIndex={-1}>
      <section className={styles.hero}>
        <picture className={c('hero-picture')}><source media="(max-width:640px)" srcSet="/marketing/home/roof-sunset-mobile.webp" /><img className={c('hero-bg')} src="/marketing/home/roof-sunset.webp" alt="" fetchPriority="high" /></picture>
        <div className={c('hero-wash')} aria-hidden="true" />
        <div className={c('wrap','hero-grid')}>
          <div className={c('hero-copy')}>
            <p className={styles.eyebrow}>Roofing estimating &amp; quoting</p>
            <h1>Quote roofing jobs <span className={styles.gradient}>faster.</span><br />No matter how you <span className={styles.gradient}>currently work.</span></h1>
            <p className={c('hero-kicker')}>Start with a plan, a satellite image, your own measurements, or simply tell QuoteCore+ what you have.</p>
            <div className={c('hero-action')}>
              <FreeWorkspaceButton className={c('btn','btn-primary')}>See how it works →</FreeWorkspaceButton>
              <Link href={bookingHref} target={bookingIsExternal ? '_blank' : undefined} rel={bookingIsExternal ? 'noopener noreferrer' : undefined} className={c('hero-call-link')}>Or book a free 25-minute call with Shaun ↗</Link>
            </div>
            <div className={c('hero-founder')}><img className={c('hero-founder-avatar')} src="/shaun-smiling.jpg" alt="Shaun, founder of QuoteCore+" /><div className={c('hero-founder-copy')}><div className={c('hero-founder-topline')}><strong>Shaun · Founder</strong><span>20+ years roofing &amp; construction</span></div><div className={c('hero-founder-line')}>Bring a job or tell me how you quote. I&apos;ll show you a faster way.</div></div></div>
          </div>
          <div className={c('proof-stack')} aria-label="Two ways to quote faster">
            <article className={c('proof-card','proof-card-simple')}><div className={c('proof-simple-inner')}><div className={c('speed-question')}>How fast is it?</div><p className={c('time','proof-time')}><strong>2 minutes 27 seconds</strong></p><h3 className={c('proof-condition')}>When you need to measure the job</h3><p className={c('proof-path')}>Blank roof plan or satellite image → customer quote</p><a className={c('proof-simple-cta')} href="/fastest-roofing-estimating-software">Watch the full flow →</a></div></article>
            <article className={c('proof-card','proof-card-simple')}><div className={c('proof-simple-inner')}><div className={c('speed-question')}>How fast is it?</div><p className={c('time','proof-time')}><strong>Less than 60 seconds</strong></p><h3 className={c('proof-condition')}>When you already have the measurements</h3><p className={c('proof-path')}>Your measurements → customer quote</p><a className={c('proof-simple-cta')} href="/fastest-roofing-estimating-software#assistant">Watch the full flow →</a></div></article>
          </div>
        </div>
      </section>

      <HomepageJourney />

      <LimitedTimeJobStrip />

      <section className={styles.workspace} id="workspace"><div className={c('wrap','workspace-grid')}>
        <div><p className={styles.eyebrow}>TRY THE REAL APP FOR FREE</p><h2>Your workspace. Your pricing. No pressure.</h2><p>Create a Free Workspace with no card and no expiry. Start with the optional guided demo, then add your own pricing and try a real roofing job. Paid plans are there when you need more usage or storage.</p><div className={c('workspace-mini')}><span>No credit card</span><span>No expiry</span><span>Guided demo included</span></div><FreeWorkspaceButton className={c('btn','btn-primary')}>See how it works →</FreeWorkspaceButton><p style={{ marginTop: 12, fontSize: 12 }}><Link href="/pricing" style={{ color: '#ffb36b', textDecoration: 'underline', textUnderlineOffset: 3 }}>How does paid pricing work?</Link></p></div>
        <div className={c('app-shot')}><span className={c('shot-badge')}>Real QuoteCore+ workspace</span><img src="/marketing/home/demo/demo-01-workspace.webp" alt="QuoteCore+ sample workspace with saved jobs and quoting tools" loading="lazy" /></div>
      </div></section>


      <section className={styles.reviews} id="reviews"><div className={styles.wrap}><header className={c('reviews-head')}><p className={styles.eyebrow}>Customer experiences</p><h2>From people doing the work.</h2></header><div className={c('review-grid')}>
        <figure className={styles.review}><div className={c('review-top')}><p>Built around the way they already work</p><span className={c('quote-mark')}>“</span></div><blockquote>“The app is so simple and allows us to price everything the way we already have for years.”</blockquote><figcaption className={c('review-footer')}><span className={styles.avatar}>RM</span><span><strong>Rob Mander</strong><small>FMR Solutions</small></span></figcaption></figure>
        <figure className={styles.review}><div className={c('review-top')}><p>A much faster workflow</p><span className={c('quote-mark')}>“</span></div><blockquote>“We haven&apos;t had to print out a roof plan... at least 4x faster than our old process.”</blockquote><figcaption className={c('review-footer')}><span className={styles.avatar}>GK</span><span><strong>Greg Kepp</strong><small>Sky High Roofing</small></span></figcaption></figure>
        <figure className={styles.review}><div className={c('review-top')}><p>Set up and quoting faster</p><span className={c('quote-mark')}>“</span></div><blockquote>“...we save so much time with our pricing, this app is a game changer for roofers!”</blockquote><figcaption className={c('review-footer')}><span className={styles.avatar}>RJ</span><span><strong>Right Roofing</strong><small>Done For You customer</small></span></figcaption></figure>
      </div>
      </div></section>



      <HomepageHelp bookingHref={bookingHref} />
    </main>
    <SiteFooter />
  </div>;
}
