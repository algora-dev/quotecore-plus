import type { ReactNode } from 'react';
import { MarketingButton } from '@/components/marketing/MarketingButton';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import Breadcrumbs from '@/components/Breadcrumbs';
import s from './PageV2.module.css';

export type FaqItem = { question: string; answer: string };
export type RelatedItem = { href: string; title: string; body: string };

type Action = { href: string; label: string; variant?: 'primary' | 'glass' | 'ghost' };

export function PageRoot({ children }: { children: ReactNode }) {
  return <div className={s.root}>{children}</div>;
}

export function PageScaffold({ children, breadcrumbs, schemas = [] }: {
  children: ReactNode;
  breadcrumbs: Array<{ label: string; href?: string }>;
  schemas?: unknown[];
}) {
  return (
    <PageRoot>
      {schemas.map((schema, index) => <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />)}
      <a className={s.skipLink} href="#page-main">Skip to content</a>
      <BlogHeader />
      <Breadcrumbs items={breadcrumbs} />
      <main id="page-main" tabIndex={-1}>{children}</main>
      <SiteFooter />
    </PageRoot>
  );
}

export function Hero({ eyebrow, title, lead, body, primary, secondary, visual, proof = [] }: {
  eyebrow: string;
  title: ReactNode;
  lead: string;
  body?: string;
  primary: Action;
  secondary?: Action;
  visual?: ReactNode;
  proof?: string[];
}) {
  return (
    <section className={s.hero} aria-labelledby="page-title">
      <div className={s.heroGlow} aria-hidden="true" />
      <div className={`${s.container} ${s.heroGrid}`}>
        <div className={s.heroCopy}>
          <p className={s.eyebrow}>{eyebrow}</p>
          <h1 id="page-title" className={s.heroTitle}>{title}</h1>
          <p className={s.heroLead}>{lead}</p>
          {body ? <p className={s.heroBody}>{body}</p> : null}
          <div className={s.actions}>
            <MarketingButton href={primary.href} variant={primary.variant ?? 'primary'} size="large" className={s.v2Button}>{primary.label}</MarketingButton>
            {secondary ? <MarketingButton href={secondary.href} variant={secondary.variant ?? 'glass'} size="large" className={s.v2Button}>{secondary.label}</MarketingButton> : null}
          </div>
          {proof.length ? <div className={s.heroProof}>{proof.map((item) => <span key={item}><CheckIcon />{item}</span>)}</div> : null}
        </div>
        {visual ? <div className={s.heroVisual}>{visual}</div> : null}
      </div>
    </section>
  );
}

export function Section({ children, tone = 'white', id, className = '' }: {
  children: ReactNode;
  tone?: 'white' | 'soft' | 'dark';
  id?: string;
  className?: string;
}) {
  return <section id={id} className={`${s.section} ${s[tone]} ${className}`}>{children}</section>;
}

export function Container({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return <div className={narrow ? s.narrow : s.container}>{children}</div>;
}

export function SectionHeader({ eyebrow, title, lead, align = 'left', dark = false }: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: 'left' | 'center';
  dark?: boolean;
}) {
  return (
    <div className={`${s.sectionHeader} ${align === 'center' ? s.center : ''} ${dark ? s.darkHeader : ''}`}>
      {eyebrow ? <p className={s.eyebrow}>{eyebrow}</p> : null}
      <h2 className={s.sectionTitle}>{title}</h2>
      {lead ? <div className={s.sectionLead}>{lead}</div> : null}
    </div>
  );
}

