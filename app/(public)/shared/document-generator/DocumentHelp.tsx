import Link from 'next/link';
import { QUOTE_FAQS } from './document-content';
import s from './DocumentGenerator.module.css';
/** Server-renderable support content, outside the task and export surface. */
export function DocumentHelp() {
  return <div className={s.root} data-qc-ui="v2">
    <section className={s.seo} aria-labelledby="quote-help-title">
      <div className={s.seoInner}><div className={s.seoIntro}><p className={s.eyebrow}>A LITTLE HELP, WHEN YOU NEED IT</p><h2 id="quote-help-title">Your quote. Your way.</h2><p>Build a quote line by line, or bring in the details with optional Quote Assist. Add your branding, check the numbers and export a document that’s ready to share.</p>
        <div className={s.relatedLinks}><Link href="/free-invoice-generator">Invoice generator ↗</Link><Link href="/free-purchase-order-generator">Purchase order generator ↗</Link><Link href="/free-tools">All free tools ↗</Link></div>
      </div>
      <div className={s.faqs}>{QUOTE_FAQS.map(f=><details className={s.faq} key={f.q}><summary>{f.q}<span aria-hidden="true">+</span></summary><p>{f.a}</p></details>)}</div></div>
    </section>
    <footer className={s.toolFooter}><div><span>© {new Date().getFullYear()} QuoteCore+</span><nav aria-label="Legal and contact"><Link href="/privacy">Privacy</Link><Link href="/cookies">Cookies</Link><Link href="/terms">Terms</Link><a href="mailto:info@quote-core.com">Contact</a></nav></div></footer>
  </div>;
}
