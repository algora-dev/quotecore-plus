import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import { FreeWorkspaceButton } from '@/components/marketing/FreeWorkspaceButton';
import { MarketingButton } from '@/components/marketing/MarketingButton';
import Link from 'next/link';
import { WorkflowExplorer } from './WorkflowExplorer';
import { homepageConfig, type HomepageConfig } from './homepage-config';
import styles from './HomeLocked.module.css';

function c(...names: string[]) { return names.map((name) => styles[name]).filter(Boolean).join(' '); }

export default function MarketingHomepage({ config = homepageConfig }: { config?: HomepageConfig; preview?: boolean }) {
  const bookingHref = config.bookingHref || '/contact';
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
            <div className={c('hero-action')}><MarketingButton href={bookingHref} className={c('btn','btn-primary')}>Book a free 25-minute call with Shaun →</MarketingButton></div>
            <div className={c('hero-founder')}><img className={c('hero-founder-avatar')} src="/shaun-smiling.jpg" alt="Shaun, founder of QuoteCore+" /><div className={c('hero-founder-copy')}><div className={c('hero-founder-topline')}><strong>Shaun · Founder</strong><span>20+ years roofing &amp; construction</span></div><div className={c('hero-founder-line')}>Bring a job or tell me how you quote. I&apos;ll show you a faster way.</div></div></div>
            <span className={c('call-bonus')}>Plus: Shaun&apos;s #1 tip for winning more of the quotes you already sent.</span>
          </div>
          <div className={c('proof-stack')} aria-label="Two ways to quote faster">
            <article className={c('proof-card','proof-card-simple')}><div className={c('proof-simple-inner')}><div className={c('speed-question')}>How fast is it?</div><p className={c('time','proof-time')}><strong>2 minutes 27 seconds</strong></p><h3 className={c('proof-condition')}>When you need to measure the job</h3><p className={c('proof-path')}>Blank roof plan or satellite image → customer quote</p><a className={c('proof-simple-cta')} href="/fastest-roofing-estimating-software">Watch the full flow →</a></div></article>
            <article className={c('proof-card','proof-card-simple')}><div className={c('proof-simple-inner')}><div className={c('speed-question')}>How fast is it?</div><p className={c('time','proof-time')}><strong>Less than 60 seconds</strong></p><h3 className={c('proof-condition')}>When you already have the measurements</h3><p className={c('proof-path')}>Your measurements → customer quote</p><a className={c('proof-simple-cta')} href="/fastest-roofing-estimating-software">Watch the full flow →</a></div></article>
          </div>
        </div>
      </section>

      <section className={c('price-strip')} id="pricing"><div className={c('wrap','price-layout')}>
        <div><p className={styles.eyebrow}>Pricing that fits your business</p><h2>Only pay for what you need.</h2><p className={c('price-copy')}>Try QuoteCore+ first, learn which tools and usage fit the way you work, then create your exact plan inside your account.</p></div>
        <div className={c('price-summary')}><p className={c('price-range')}><span className={c('price-unit')}><strong>From US$29/mo</strong><span>for lighter setups</span></span><i className={c('price-separator')}>to</i><span className={c('price-unit')}><strong>US$259/mo</strong><span>for larger configurations.</span></span></p><div className={c('price-actions')}><MarketingButton href="/pricing" className={c('btn','btn-primary')}>See how pricing works →</MarketingButton><Link href="/done-for-you-setup" className={c('text-link')}><span className={c('dfy-link-label')}>Want us to set it up?</span><span className={c('dfy-link-action')}>Inquire about Done For You →</span></Link></div></div>
      </div></section>

      <section className={c('founder-section')} id="shaun"><div className={c('wrap','founder-grid')}>
        <div className={c('founder-copy')}><p className={styles.eyebrow}>25 minutes with someone who knows roofing</p><h2>Show me how you measure, estimate or quote today. <span className={styles.gradient}>I&apos;ll show you how to do it faster and easier.</span></h2><p className={c('founder-claim')}>I&apos;ve yet to work with a roofing business where I couldn&apos;t help them speed up or simplify their quoting process.</p><div className={c('founder-actions')}><MarketingButton href={bookingHref} className={c('btn','btn-primary')}>Book my free 25-minute call →</MarketingButton><span className={c('bonus-note')}><strong>Even if you never use QuoteCore+,</strong> you leave with something practical to try in your business.</span></div><details className={c('why-call')}><summary>Why book the call?</summary><div className={c('why-copy')}>You&apos;ll get a tailored look at how QuoteCore+ could fit your current workflow, not a generic product tour. Before we finish, Shaun will also share his #1 tip for increasing the chance that a quote turns into a job.</div></details></div>
        <div className={c('founder-side')}><div className={c('video-embed')}><iframe src="https://www.youtube-nocookie.com/embed/4E3khV0qRyI?rel=0" title="Why I built QuoteCore+" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen loading="lazy" /></div><div className={c('call-steps')}><div className={c('call-step')}><b>01 · Tell me</b><span>Bring a job, or just talk me through how you quote now.</span></div><div className={c('call-step')}><b>02 · I&apos;ll show you</b><span>See the QuoteCore+ workflow that best fits the way you work.</span></div><div className={c('call-step')}><b>03 · Take this too</b><span>My #1 tip for turning more of your quotes into jobs.</span></div></div></div>
      </div></section>

      <section className={styles.workspace} id="workspace"><div className={c('wrap','workspace-grid')}>
        <div><p className={styles.eyebrow}>Prefer to try it yourself?</p><h2>Create your free live workspace.</h2><p>Explore your real QuoteCore+ workspace, use the optional guided walkthrough when you want help, or start measuring, quoting and sending your own jobs straight away.</p><div className={c('workspace-mini')}><span>Real Free Workspace</span><span>Optional walkthrough</span><span>Your own jobs</span></div><FreeWorkspaceButton className={c('btn','btn-primary')}>Create my free workspace →</FreeWorkspaceButton></div>
        <div className={c('app-shot')}><span className={c('shot-badge')}>Real working workspace</span><img src="/marketing/home/demo/demo-01-workspace.webp" alt="QuoteCore+ working workspace" /></div>
      </div></section>

      <section className={styles.reviews} id="reviews"><div className={styles.wrap}><header className={c('reviews-head')}><p className={styles.eyebrow}>Customer experiences</p><h2>From people doing the work.</h2></header><div className={c('review-grid')}>
        <figure className={styles.review}><div className={c('review-top')}><p>Built around the way they already work</p><span className={c('quote-mark')}>“</span></div><blockquote>“The app is so simple and allows us to price everything the way we already have for years.”</blockquote><figcaption className={c('review-footer')}><span className={styles.avatar}>RM</span><span><strong>Rob Mander</strong><small>FMR Solutions</small></span></figcaption></figure>
        <figure className={styles.review}><div className={c('review-top')}><p>A much faster workflow</p><span className={c('quote-mark')}>“</span></div><blockquote>“We haven&apos;t had to print out a roof plan... at least 4x faster than our old process.”</blockquote><figcaption className={c('review-footer')}><span className={styles.avatar}>GK</span><span><strong>Greg Kepp</strong><small>Sky High Roofing</small></span></figcaption></figure>
        <figure className={styles.review}><div className={c('review-top')}><p>Everything connected</p><span className={c('quote-mark')}>“</span></div><blockquote>“…everything that used to need three different apps. Having everything in one place is so handy.”</blockquote><figcaption className={c('review-footer')}><span className={styles.avatar}>TE</span><span><strong>Tony Edwards</strong><small>NZAV</small></span></figcaption></figure>
      </div></div></section>

      <section className={styles.dfy} id="done-for-you"><div className={styles.blueprint} aria-hidden="true" /><div className={styles.wrap}><div className={c('dfy-panel')}>
        <div><p className={styles.eyebrow}>Done For You Setup</p><h2><span>Your workflow.</span><span className={styles.orange}>Your pricing.</span><span className={styles.grey}>We set it up for <span className={styles.orange} style={{display:'inline'}}>you.</span></span></h2><p>Show us how you price and quote today. We&apos;ll configure QuoteCore+ around that workflow, guide you through using it on your own jobs, and stay available while you get going.</p><div className={c('dfy-benefits')}><span>Configured for you</span><span>Guided on your jobs</span><span>3 months of support</span><span>3 months of QuoteCore+ included</span></div><div className={c('dfy-actions')}><MarketingButton href="/done-for-you-setup" size="large" className={c('btn','btn-primary')}>Learn more →</MarketingButton></div></div>
        <div className={c('dfy-media')} aria-label="Shaun, founder of QuoteCore+"><img src="/shaun-smiling.jpg" alt="Shaun, founder of QuoteCore+" /><span className={c('video-caption')}><b>Shaun, founder of QuoteCore+</b><span>20+ years in roofing &amp; construction.</span></span></div>
      </div></div></section>

      <WorkflowExplorer demoHref="/signup" config={config} />

      <section className={styles.final}><div className={styles.wrap}><h2>Tell me how you measure, estimate or quote today.<br /><span className={styles.gradient}>I&apos;ll show you how to do it faster and easier.</span></h2><p>Bring a job if you have one. If you don&apos;t, just talk me through your process. We&apos;ll use the 25 minutes to find the quickest QuoteCore+ workflow for your business.</p><MarketingButton href={bookingHref} className={c('btn','btn-primary')}>Book my free 25-minute call →</MarketingButton><br /><span className={c('final-bonus')}>And I&apos;ll give you my #1 tip for winning more of the quotes you already sent.</span></div></section>
    </main>
    <SiteFooter />
  </div>;
}
