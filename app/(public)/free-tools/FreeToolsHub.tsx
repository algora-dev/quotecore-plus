import HubCategories from './HubCategories';
import HubAssistant from './HubAssistant';
import HubDirectory from './HubDirectory';
import HubAppBridge from './HubAppBridge';
import {FAQS} from './hub-catalog';
import {Eyebrow,Icon} from './HubUi';
import s from './hub.module.css';
/** A server-rendered body with focused client islands. Initial directory links
 * and FAQ answers are HTML, not dependent on assistant or category state. */
export default function FreeToolsHub({preview=false}:{preview?:boolean}){return <main id="free-tools-content" className={s.hub} data-qc-hub="v1">
 <section className={s.hero} aria-labelledby="hub-heading"><div className={s.wrap}>
  <div className={s.heroIntro}><Eyebrow>FREE TOOLS FOR ROOFING &amp; CONSTRUCTION</Eyebrow><h1 id="hub-heading">Free Roofing &amp; Construction Tools</h1><p>Measure roofing, cladding and flooring, calculate materials and roof pitch, or create free quotes, invoices and purchase orders. Choose a tool and get straight to work.</p></div>
  <HubCategories/>
 </div></section>
 <HubAssistant preview={preview}/>
 <HubDirectory/>
 <HubAppBridge/>
 <section className={s.faqSection} aria-labelledby="faq-heading"><div className={`${s.wrap} ${s.faqLayout}`}><div><Eyebrow>GOOD TO KNOW</Eyebrow><h2 id="faq-heading">Free Construction Tools: Frequently Asked Questions</h2><p>Start with a free tool. Move to the app only when a connected workflow makes sense for you.</p><a href="/contact" className={s.textLink}>Still have a question?<Icon name="arrow"/></a></div><div className={s.faqs}>{FAQS.map((f,i)=><details key={f.question}><summary><span>{f.question}</span><Icon name="chevron"/></summary><div><p>{f.answer}</p>{f.href&&<a href={f.href}>{f.link}<Icon name="arrow"/></a>}</div></details>)}</div></div></section>
 </main>;}
