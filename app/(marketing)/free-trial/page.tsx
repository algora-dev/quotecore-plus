import type { Metadata } from 'next';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import { FreeWorkspaceButton } from '@/components/marketing/FreeWorkspaceButton';
import { MarketingButton } from '@/components/marketing/MarketingButton';
import { homepageConfig } from '@/components/marketing/home/homepage-config';
import { buildBreadcrumbSchema, buildSoftwareApplicationSchema, siteUrl } from '@/lib/schema';
import { hreflangLanguages } from '@/lib/seo/hreflang';
import styles from './FreeWorkspaceLocked.module.css';

export const metadata: Metadata = {
  title: 'Free QuoteCore+ Workspace | No Card, No Expiry',
  description: 'Create a real QuoteCore+ Free Workspace, use it on your own jobs for as long as you want, and try the optional 10 to 15 minute guided walkthrough when you want help learning the workflow.',
  alternates: { canonical: 'https://quote-core.com/free-trial', languages: hreflangLanguages('/free-trial') },
};

function c(...names: string[]) { return names.map((name) => styles[name]).filter(Boolean).join(' '); }

export default function FreeWorkspacePage() {
  const bookingHref = homepageConfig.bookingHref || '/contact';
  const schemas = [
    buildBreadcrumbSchema([{ name: 'Home', url: `${siteUrl}/` }, { name: 'Free Workspace', url: `${siteUrl}/free-trial` }]),
    { '@context': 'https://schema.org', ...buildSoftwareApplicationSchema() },
  ];
  return <div className={styles.root}>
    {schemas.map((schema, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />)}
    <BlogHeader />
    <main>
      <section className={styles.hero}><div className={styles.wrap}><div className={c('hero-grid')}>
        <div>
          <p className={styles.eyebrow}>Free Workspace</p>
          <h1>Start with a real QuoteCore+ workspace. <span className={styles.gradient}>Free for as long as you want.</span></h1>
          <p className={c('hero-copy')}>Instead of a timed trial, we give you a real workspace you can use on your own jobs. Try every feature, learn what helps your business, and upgrade only if you need more.</p>
          <div className={c('hero-actions')}><FreeWorkspaceButton className={c('btn','btn-primary')}>Create my free workspace →</FreeWorkspaceButton><MarketingButton href={bookingHref} className={c('btn','btn-outline')}>Book 25 minutes with Shaun</MarketingButton></div>
          <div className={c('hero-trust')}><span>No card needed</span><span>No expiry</span><span>Use it on real jobs</span></div>
        </div>
        <aside className={styles.included} aria-label="What is included">
          <div className={c('included-head')}><small>Included from day one</small><strong>Your account, your workspace.</strong></div>
          <div className={c('included-row')}><div className={c('included-icon')}>01</div><div><b>Real Free Workspace</b><p>Use QuoteCore+ on your own jobs and keep the account for as long as you want.</p></div></div>
          <div className={c('included-row')}><div className={c('included-icon')}>02</div><div><b>Every feature available</b><p>Try the tools yourself with free usage included, so you can learn what actually helps.</p></div></div>
          <div className={c('included-row')}><div className={c('included-icon')}>03</div><div><b>Optional guided walkthrough</b><p>Learn the core workflow in around 10 to 15 minutes, then switch back to your own workspace.</p></div></div>
        </aside>
      </div></div></section>

      <section className={styles.walkthrough}><div className={styles.wrap}>
        <div className={c('walkthrough-head')}><div><p className={styles.eyebrow}>Recommended, but optional</p><h2>Learn the core workflow in 10 to 15 minutes.</h2></div><div className={c('walkthrough-copy')}><p>The guided walkthrough opens a <strong>preconfigured fictional roofing business</strong> and takes you through four connected tasks. Follow it when you want help, or skip it and explore your own workspace instead.</p></div></div>
        <div className={c('task-grid')}>
          <article className={styles.task}><div className={c('task-num')}>01 · Pricing</div><h3>Add your pricing</h3><p>See how your materials, labour and pricing can live inside QuoteCore+.</p></article>
          <article className={styles.task}><div className={c('task-num')}>02 · Measure</div><h3>Measure with that pricing</h3><p>Measure the sample job and see the pricing flow through as you work.</p></article>
          <article className={styles.task}><div className={c('task-num')}>03 · Quote</div><h3>Edit and send the quote</h3><p>Finish the customer quote, make the final edits and see how sending works.</p></article>
          <article className={styles.task}><div className={c('task-num')}>04 · Assistant</div><h3>Try Smart Assistant</h3><p>Use the Assistant to complete similar supported tasks in a faster way.</p></article>
        </div>
        <div className={c('walkthrough-note')}><span><strong>The walkthrough never locks you in.</strong> Switch back to your own workspace whenever you want.</span><span className={styles.mini}>Guided when useful · Yours when ready</span></div>
      </div></section>

      <section className={c('free-enough')} id="book-shaun"><div className={styles.wrap}><div className={c('free-grid')}>
        <div><p className={styles.eyebrow}>Keep it simple</p><h2>Free might be all you need.</h2><p>If the Free Workspace gives your business enough, keep using it. Upgrade only when you need more features, capacity or usage.</p><div className={c('free-actions')}><FreeWorkspaceButton className={c('btn','btn-primary')}>Create my free workspace →</FreeWorkspaceButton><MarketingButton href={bookingHref} className={c('btn','btn-secondary')}>Book 25 minutes with Shaun</MarketingButton></div></div>
        <aside className={c('free-box')}><strong>Try it first. Decide later.</strong><p>Use the app long enough to understand how it fits your business before you ever need to think about a paid plan.</p><div className={styles.line}>No card to create your workspace</div><div className={styles.line}>Guided walkthrough included</div><div className={styles.line}>Upgrade only if it earns its place</div></aside>
      </div></div></section>
    </main>
    <SiteFooter />
  </div>;
}
