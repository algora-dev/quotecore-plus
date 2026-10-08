'use client';
import { useEffect, useRef, useState } from 'react';
import { calculate, currencyFor, visibleLines, documentIdentity, type DocumentDraft } from './document-model';
import s from './DocumentGenerator.module.css';
/** Customer-document boundary: keep the original light quote structure,
 * logo top-right, parties, item columns, notes, footer and guest branding.
 * No Dark Focus or glass treatments bleed into customer-facing output. */
export const DOCUMENT_CSS = `
.qcd-document{box-sizing:border-box;width:794px;min-height:1123px;padding:64px;background:#fff;color:#191b20;font:14px/1.5 Arial,Helvetica,sans-serif;overflow-wrap:anywhere;text-align:left;}
.qcd-document *{box-sizing:border-box;}
.qcd-document p{margin:0;}
.qcd-parties{display:flex;justify-content:space-between;gap:32px;margin-bottom:32px;}
.qcd-recipient{max-width:58%;}.qcd-sender{text-align:right;max-width:40%;}
.qcd-document .qcd-kicker{font-size:12px;color:#687181;margin:0 0 4px;}
.qcd-document .qcd-num{font-size:16px;font-weight:bold;margin-bottom:12px;}
.qcd-document .qcd-name{font-weight:bold;}.qcd-document .qcd-meta{color:#596273;}.qcd-document .qcd-date{margin-top:12px;}
.qcd-logo{display:block;margin:0 0 12px auto;max-width:150px;height:64px;object-fit:contain;}
.qcd-logo-spacer{height:76px;}.qcd-document table{width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 24px;}
.qcd-document th{font-size:12px;color:#596273;text-align:right;font-weight:500;padding:0 6px 10px;border-bottom:1px solid #dde1e7;}
.qcd-document td{padding:12px 6px;font-size:14px;text-align:right;vertical-align:top;border-bottom:1px solid #edf0f4;}
.qcd-document th:first-child,.qcd-document td:first-child{text-align:left;padding-left:0;}
.qcd-document th:last-child,.qcd-document td:last-child{padding-right:0;}
.qcd-document th:first-child{width:40%;}.qcd-document th:nth-child(2){width:10%;}.qcd-document th:nth-child(3){width:9%;}.qcd-document th:nth-child(4){width:19%;}.qcd-document th:nth-child(5){width:22%;}
.qcd-document td:last-child{font-weight:600;}.qcd-document .qcd-placeholder{color:#a4abb5;}
.qcd-document .qcd-placeholder-row td{height:56px;color:#8b94a3;}.qcd-totals{width:264px;margin:0 0 28px auto;}
.qcd-total-row{display:flex;justify-content:space-between;gap:12px;margin:6px 0;color:#596273;}
.qcd-total-row strong{color:#191b20;font-weight:500;}.qcd-total-final{border-top:1px solid #dde1e7;margin-top:10px;padding-top:10px;font-size:17px;font-weight:bold;color:#191b20;}.qcd-total-final strong{font-weight:bold;}
.qcd-notes,.qcd-footer{border-top:1px solid #edf0f4;padding-top:16px;margin-top:18px;white-space:pre-wrap;}.qcd-footer{color:#596273;}.qcd-branding{border-top:1px solid #edf0f4;padding-top:18px;margin-top:40px;display:flex;align-items:center;justify-content:center;gap:8px;color:#687181;font-size:10px;}.qcd-branding img{width:100px;height:auto;}
.qcd-document .qcd-doc-title{font:700 25px/1.2 Arial,Helvetica,sans-serif;letter-spacing:2px;margin:0 0 28px;color:#191b20;}
.qcd-delivery{display:flex;justify-content:space-between;gap:28px;white-space:pre-wrap;background:#f6f7f9;border:1px solid #e6e8ee;padding:16px;margin:0 0 28px;break-inside:avoid;}.qcd-delivery>div{flex:1;min-width:0;}
.qcd-payment{break-inside:avoid;border-top:1px solid #e6e8ee;padding-top:16px;margin-top:18px;white-space:pre-wrap;}.qcd-payment-ref{margin-top:10px!important;}.qcd-currency{text-align:right;color:#687181;font-size:11px;margin:0 0 14px!important;}
@media print{@page{size:A4;margin:18mm;}html,body{margin:0!important;padding:0!important;background:white!important;}.qcd-document{width:auto;min-height:0;padding:0;font-size:10pt;}.qcd-document table{overflow:visible;}.qcd-document thead{display:table-header-group;}.qcd-document tr{break-inside:avoid;}.qcd-document th{font-size:9pt;}.qcd-document td{font-size:10pt;}.qcd-parties,.qcd-totals,.qcd-branding{break-inside:avoid;}.qcd-notes,.qcd-footer{break-inside:auto;}.qcd-document .qcd-placeholder-row{display:none;}.qcd-logo{max-height:18mm;}.qcd-document .qcd-meta{color:#424a56;}}
`;
function exactMoney(n:number,code:string){return `${currencyFor(code).symbol}${(Number.isFinite(n)?n:0).toFixed(2)}`;}
export function DocumentPaper({draft:d,guest=true,placeholders=false}: {draft:DocumentDraft;guest?:boolean;placeholders?:boolean}) {
  const totals=calculate(d),lines=visibleLines(d),meta=documentIdentity(d),order=meta.kind==='order',invoice=meta.kind==='invoice';
  return <article className="qcd-document" aria-label={`${order?'Supplier':'Customer'} ${meta.noun} document`}>
    {meta.kind!=='quote'&&<h1 className="qcd-doc-title">{invoice?'INVOICE':'PURCHASE ORDER'}</h1>}
    <div className="qcd-parties"><div className="qcd-recipient">
      {d.logo&&<div className="qcd-logo-spacer"/>}
      <p className="qcd-num">{meta.number || (placeholders?invoice?'INV-001':order?'PO-001':'Q-001':'')}</p><p className="qcd-kicker">{order?'Supplier:':invoice?'Bill to:':'Quote to:'}</p>
      <p className={`qcd-name ${!meta.recipient&&placeholders?'qcd-placeholder':''}`}>{meta.recipient || (order?'Supplier name':placeholders?'Customer name':'Client name')}</p>
      {meta.email&&<p className="qcd-meta">{meta.email}</p>}{meta.address&&<p className="qcd-meta">{meta.address}</p>}
      <p className="qcd-meta qcd-date">{order?'Order date':'Date'}: {meta.date}</p>
      {invoice?(d.dueDate&&<p className="qcd-meta">Due: {d.dueDate}</p>):order?(d.jobReference&&<p className="qcd-meta">Reference: {d.jobReference}</p>):<p className="qcd-meta">Valid for: {d.validDays} days</p>}
    </div><div className="qcd-sender">
      {d.logo&&<img src={d.logo} alt="Business logo" className="qcd-logo"/>}
      <p className="qcd-kicker">{order?'Ordered by:':'From:'}</p>{d.fromName&&<p className="qcd-name">{d.fromName}</p>}
      <p className={!d.companyName&&placeholders?'qcd-placeholder':''}>{d.companyName || (placeholders?'Your business name':'')}</p>
      {meta.kind!=='quote'&&d.fromAddress&&<p className="qcd-meta">{d.fromAddress}</p>}{meta.kind!=='quote'&&d.taxId&&<p className="qcd-meta">Tax / registration: {d.taxId}</p>}
      {d.fromPhone&&<p className="qcd-meta">{d.fromPhone}</p>}{d.fromEmail&&<p className="qcd-meta">{d.fromEmail}</p>}
    </div></div>
    {order&&(d.deliveryAddress||d.deliveryDate)&&<div className="qcd-delivery"><div><p className="qcd-kicker">Deliver to</p><p>{d.deliveryAddress||'To be confirmed'}</p></div>{d.deliveryDate&&<div><p className="qcd-kicker">Requested delivery</p><p>{d.deliveryDate}</p></div>}</div>}
    <table><thead><tr><th scope="col">Description</th><th scope="col">Qty</th><th scope="col">Unit</th><th scope="col">Rate</th><th scope="col">Total</th></tr></thead>
      <tbody>{lines.map(l=><tr key={l.id}><td>{l.description}</td><td>{l.qty}</td><td>{l.unit}</td><td>{d.hideAllPrices?'-':exactMoney(l.rate,d.currencyCode)}</td><td>{d.hideAllPrices?'-':exactMoney(l.qty*l.rate,d.currencyCode)}</td></tr>)}
        {!lines.length&&placeholders&&<tr className="qcd-placeholder-row"><td>Your items will appear here</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>}
      </tbody></table>
    {!d.hideTotals&&<div className="qcd-totals"><div className="qcd-total-row"><span>Subtotal</span><strong>{exactMoney(totals.subtotal,d.currencyCode)}</strong></div>
      {d.taxEnabled&&<div className="qcd-total-row"><span>{d.taxName} ({d.taxRate}%)</span><strong>{exactMoney(totals.tax,d.currencyCode)}</strong></div>}
      <div className="qcd-total-row qcd-total-final"><span>Total</span><strong>{exactMoney(totals.total,d.currencyCode)}</strong></div></div>}
    {meta.kind!=='quote'&&<p className="qcd-currency">Amounts in {d.currencyCode}</p>}
    {invoice&&(d.paymentDetails||d.paymentReference)&&<section className="qcd-payment"><p className="qcd-kicker">Payment details</p>{d.paymentDetails&&<p>{d.paymentDetails}</p>}{d.paymentReference&&<p className="qcd-payment-ref"><strong>Payment reference:</strong> {d.paymentReference}</p>}</section>}
    {d.notes&&<div className="qcd-notes"><p className="qcd-kicker">{order?'Notes for supplier':'Notes'}</p><p>{d.notes}</p></div>}
    {d.footer&&<div className="qcd-footer" style={{fontStyle:d.footerItalic?'italic':'normal'}}>{d.footer}</div>}
    {guest&&<div className="qcd-branding"><img src="/marketing/brand/quotecore-logo-transparent.png" alt="QuoteCore+"/><span>This {meta.noun} was generated using QuoteCore+ Free Tools — quotecoreplus.com</span></div>}
  </article>;
}
export function ScaledPaper({draft,guest,placeholders=false}: {draft:DocumentDraft;guest:boolean;placeholders?:boolean}) {
  const outer=useRef<HTMLDivElement>(null),inner=useRef<HTMLDivElement>(null);
  const [size,setSize]=useState({scale:0.5,height:562});
  useEffect(()=>{
    const o=outer.current,i=inner.current;if(!o||!i)return;
    const measure=()=>{const scale=Math.min(1,o.clientWidth/794);const height=i.offsetHeight*scale;setSize(prev=>Math.abs(prev.scale-scale)<.0001&&Math.abs(prev.height-height)<.1?prev:{scale,height});};
    measure();const observer=new ResizeObserver(measure);observer.observe(o);observer.observe(i);return()=>observer.disconnect();
  },[]);
  return <div ref={outer} className={s.scaledPaper} style={{height:size.height}}><div ref={inner} style={{width:794,transform:`scale(${size.scale})`,transformOrigin:'top left'}}><DocumentPaper draft={draft} guest={guest} placeholders={placeholders}/></div></div>;
}
