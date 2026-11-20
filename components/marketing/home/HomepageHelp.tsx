import Link from 'next/link';
import YouTubeLite from '@/components/YouTubeLite';
import { Icon, type IconName } from './Icon';
import s from './HomepageHelp.module.css';

const options: { name: string; tag: string; short: string; detail: string; href: string; action: string; icon: IconName; external?: boolean }[] = [
  { name: 'Send us a job', tag: 'Free', short: 'See how we would quote your real job.', detail: 'Share a job you have already quoted. We will email a personal video showing the QuoteCore+ workflow using your own example.', href: '/your-job-demo', action: 'Send your job', icon: 'document' },
  { name: 'Talk to Shaun', tag: 'Free · 25 min', short: 'Get a personal screen-share walkthrough.', detail: 'Show Shaun how you measure and price today. See the workflow that suits your roofing business and ask your questions directly.', href: 'https://calendly.com/quote-core-info/meeting', action: 'Book a call', icon: 'people', external: true },
  { name: 'Quick Start', tag: 'From US$49', short: 'Have your components and pricing set up.', detail: 'Send us your current materials and rates. We will help configure your first Smart Components so you can get quoting sooner.', href: '/quick-start-pricing', action: 'Explore Quick Start', icon: 'calculator' },
  { name: 'Done For You', tag: 'Full setup', short: 'Your workflow configured and guided on real jobs.', detail: 'A more complete setup, personal walkthrough, included app access and support to help your team become productive.', href: '/done-for-you-setup', action: 'See Done For You', icon: 'roof' },
];

/** Keeps four assistance choices visible; explanations expand only on demand. */
export function HomepageHelp({ bookingHref }: { bookingHref: string }) {
  return <section id="getting-help" className={s.section} aria-labelledby="homepage-help-heading">
    <div className={s.wrap}>
      <div className={s.heading}>
        <div><p className={s.eyebrow}>YOU DON'T HAVE TO FIGURE IT OUT ALONE</p><h2 id="homepage-help-heading">Want a hand getting started?</h2></div>
        <p>Choose the help that fits: a free personal demonstration, or help setting up your pricing and workflow.</p>
      </div>
      <div className={s.grid}>
        {options.map(option => {
          const href = option.name === 'Talk to Shaun' ? bookingHref : option.href;
          const external = /^https:\/\//.test(href);
          return <details className={s.card} key={option.name}>
          <summary>
            <span className={s.icon}><Icon name={option.icon} size={23} /></span>
            <span className={s.tag}>{option.tag}</span>
            <strong>{option.name}</strong>
            <span className={s.short}>{option.short}</span>
            <span className={s.toggle}>Explore this option <Icon name="chevron" size={17}/></span>
          </summary>
          <div className={s.extra}>
            <p>{option.detail}</p>
            <Link href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} className={s.action}>{option.action} <Icon name="arrow" size={17}/></Link>
          </div>
        </details>; })}
      </div>
      <details className={s.founderStory}>
        <summary>
          <img src="/shaun-smiling.jpg" width="44" height="44" alt="Shaun, founder of QuoteCore+" loading="lazy" />
          <span className={s.founderIntro}><strong>Why I built QuoteCore+</strong><span>Shaun, founder. 20+ years roofing and construction.</span></span>
          <span className={s.founderToggle}>Watch my story <Icon name="chevron" size={18} /></span>
        </summary>
        <div className={s.founderPanel}>
          <div className={s.founderVideo}>
            <YouTubeLite videoId="4E3khV0qRyI" title="How to Quote Roofing Jobs Faster - Why I Built QuoteCore+" thumbnail="/marketing/home/founder-video-thumb.webp" uploadDate="2026-11-01" />
          </div>
          <div className={s.founderStoryCopy}>
            <h3>Built by a roofer who wanted a better way.</h3>
            <p>I spent years measuring roofs, transferring numbers between tools and preparing quotes. QuoteCore+ brings that work together so roofing businesses can quote faster with their own pricing.</p>
            <Link href="/about">Read the story <Icon name="arrow" size={17} /></Link>
          </div>
        </div>
      </details>
    </div>
  </section>;
}
