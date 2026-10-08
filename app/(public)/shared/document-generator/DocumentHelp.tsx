import { QUOTE_FAQS, INVOICE_FAQS, ORDER_FAQS } from './document-content';
import { DOCUMENT_COPY } from './document-copy';
import { DOCUMENT_ROUTES, type DocumentKind } from './document-model';
import s from './DocumentGenerator.module.css';
/** Server-renderable support content, outside the task and export surface. */
export function DocumentHelp({kind='quote'}:{kind?:DocumentKind}) {
  const copy=DOCUMENT_COPY[kind],faqs=kind==='invoice'?INVOICE_FAQS:kind==='order'?ORDER_FAQS:QUOTE_FAQS;
  return <div className={s.root} data-qc-ui="v2">
    <section className={s.seo} aria-labelledby="quote-help-title">
      <div className={s.seoInner}><div className={s.seoIntro}><p className={s.eyebrow}>A LITTLE HELP, WHEN YOU NEED IT</p><h2 id="quote-help-title">Your {copy.noun}. Your way.</h2><p>Build your document line by line, or bring in the details with optional {copy.assist}. Add your branding, check the numbers and export a document that’s ready to share.</p>
        <div className={s.relatedLinks}>{(['quote','invoice','order'] as const).filter(k=>k!==kind).map(k=><a href={DOCUMENT_ROUTES[k]} key={k}>{DOCUMENT_COPY[k].label} generator ↗</a>)}<a href="/free-tools">All free tools ↗</a></div>
      </div>
      <div className={s.faqs}>{faqs.map(f=><details className={s.faq} key={f.q}><summary>{f.q}<span aria-hidden="true">+</span></summary><p>{f.a}</p></details>)}</div></div>
    </section>
    <footer className={s.toolFooter}><div><span>© {new Date().getFullYear()} QuoteCore+</span><nav aria-label="Legal and contact"><a href="/privacy">Privacy</a><a href="/cookies">Cookies</a><a href="/terms">Terms</a><a href="mailto:info@quote-core.com">Contact</a></nav></div></footer>
  </div>;
}
