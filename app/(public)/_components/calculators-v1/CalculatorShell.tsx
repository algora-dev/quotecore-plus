import type { ReactNode } from 'react';
import { Icon } from './CalculatorUI';
import { profileFor, type Trade } from './calculator-profile';
/** Auth is a slot so the standalone preview cannot accidentally create accounts. */
export function CalculatorShell({trade,children,account,linkOrigin=''}:{trade:Trade;children:ReactNode;account:ReactNode;linkOrigin?:string}) {
  const link=(href:string)=>linkOrigin+href,profile=profileFor(trade);
  return <div className="qck" data-qc-ui="v2" data-qc-experience={profile.slug+'-v1'}><a href="#qck-main" className="qck-skip">Skip to calculator</a>
    <header className="qck-header"><div className="qck-container qck-header-inner"><a href={link('/')} className="qck-brand" aria-label="QuoteCore+ home">
      {/* Existing transparent asset; intrinsic box avoids a layout shift. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/marketing/brand/quotecore-logo-transparent.png" alt="QuoteCore+" width="193" height="42"/>
    </a><span className="qck-header-label">Tools for the way you work.</span><nav className="qck-header-actions" aria-label="Site navigation"><a className="qck-header-all-tools" href={link('/free-tools')}><Icon name="back" size={14}/> All free tools</a>{account}<a className="qck-button qck-primary qck-demo-button" href={link('/takeoff-demo')}>Demo <Icon name="arrow" size={16}/></a></nav></div></header>
    {children}
    <section className="qck-info-section" aria-labelledby="qck-guide-title"><div className="qck-container qck-info-inner"><div className="qck-info-intro"><span className="qck-eyebrow">A LITTLE CLARITY GOES A LONG WAY</span><h2 id="qck-guide-title">Know what goes into your numbers.</h2><p>The calculator keeps the working visible, so you can check your measurements and make an informed next step.</p></div><div className="qck-faq">{profile.faqs.map(f=><details key={f.q}><summary>{f.q}<Icon name="chevron" size={16}/></summary><p>{f.a}</p></details>)}</div></div></section>
    <div className="qck-container"><section className="qck-app-bridge"><div><span className="qck-eyebrow">FROM A MEASUREMENT TO A WORKFLOW</span><h2>There’s more to a job than the numbers.</h2><p>See how the paid QuoteCore+ app connects digital takeoff, Smart Components, quotes, orders and invoices. Start with the demo, without signing up.</p></div><div className="qck-app-bridge-actions"><a className="qck-button qck-primary" href={link('/takeoff-demo')}>Try the Demo <Icon name="play" size={16}/></a><a className="qck-button qck-glass" href={link('/')}>Explore QuoteCore+ <Icon name="arrow" size={16}/></a></div></section>
      <nav className="qck-related" aria-label="Related free tools"><span>Keep working with</span>{profile.related.map(item=><a key={item.href} className="qck-button qck-glass qck-small" href={link(item.href)}>{item.label} <Icon name="arrow" size={15}/></a>)}</nav>
    </div>
    <footer className="qck-footer"><div className="qck-container"><p>QuoteCore+ · Quoting and job management for trade businesses.</p><nav aria-label="Footer"><a href={link('/free-tools')}>Free Tools</a><a href={link('/privacy')}>Privacy</a><a href={link('/terms')}>Terms</a></nav></div></footer>
  </div>;
}
