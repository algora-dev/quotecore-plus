'use client';
import {DEMO_HREF} from './hub-catalog';
import {hubEvent} from './hub-events';
import {ActionLink,Eyebrow,Icon} from './HubUi';
import s from './hub.module.css';
export default function HubAppBridge(){return <section className={`${s.appSection} ${s.dark}`} aria-labelledby="app-heading"><div className={`${s.wrap} ${s.appLayout}`}>
 <div><Eyebrow>THE NEXT STEP, WHEN YOU NEED IT</Eyebrow><h2 id="app-heading">Free Tools for One Job.<br/><span>QuoteCore+ for Your Entire Workflow.</span></h2><p className={s.appIntro}>Keep your prices, components and jobs in one place. Go from measurements to quote, order and invoice without starting again.</p>
 <div className={s.appBenefits}><p><Icon name="library"/><span><strong>Your pricing, ready next time.</strong>Save and reuse your component library.</span></p><p><Icon name="workflow"/><span><strong>One connected job.</strong>Keep your measurements and documents together.</span></p></div>
 <div className={s.appActions}><ActionLink href={DEMO_HREF} variant="primary" onClick={()=>hubEvent('demo_tool_click',{source:'hub-app-bridge',mode:'takeoff'})}><Icon name="play"/>Try the Demo</ActionLink><ActionLink href="/" onClick={()=>hubEvent('free_tools_app_explore',{source:'app-bridge'})}>Explore QuoteCore+<Icon name="arrow"/></ActionLink></div>
 <p className={s.appReassurance}>The app is paid. The demo is free to explore.</p>
 </div>
 <div className={s.appVisual}><div className={s.productFrame}><div className={s.productBar}><span className={s.productDots} aria-hidden="true"><i/><i/><i/></span><span>YOUR WORK, CONNECTED</span><span>QuoteCore<span className={s.plus}>+</span></span></div>
  {/* Genuine supplied app image, not a generated interface. */}
  {/* eslint-disable-next-line @next/next/no-img-element */}
  <img src="/marketing/free-tools/takeoff-workspace.webp" alt="QuoteCore+ digital takeoff workspace with a measured roof and navigation for quotes, orders and invoices" width="1050" height="571" loading="lazy" decoding="async"/>
  <div className={s.productJourney}><span>Measure</span><Icon name="arrow"/><span>Price</span><Icon name="arrow"/><span>Quote</span><Icon name="arrow"/><span>Send</span></div></div>
  <a href="/done-for-you-setup" className={s.setupLink} onClick={()=>hubEvent('free_tools_setup_explore',{source:'app-bridge'})}><Icon name="help"/><span><strong>Prefer a hand getting set up?</strong>See our Done For You Setup.</span><Icon name="arrow"/></a>
 </div>
</div></section>;}
