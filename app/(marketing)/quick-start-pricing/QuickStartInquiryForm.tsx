'use client';

import { useRef, useState, type FormEvent } from 'react';
import styles from './QuickStartPricing.module.css';

type Stage = 0 | 1 | 2;
const volumes = ['1 to 5', '6 to 15', '16 to 30', '31 to 60', 'More than 60', 'I need help counting'];
const steps = [
  { title: 'What pricing do you need set up?', detail: 'One Smart Component is one reusable product or service, such as roof covering, underlay, a ridge flashing or roofing screws. It can include material, labour, waste and pitch settings. A rough count is fine.' },
  { title: 'Send us what you already have.', detail: 'Attach your price list, notes or old quotes. Or describe what you use. We will ask for anything missing.' },
  { title: 'Where should our team reply?', detail: 'We will confirm the scope and final price before sending any payment link.' },
];

export function QuickStartInquiryForm({ workspace }: { workspace?: string }) {
  const [step, setStep] = useState<Stage>(0);
  const [count, setCount] = useState('');
  const [systems, setSystems] = useState('');
  const [details, setDetails] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [business, setBusiness] = useState('');
  const [consent, setConsent] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const focusRef = useRef<HTMLHeadingElement>(null);
  function navigate(next: Stage) {
    setError('');
    setStep(next);
    requestAnimationFrame(() => focusRef.current?.focus({ preventScroll: true }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || sent) return;
    if (!count) { navigate(0); setError('Choose the approximate number of components.'); return; }
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email.trim()) || !consent) { setError('Enter your name and email, and confirm you have permission to share these details.'); return; }
    setPending(true); setError('');
    try {
      const data = new FormData();
      data.set('componentCount', count); data.set('systems', systems); data.set('details', details);
      data.set('name', name); data.set('email', email); data.set('businessName', business);
      data.set('consent', 'yes');
      if (workspace) data.set('workspace', workspace);
      files.forEach(file => data.append('files', file));
      const response = await fetch('/api/quick-start-inquiry', { method: 'POST', body: data });
      const payload: { error?: string } = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'We could not send your enquiry. Please try again.');
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send your enquiry.');
    } finally { setPending(false); }
  }
  return <div className={styles.formShell} id="quick-start-enquiry">
    {sent ? <div className={styles.success} role="status"><span className={styles.eyebrow}>ENQUIRY RECEIVED</span><h2>Thanks, {name.trim().split(' ')[0]}.</h2><p>Our team will review your pricing information and email you if anything is missing. Once the scope is agreed, we'll send the price and a secure Stripe payment link. No payment was taken.</p></div> : <>
      <div className={styles.formProgress} aria-label={`Step ${step + 1} of 3`}>{steps.map((_, i) => <span key={i} className={i <= step ? styles.formProgressActive : ''} />)}</div>
      <div className={styles.formHeading}><span className={styles.formStep}>0{step + 1} / 03</span><h2 ref={focusRef} tabIndex={-1}>{steps[step].title}</h2><p>{steps[step].detail}</p></div>
      <form onSubmit={submit}>
        {step === 0 && <div className={styles.formContent}>
          <fieldset className={styles.fieldset}><legend>How many pricing components do you think you need?</legend>
            <div className={styles.volumeGrid}>{volumes.map(value => <label key={value} className={count === value ? styles.selectedOption : styles.option}><input type="radio" name="componentCount" checked={count === value} onChange={() => setCount(value)} />{value}</label>)}</div>
          </fieldset>
          <label className={styles.fieldLabel} htmlFor="quick-systems">What work do you usually quote? <span>Optional</span></label>
          <textarea id="quick-systems" className={styles.textarea} rows={3} value={systems} onChange={event => setSystems(event.target.value)} placeholder="For example: corrugated metal roofs, flashings and gutters" />
        </div>}
        {step === 1 && <div className={styles.formContent}>
          <label className={styles.fieldLabel} htmlFor="quick-attachments">Your pricing files <span>Optional</span></label>
          <label className={styles.dropzone} htmlFor="quick-attachments"><strong>Choose files or take a photo</strong><small>Supplier price lists, spreadsheets, photos of notes, existing quotes</small><small>Up to 5 files, 4 MB total. PDF, XLSX, CSV, JPG, PNG, WebP or TXT.</small></label>
          <input className={styles.fileInput} id="quick-attachments" type="file" multiple accept=".pdf,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp" onChange={event => {
            const selected = Array.from(event.currentTarget.files || []); setFiles(selected);
            if (selected.length > 5 || selected.reduce((sum, f) => sum + f.size, 0) > 4 * 1024 * 1024) setError('Choose up to five files with a total size under 4 MB.'); else setError('');
          }} />
          <p className={styles.formHint}>Have more or larger files? Describe them below and our team can arrange a secure transfer.</p>
          {files.length > 0 && <p className={styles.fileSummary}>{files.map(f => f.name).join(', ')}</p>}
          <label className={styles.fieldLabel} htmlFor="quick-details">Anything else we should know? <span>Optional</span></label>
          <textarea id="quick-details" className={styles.textarea} rows={4} value={details} onChange={event => setDetails(event.target.value)} placeholder="Where your material costs come from, how you charge labour, or what you'd like us to build" />
        </div>}
        {step === 2 && <div className={styles.formContent}>
          <div className={styles.contactGrid}>
            <div><label className={styles.fieldLabel} htmlFor="quick-name">Your name *</label><input className={styles.input} id="quick-name" autoComplete="name" required value={name} onChange={event => setName(event.target.value)} /></div>
            <div><label className={styles.fieldLabel} htmlFor="quick-email">Email address *</label><input className={styles.input} id="quick-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></div>
          </div>
          <label className={styles.fieldLabel} htmlFor="quick-business">Business name <span>Optional</span></label>
          <input className={styles.input} id="quick-business" autoComplete="organization" value={business} onChange={event => setBusiness(event.target.value)} />
          <label className={styles.consent}><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />I have permission to share these files and understand QuoteCore+ will review them to prepare a setup proposal.</label>
          <p className={styles.formHint}>You can remove customer names or private details before sending. No payment is collected here.</p>
        </div>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.formActions}>
          {step > 0 && <button className={styles.secondary} type="button" disabled={pending} onClick={() => navigate((step - 1) as Stage)}>Back</button>}
          {step < 2 ? <button className={styles.primary} type="button" onClick={() => { if (step === 0 && !count) { setError('Choose an approximate count to continue.'); return; } if (step === 1 && (files.length > 5 || files.reduce((sum, f) => sum + f.size, 0) > 4 * 1024 * 1024)) { setError('Choose up to five files with a total size under 4 MB.'); return; } navigate((step + 1) as Stage); }}>Continue <span aria-hidden="true">→</span></button> : <button className={styles.primary} type="submit" disabled={pending || !consent || !name.trim() || !email.trim()}>{pending ? 'Sending…' : 'Send my enquiry'} <span aria-hidden="true">→</span></button>}
        </div>
      </form>
    </>}
  </div>;
}