export function ProductFrame({ src, alt, width, height, caption, portrait = false, eager = false }: {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
  portrait?: boolean;
  eager?: boolean;
}) {
  return (
    <figure className={`${s.productFrame} ${portrait ? s.portraitFrame : ''}`}>
      <div className={s.productChrome} aria-hidden="true"><span /><span /><span /><b>QuoteCore+</b></div>
      <div className={s.productViewport}>
        <img src={src} alt={alt} width={width} height={height} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'} decoding="async" />
      </div>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

export function WorkflowRail({ steps }: { steps: Array<{ label: string; body?: string }> }) {
  return (
    <ol className={s.workflowRail} data-count={steps.length}>
      {steps.map((step, index) => (
        <li key={step.label}>
          <span className={s.stepNo}>{String(index + 1).padStart(2, '0')}</span>
          <div><h3>{step.label}</h3>{step.body ? <p>{step.body}</p> : null}</div>
        </li>
      ))}
    </ol>
  );
}

export function FeatureGrid({ items, columns = 3 }: {
  items: Array<{ title: string; body: ReactNode; kicker?: string }>;
  columns?: 2 | 3 | 4;
}) {
  return (
    <div className={`${s.featureGrid} ${s[`cols${columns}`]}`}>
      {items.map((item) => (
        <article className={s.featureCard} key={item.title}>
          {item.kicker ? <span className={s.cardKicker}>{item.kicker}</span> : null}
          <h3>{item.title}</h3>
          <div className={s.cardBody}>{item.body}</div>
        </article>
      ))}
    </div>
  );
}

export function SplitFeature({ children, visual, reverse = false, dark = false }: {
  children: ReactNode;
  visual: ReactNode;
  reverse?: boolean;
  dark?: boolean;
}) {
  return <div className={`${s.split} ${reverse ? s.reverse : ''} ${dark ? s.splitDark : ''}`}><div className={s.splitCopy}>{children}</div><div className={s.splitVisual}>{visual}</div></div>;
}

export function BulletList({ items }: { items: ReactNode[] }) {
  return <ul className={s.bulletList}>{items.map((item, i) => <li key={i}><CheckIcon /> <span>{item}</span></li>)}</ul>;
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return <a className={s.textLink} href={href}>{children}<ArrowIcon /></a>;
}

export function ConversionPaths({ items }: {
  items: Array<{ title: string; body: string; href: string; label: string; kicker?: string }>;
}) {
  return (
    <div className={s.conversionGrid}>
      {items.map((item) => (
        <article className={s.conversionCard} key={`${item.title}:${item.href}`}>
          {item.kicker ? <span className={s.cardKicker}>{item.kicker}</span> : null}
          <h3>{item.title}</h3>
          <p>{item.body}</p>
          <TextLink href={item.href}>{item.label}</TextLink>
        </article>
      ))}
    </div>
  );
}

export function FitPanel({ bestFor, limits, title = 'A focused tool, by design.' }: {
  bestFor: string[];
  limits: string[];
  title?: string;
}) {
  return (
    <div className={s.fitPanel}>
      <div className={s.fitIntro}><p className={s.eyebrow}>Good fit, clear limits</p><h2>{title}</h2><p>QuoteCore+ is built around a connected measure-to-price workflow. It is deliberately not trying to replace every piece of software in a construction business.</p></div>
      <div className={s.fitColumns}>
        <div><h3>Best fit when</h3><ul>{bestFor.map((x) => <li key={x}><CheckIcon />{x}</li>)}</ul></div>
        <div><h3>Know before you choose it</h3><ul>{limits.map((x) => <li key={x}><MinusIcon />{x}</li>)}</ul></div>
      </div>
    </div>
  );
}

export function FaqAccordion({ faqs, title = 'Frequently asked questions', eyebrow = 'FAQ' }: { faqs: FaqItem[]; title?: string; eyebrow?: string }) {
  return (
    <div className={s.faqGrid}>
      <div className={s.faqIntro}><p className={s.eyebrow}>{eyebrow}</p><h2>{title}</h2><p>Practical answers about how QuoteCore+ fits into real estimating, takeoff and quoting workflows.</p></div>
      <div className={s.faqList}>{faqs.map((faq) => <details key={faq.question}><summary><span className={s.faqQuestion}>{faq.question}</span><span className={s.faqIcon} aria-hidden="true">+</span></summary><p>{faq.answer}</p></details>)}</div>
    </div>
  );
}

export function RelatedLinks({ items, title = 'Keep exploring' }: { items: RelatedItem[]; title?: string }) {
  return (
    <div className={s.related}>
      <SectionHeader eyebrow="Related" title={title} lead="Go deeper on the part of the workflow that matters most to you." />
      <div className={s.relatedGrid}>{items.map((item) => <a href={item.href} key={item.href}><span>{item.title}</span><p>{item.body}</p><b>Explore <ArrowIcon /></b></a>)}</div>
    </div>
  );
}

export function FinalCta({ eyebrow = 'QuoteCore+', title, body, primary, secondary }: {
  eyebrow?: string;
  title: ReactNode;
  body: string;
  primary: Action;
  secondary?: Action;
}) {
  return (
    <div className={s.finalCta}>
      <p className={s.eyebrow}>{eyebrow}</p>
      <h2>{title}</h2>
      <p>{body}</p>
      <div className={s.actions}>
        <MarketingButton href={primary.href} variant={primary.variant ?? 'primary'} size="large" className={s.v2Button}>{primary.label}</MarketingButton>
        {secondary ? <MarketingButton href={secondary.href} variant={secondary.variant ?? 'glass'} size="large" className={s.v2ButtonDark}>{secondary.label}</MarketingButton> : null}
      </div>
    </div>
  );
}

function CheckIcon() { return <svg aria-hidden="true" viewBox="0 0 20 20"><path d="m4.5 10.4 3.3 3.3 7.7-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function MinusIcon() { return <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M5 10h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>; }
function ArrowIcon() { return <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M5 10h9m-3.5-3.5L14 10l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
