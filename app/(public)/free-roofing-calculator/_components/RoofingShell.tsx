import type { ReactNode } from 'react';
import { Icon } from './RoofingUI';
import { ROOFING_FAQS } from './roofing-content';
/** Auth is a slot so the standalone preview cannot accidentally create accounts. */
export function RoofingShell({children,account,linkOrigin=''}:{children:ReactNode;account:ReactNode;linkOrigin?:string}) {
  const link=(href:string)=>linkOrigin+href;
  return <div className="qcr" data-qc-ui="v2" data-qc-experience="roofing-calculator-v1"><a href="#qcr-main" className="qcr-skip">Skip to calculator</a>
    <header className="qcr-header"><div className="qcr-container qcr-header-inner"><a href={link('/')} className="qcr-brand" aria-label="QuoteCore+ home">
      {/* Existing transparent asset; intrinsic box avoids a layout shift. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/marketing/brand/quotecore-logo-transparent.png" alt="QuoteCore+" width="193" height="42"/>
    </a><span className="qcr-header-label">Tools for the way you work.</span><nav className="qcr-header-actions" aria-label="Site navigation"><a className="qcr-header-all-tools" href={link('/free-tools')}><Icon name="back" size={14}/> All free tools</a>{account}<a className="qcr-button qcr-primary qcr-demo-button" href={link('/takeoff-demo')}>Demo <Icon name="arrow" size={16}/></a></nav></div></header>
    {children}
    <section className="qcr-info-section" aria-labelledby="qcr-guide-title"><div className="qcr-container qcr-info-inner"><div className="qcr-info-intro"><span className="qcr-eyebrow">A LITTLE CLARITY GOES A LONG WAY</span><h2 id="qcr-guide-title">Know what goes into your numbers.</h2><p>The calculator keeps the working visible, so you can check your measurements and make an informed next step.</p></div><div className="qcr-faq">{ROOFING_FAQS.map(f=><details key={f.q}><summary>{f.q}<Icon name="chevron" size={16}/></summary><p>{f.a}</p></details>)}</div></div></section>
    <div className="qcr-container"><section className="qcr-app-bridge"><div><span className="qcr-eyebrow">FROM A MEASUREMENT TO A WORKFLOW</span><h2>There’s more to a job than the numbers.</h2><p>See how the paid QuoteCore+ app connects digital takeoff, Smart Components, quotes, orders and invoices. Start with the demo, without signing up.</p></div><div className="qcr-app-bridge-actions"><a className="qcr-button qcr-primary" href={link('/takeoff-demo')}>Try the Demo <Icon name="play" size={16}/></a><a className="qcr-button qcr-glass" href={link('/')}>Explore QuoteCore+ <Icon name="arrow" size={16}/></a></div></section>
      <nav className="qcr-related" aria-label="Related free tools"><span>Keep working with</span><a className="qcr-button qcr-glass qcr-small" href={link('/free-roof-takeoff')}>Digital roof takeoff <Icon name="arrow" size={15}/></a><a className="qcr-button qcr-glass qcr-small" href={link('/free-construction-calculator')}>Construction calculator <Icon name="arrow" size={15}/></a><a className="qcr-button qcr-glass qcr-small" href={link('/free-quote-generator')}>Free Quote Generator <Icon name="arrow" size={15}/></a><a className="qcr-button qcr-glass qcr-small" href={link('/free-calculators')}>All calculators <Icon name="arrow" size={15}/></a></nav>
    </div>
    <footer className="qcr-footer"><div className="qcr-container"><p>QuoteCore+ · Quoting and job management for trade businesses.</p><nav aria-label="Footer"><a href={link('/free-tools')}>Free Tools</a><a href={link('/privacy')}>Privacy</a><a href={link('/terms')}>Terms</a></nav></div></footer>
  </div>;
}
