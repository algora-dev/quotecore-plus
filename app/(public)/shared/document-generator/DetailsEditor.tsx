'use client';
import { useRef, useState } from 'react';
import { addDays, CURRENCIES, documentIdentity, type DocumentDraft, type ValidationIssue } from './document-model';
import { DOCUMENT_COPY } from './document-copy';
import { rasterize } from './document-media';
import { Disclosure, Field } from './ui';
import { Icon } from './Icon';
import s from './DocumentGenerator.module.css';
export type ChangeField = <K extends keyof DocumentDraft>(field:K,value:DocumentDraft[K])=>void;
export function DetailsEditor({draft:d,change,errors}: {draft:DocumentDraft;change:ChangeField;errors:ValidationIssue[]}) {
  const logoInput=useRef<HTMLInputElement>(null),[logoError,setLogoError]=useState(''),[loadingLogo,setLoadingLogo]=useState(false);
  const meta=documentIdentity(d),copy=DOCUMENT_COPY[meta.kind],order=meta.kind==='order',invoice=meta.kind==='invoice';
  const nameField=order?'supplierName':'clientName',emailField=order?'supplierEmail':'clientEmail',addressField=order?'supplierAddress':'clientAddress';
  const numberField=invoice?'invoiceNumber':order?'poNumber':'quoteNumber',dateField=invoice?'invoiceDate':order?'poDate':'quoteDate';
  const error=(name:string)=>errors.find(e=>e.field===name)?.message;
  async function upload(file?:File){if(!file)return;setLoadingLogo(true);setLogoError('');try{change('logo',await rasterize(file,'logo'));}catch(e){setLogoError(e instanceof Error?e.message:'This image could not be opened.');}finally{setLoadingLogo(false);}}
  return <>
    <div className={s.partyGrid}>
      <section className={s.partySection} aria-labelledby="business-heading"><h3 id="business-heading"><Icon name="building"/>Your business</h3>
        <Field id="companyName" label="Business or trading name" value={d.companyName} autoComplete="organization" placeholder="Your business name" maxLength={200} onChange={e=>change('companyName',e.target.value)}/>
        <div className={s.logoRow}>
          <button className={s.logoUpload} type="button" aria-label={d.logo?'Change business logo':'Add business logo'} disabled={loadingLogo} onClick={()=>logoInput.current?.click()}>{d.logo?<img src={d.logo} alt="Your business logo"/>:<Icon name="image"/>}</button>
          <div><button type="button" className={s.textButton} disabled={loadingLogo} onClick={()=>logoInput.current?.click()}>{loadingLogo?'Preparing logo…':d.logo?'Change logo':'Add your logo'}</button><p className={s.hint}>{d.logo?`Appears on your ${copy.noun}`:'Optional · PNG, JPEG or WebP'}</p></div>
          {d.logo&&<button type="button" className={s.textButton} onClick={()=>change('logo',null)}>Remove</button>}
          <input ref={logoInput} hidden type="file" accept="image/png,image/jpeg,image/webp" aria-label="Business logo file" onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/>
        </div>{logoError&&<p role="alert" className={s.fieldError}>{logoError}</p>}
        <Disclosure title="Contact details" subtitle={meta.kind==='quote'?'Name, email and phone':'Name, email, phone and address'} open={!!error('fromEmail')}>
          <Field id="fromName" label="Contact name" optional value={d.fromName} autoComplete="name" placeholder="Your name" maxLength={200} onChange={e=>change('fromName',e.target.value)}/>
          <Field id="fromEmail" label="Business email" optional error={error('fromEmail')} type="email" value={d.fromEmail} autoComplete="email" placeholder="you@yourbusiness.com" maxLength={254} onChange={e=>change('fromEmail',e.target.value)}/>
          <Field id="fromPhone" label="Phone number" optional type="tel" value={d.fromPhone} autoComplete="tel" placeholder="Your contact number" maxLength={80} onChange={e=>change('fromPhone',e.target.value)}/>
          {meta.kind!=='quote'&&<><Field id="fromAddress" label="Business address" optional value={d.fromAddress??''} placeholder="Street, town, postcode" maxLength={1000} onChange={e=>change('fromAddress',e.target.value)}/><Field id="taxId" label="Tax / registration number" optional value={d.taxId??''} placeholder="Where applicable to your business" maxLength={100} onChange={e=>change('taxId',e.target.value)}/></>}
        </Disclosure>
      </section>
      <section className={s.partySection} aria-labelledby="customer-heading"><h3 id="customer-heading"><Icon name={order?'building':'user'}/>Your {copy.recipient}</h3>
        <Field id={nameField} label={order?'Supplier or company name':'Customer or company name'} value={meta.recipient} placeholder={copy.recipientPlaceholder} maxLength={200} onChange={e=>change(nameField,e.target.value)}/>
        <Field id={addressField} label={order?'Supplier address':'Customer / project address'} optional value={meta.address} placeholder="Street, town, postcode" maxLength={1000} onChange={e=>change(addressField,e.target.value)}/>
        <Disclosure title={`${copy.recipientTitle} email`} subtitle="Include it on the document" open={!!error(emailField)}>
          <Field id={emailField} label={`${copy.recipientTitle} email address`} optional error={error(emailField)} type="email" value={meta.email} placeholder={order?'orders@supplier.com':'customer@example.com'} maxLength={254} onChange={e=>change(emailField,e.target.value)}/>
        </Disclosure>
      </section>
    </div>
    <section className={s.quoteDetails} aria-labelledby="quote-details-heading"><h3 id="quote-details-heading">{copy.label} details</h3><div className={s.settingsGrid}>
      <Field id={numberField} label={order?'PO number':`${copy.label} number`} value={meta.number} error={error(numberField)} maxLength={100} onChange={e=>change(numberField,e.target.value)}/>
      <Field id={dateField} label={order?'Order date':`${copy.label} date`} type="date" value={meta.date} error={error(dateField)} onChange={e=>change(dateField,e.target.value)}/>
      {meta.kind==='quote'?<Field id="validDays" label="Valid for (days)" inputMode="numeric" value={d.validDays} error={error('validDays')} onChange={e=>change('validDays',e.target.value)}/>:
        invoice?<div><Field id="dueDate" label="Due date" optional type="date" value={d.dueDate??''} error={error('dueDate')} onChange={e=>change('dueDate',e.target.value)}/><div className={s.dateShortcuts} role="group" aria-label="Set payment due date"><span>From invoice date:</span>{[0,7,14,30].map(days=><button type="button" key={days} onClick={()=>change('dueDate',addDays(meta.date,days))}>{days===0?'On receipt':`${days} days`}</button>)}</div></div>:
        <Field id="jobReference" label="Job / site reference" optional value={d.jobReference??''} placeholder="e.g. JOB-024" maxLength={200} onChange={e=>change('jobReference',e.target.value)}/>}
      <Field id="currencyCode" label="Currency"><select id="currencyCode" value={d.currencyCode} onChange={e=>change('currencyCode',e.target.value as DocumentDraft['currencyCode'])}>{CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.label}</option>)}</select></Field>
    </div></section>
    {invoice&&<Disclosure title="How should your customer pay?" subtitle={d.paymentDetails?'Payment instructions added':'Add bank details or payment instructions'} icon="file" open={!!d.paymentDetails}>
      <div className={s.field}><label htmlFor="paymentDetails">Payment instructions <span className={s.optional}>Optional</span></label><textarea id="paymentDetails" rows={4} maxLength={12000} value={d.paymentDetails??''} placeholder="Bank name, account name and details, or another agreed way to pay…" onChange={e=>change('paymentDetails',e.target.value)}/><p className={s.hint}>Shown on the invoice. Check the details carefully before sharing.</p></div>
      <Field id="paymentReference" label="Payment reference" optional value={d.paymentReference??''} placeholder={meta.number||'e.g. Your invoice number'} maxLength={200} onChange={e=>change('paymentReference',e.target.value)}/>
    </Disclosure>}
    {order&&<Disclosure title="Delivery details" subtitle={d.deliveryAddress?'Delivery address added':'Where and when you need the materials'} icon="building" open={!!d.deliveryAddress||!!error('deliveryDate')}>
      <div className={s.twoFields}><Field id="deliveryDate" label="Requested delivery date" optional type="date" value={d.deliveryDate??''} error={error('deliveryDate')} hint="Your supplier still needs to confirm this." onChange={e=>change('deliveryDate',e.target.value)}/><div className={s.field}><label htmlFor="deliveryAddress">Delivery address <span className={s.optional}>Optional</span></label><textarea id="deliveryAddress" rows={3} value={d.deliveryAddress??''} maxLength={2000} placeholder="Site address, postcode and access details…" onChange={e=>change('deliveryAddress',e.target.value)}/></div></div>
    </Disclosure>}
  </>;
}
