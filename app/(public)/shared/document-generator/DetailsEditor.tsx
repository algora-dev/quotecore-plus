'use client';
import { useRef, useState } from 'react';
import { CURRENCIES, type DocumentDraft, type ValidationIssue } from './document-model';
import { rasterize } from './document-media';
import { Button, Disclosure, Field } from './ui';
import { Icon } from './Icon';
import s from './DocumentGenerator.module.css';
export type ChangeField = <K extends keyof DocumentDraft>(field:K,value:DocumentDraft[K])=>void;
export function DetailsEditor({draft:d,change,errors}: {draft:DocumentDraft;change:ChangeField;errors:ValidationIssue[]}) {
  const logoInput=useRef<HTMLInputElement>(null),[logoError,setLogoError]=useState(''),[loadingLogo,setLoadingLogo]=useState(false);
  const error=(name:string)=>errors.find(e=>e.field===name)?.message;
  async function upload(file?:File){if(!file)return;setLoadingLogo(true);setLogoError('');try{change('logo',await rasterize(file,'logo'));}catch(e){setLogoError(e instanceof Error?e.message:'This image could not be opened.');}finally{setLoadingLogo(false);}}
  return <>
    <div className={s.partyGrid}>
      <section className={s.partySection} aria-labelledby="business-heading"><h3 id="business-heading"><Icon name="building"/>Your business</h3>
        <Field id="companyName" label="Business or trading name" value={d.companyName} autoComplete="organization" placeholder="Your business name" maxLength={200} onChange={e=>change('companyName',e.target.value)}/>
        <div className={s.logoRow}>
          <button className={s.logoUpload} type="button" aria-label={d.logo?'Change business logo':'Add business logo'} disabled={loadingLogo} onClick={()=>logoInput.current?.click()}>
            {d.logo?<img src={d.logo} alt="Your business logo"/>:<Icon name="image"/>}</button>
          <div><button type="button" className={s.textButton} disabled={loadingLogo} onClick={()=>logoInput.current?.click()}>{loadingLogo?'Preparing logo…':d.logo?'Change logo':'Add your logo'}</button><p className={s.hint}>{d.logo?'Appears on your quote':'Optional · PNG, JPEG or WebP'}</p></div>
          {d.logo&&<button type="button" className={s.textButton} onClick={()=>change('logo',null)}>Remove</button>}
          <input ref={logoInput} hidden type="file" accept="image/png,image/jpeg,image/webp" aria-label="Business logo file" onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/>
        </div>{logoError&&<p role="alert" className={s.fieldError}>{logoError}</p>}
        <Disclosure title="Contact details" subtitle="Name, email and phone" open={!!error('fromEmail')}>
          <Field id="fromName" label="Contact name" optional value={d.fromName} autoComplete="name" placeholder="Your name" maxLength={200} onChange={e=>change('fromName',e.target.value)}/>
          <Field id="fromEmail" label="Business email" optional error={error('fromEmail')} type="email" value={d.fromEmail} autoComplete="email" placeholder="you@yourbusiness.com" maxLength={254} onChange={e=>change('fromEmail',e.target.value)}/>
          <Field id="fromPhone" label="Phone number" optional type="tel" value={d.fromPhone} autoComplete="tel" placeholder="Your contact number" maxLength={80} onChange={e=>change('fromPhone',e.target.value)}/>
        </Disclosure>
      </section>
      <section className={s.partySection} aria-labelledby="customer-heading"><h3 id="customer-heading"><Icon name="user"/>Your customer</h3>
        <Field id="clientName" label="Customer or company name" value={d.clientName} placeholder="Who are you quoting for?" maxLength={200} onChange={e=>change('clientName',e.target.value)}/>
        <Field id="clientAddress" label="Customer / project address" optional value={d.clientAddress} placeholder="Street, town, postcode" maxLength={1000} onChange={e=>change('clientAddress',e.target.value)}/>
        <Disclosure title="Customer email" subtitle="Include it on the document" open={!!error('clientEmail')}>
          <Field id="clientEmail" label="Customer email address" optional error={error('clientEmail')} type="email" value={d.clientEmail} placeholder="customer@example.com" maxLength={254} onChange={e=>change('clientEmail',e.target.value)}/>
        </Disclosure>
      </section>
    </div>
    <section className={s.quoteDetails} aria-labelledby="quote-details-heading"><h3 id="quote-details-heading">Quote details</h3><div className={s.settingsGrid}>
      <Field id="quoteNumber" label="Quote number" value={d.quoteNumber} error={error('quoteNumber')} maxLength={100} onChange={e=>change('quoteNumber',e.target.value)}/>
      <Field id="quoteDate" label="Quote date" type="date" value={d.quoteDate} error={error('quoteDate')} onChange={e=>change('quoteDate',e.target.value)}/>
      <Field id="validDays" label="Valid for (days)" inputMode="numeric" value={d.validDays} error={error('validDays')} onChange={e=>change('validDays',e.target.value)}/>
      <Field id="currencyCode" label="Currency"><select id="currencyCode" value={d.currencyCode} onChange={e=>change('currencyCode',e.target.value as DocumentDraft['currencyCode'])}>{CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.label}</option>)}</select></Field>
    </div></section>
  </>;
}
