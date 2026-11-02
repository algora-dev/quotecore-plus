'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { doneForYouConfig } from '@/components/marketing/home/done-for-you-config';
import { trackEvent } from '@/lib/analytics';
import styles from './DoneForYouInquiryModal.module.css';

export const DFY_INQUIRY_EVENT = 'qc:open-dfy-inquiry';

type View = 'choice' | 'form' | 'success';
type Handover = 'live' | 'recorded' | 'either' | 'unsure';

type FormState = {
  measurementMethods: string[];
  measurementOther: string;
  pricingSources: string[];
  pricingOther: string;
  quoteVolume: string;
  componentCount: string;
  handover: Handover | '';
  notes: string;
  name: string;
  email: string;
  businessName: string;
  website: string;
};

const initialForm: FormState = {
  measurementMethods: [], measurementOther: '', pricingSources: [], pricingOther: '',
  quoteVolume: '', componentCount: '', handover: '', notes: '', name: '', email: '', businessName: '', website: '',
};

const measurementOptions = [
  ['on-site', 'Measure on site'],
  ['printed-plans', 'Print plans and measure manually'],
  ['digital-plans', 'Measure digitally from PDFs or plans'],
  ['aerial', 'Use satellite or aerial measurements'],
  ['supplied', 'Measurements are supplied to us'],
  ['varies', 'It varies by job'],
  ['other', 'Something else'],
] as const;

const pricingOptions = [
  ['spreadsheet', 'Spreadsheet'],
  ['supplier-lists', 'Supplier price lists or PDFs'],
  ['estimating-app', 'Another quoting or estimating app'],
  ['business-software', 'Job management or accounting software'],
  ['notes', 'Written price book or notes'],
  ['memory', 'Mostly in my head'],
  ['other', 'Something else'],
] as const;

const quoteVolumes = ['Up to 10', '11–30', '31–100', '100+'] as const;
const componentCounts = ['Up to 10', '11–20', '21–50', '51–100', '100+'] as const;
const handoverOptions: Array<[Handover, string, string]> = [
  ['live', 'Live one-to-one', 'Work through your configured account with Shaun using one of your jobs.'],
  ['recorded', 'Personalised recorded walkthrough', 'Shaun records a custom walkthrough you can watch whenever it suits you.'],
  ['either', 'Either works for me', 'Choose whichever makes the most sense once the setup is scoped.'],
  ['unsure', 'Not sure yet', 'No problem. Shaun can recommend the best handover after reviewing your enquiry.'],
];

export function openDoneForYouInquiry(): boolean {
  if (typeof window === 'undefined') return false;
  const event = new CustomEvent(DFY_INQUIRY_EVENT, { cancelable: true });
  return !window.dispatchEvent(event);
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function Chevron() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" /></svg>;
}

function Check() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.2 4.2L19 7" /></svg>;
}

export function DoneForYouInquiryModal() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('choice');
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const bookingHref = doneForYouConfig.bookingHref || '/contact';
  const progress = ((step + 1) / 6) * 100;

  const canContinue = useMemo(() => {
    if (step === 0) return form.measurementMethods.length > 0 && (!form.measurementMethods.includes('other') || form.measurementOther.trim().length > 0);
    if (step === 1) return form.pricingSources.length > 0 && (!form.pricingSources.includes('other') || form.pricingOther.trim().length > 0);
    if (step === 2) return Boolean(form.quoteVolume);
    if (step === 3) return Boolean(form.componentCount);
    if (step === 4) return Boolean(form.handover);
    return Boolean(form.name.trim() && /^\S+@\S+\.\S+$/.test(form.email.trim()));
  }, [form, step]);

  function closeModal() {
    setOpen(false);
    requestAnimationFrame(() => openerRef.current?.focus({ preventScroll: true }));
  }

  useEffect(() => {
    const show = (event: Event) => {
      if (event.cancelable) event.preventDefault();
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
      setError(null);
    };
    window.addEventListener(DFY_INQUIRY_EVENT, show);
    const params = new URLSearchParams(window.location.search);
    if (params.get('inquire') === '1') {
      requestAnimationFrame(() => {
        openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setOpen(true);
        setError(null);
      });
    }
    return () => window.removeEventListener(DFY_INQUIRY_EVENT, show);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeModal(); return; }
      if (event.key !== 'Tab' || !modalRef.current) return;
      const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href], summary, [tabindex]:not([tabindex="-1"])')).filter((el) => !el.hasAttribute('hidden'));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    requestAnimationFrame(() => closeRef.current?.focus());
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey); };
  }, [open]);

  function chooseForm() {
    setView('form');
    setStep(0);
    setError(null);
    trackEvent('dfy_inquiry_path_select', { path: 'form' });
  }

  function bookCall() {
    trackEvent('dfy_inquiry_path_select', { path: 'call' });
    window.location.assign(bookingHref);
  }

  function nextStep() {
    if (!canContinue) return;
    setError(null);
    setStep((value) => Math.min(5, value + 1));
  }

  async function submit() {
    if (!canContinue || pending) return;
    setPending(true); setError(null);
    try {
      const response = await fetch('/api/done-for-you-inquiry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Could not send your enquiry. Please try again.');
      setView('success');
      trackEvent('dfy_inquiry_submit', { quoteVolume: form.quoteVolume, componentCount: form.componentCount, handover: form.handover });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your enquiry. Please try again.');
    } finally { setPending(false); }
  }

  if (!open) return null;

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
      <section ref={modalRef} className={styles.modal} data-qc-theme="dark" role="dialog" aria-modal="true" aria-labelledby="dfy-inquiry-title">
        <header className={styles.head}>
          <img className={styles.logo} src="/marketing/brand/quotecore-logo-white.png" alt="QuoteCore+" />
          <button ref={closeRef} type="button" className={styles.close} onClick={closeModal} aria-label="Close">×</button>
        </header>

        {view === 'choice' ? <div className={styles.choiceView}>
          <div className={styles.intro}>
            <p className={styles.eyebrow}>Done For You</p>
            <h2 id="dfy-inquiry-title">How would you like to get started?</h2>
            <p>Choose the easiest option. Either way, Shaun will use what you tell him to work out the likely setup, QuoteCore+ features and next steps.</p>
          </div>
          <div className={styles.pathGrid}>
            <article className={`${styles.pathCard} ${styles.callCard}`}>
              <div className={styles.pathIcon}>01</div>
              <div><h3>Talk it through with Shaun</h3><ul className={styles.pathList}><li>25-minute discovery call.</li><li>Tell Shaun how you work and what you would like to improve.</li><li>See a tailored demo, or simply talk through how QuoteCore+ could make it faster and easier.</li><li>Get Shaun's #1 tip for winning more of the jobs you already quote.</li></ul></div>
              <button type="button" className={styles.primary} onClick={bookCall}>Book 25 minutes with Shaun <Chevron /></button>
            </article>
            <article className={styles.pathCard}>
              <div className={styles.pathIcon}>02</div>
              <div><h3>Prefer to inquire without calling?</h3><ul className={styles.pathList}><li>Answer a few quick questions in around 60 seconds.</li><li>Tell us how you work, your quote volume and roughly how much pricing needs configuring.</li><li>Shaun reviews it and emails you a tailored setup recommendation and indicative price or range.</li><li>You'll also get Shaun's #1 tip for winning more of the jobs you already quote.</li></ul></div>
              <button type="button" className={styles.secondary} onClick={chooseForm}>Inquire without calling <Chevron /></button>
            </article>
          </div>
        </div> : null}

        {view === 'form' ? <div className={styles.formView}>
          <div className={styles.progressHead}>
            <button type="button" className={styles.backLink} onClick={() => { if (step === 0) setView('choice'); else setStep((value) => value - 1); }}>← Back</button>
            <span>Step {step + 1} of 6</span>
          </div>
          <div className={styles.progressTrack}><span style={{ width: `${progress}%` }} /></div>

          {step === 0 ? <section className={styles.step} aria-labelledby="dfy-inquiry-title">
            <p className={styles.eyebrow}>How you work</p><h2 id="dfy-inquiry-title">How do you usually get the measurements for a job?</h2>
            <p className={styles.stepLead}>Select everything that applies.</p>
            <div className={styles.optionGrid}>{measurementOptions.map(([value, label]) => <button key={value} type="button" aria-pressed={form.measurementMethods.includes(value)} className={styles.option} onClick={() => setForm((current) => ({ ...current, measurementMethods: toggleValue(current.measurementMethods, value) }))}><span>{label}</span><b>{form.measurementMethods.includes(value) ? <Check /> : null}</b></button>)}</div>
            {form.measurementMethods.includes('other') ? <textarea className={styles.textarea} rows={3} value={form.measurementOther} onChange={(event) => setForm((current) => ({ ...current, measurementOther: event.target.value }))} placeholder="Tell Shaun how you measure jobs…" /> : null}
          </section> : null}

          {step === 1 ? <section className={styles.step} aria-labelledby="dfy-inquiry-title">
            <p className={styles.eyebrow}>Your pricing</p><h2 id="dfy-inquiry-title">Where does your pricing live today?</h2>
            <p className={styles.stepLead}>Select everything you currently use.</p>
            <div className={styles.optionGrid}>{pricingOptions.map(([value, label]) => <button key={value} type="button" aria-pressed={form.pricingSources.includes(value)} className={styles.option} onClick={() => setForm((current) => ({ ...current, pricingSources: toggleValue(current.pricingSources, value) }))}><span>{label}</span><b>{form.pricingSources.includes(value) ? <Check /> : null}</b></button>)}</div>
            {form.pricingSources.includes('other') ? <textarea className={styles.textarea} rows={3} value={form.pricingOther} onChange={(event) => setForm((current) => ({ ...current, pricingOther: event.target.value }))} placeholder="Tell Shaun where the rest of your pricing is kept…" /> : null}
          </section> : null}

          {step === 2 ? <section className={styles.step} aria-labelledby="dfy-inquiry-title">
            <p className={styles.eyebrow}>Quote volume</p><h2 id="dfy-inquiry-title">How many quotes do you usually send each week?</h2>
            <p className={styles.stepLead}>Roughly is fine. This helps us estimate the QuoteCore+ usage and capacity you are likely to need.</p>
            <div className={styles.segmentGrid}>{quoteVolumes.map((value) => <button key={value} type="button" aria-pressed={form.quoteVolume === value} className={styles.segment} onClick={() => setForm((current) => ({ ...current, quoteVolume: value }))}>{value}</button>)}</div>
          </section> : null}

          {step === 3 ? <section className={styles.step} aria-labelledby="dfy-inquiry-title">
            <p className={styles.eyebrow}>Setup size</p><h2 id="dfy-inquiry-title">How many different pricing elements do you currently use?</h2>
            <p className={styles.stepLead}>Your best estimate is enough. This helps Shaun estimate how much pricing and configuration work is involved.</p>
            <div className={styles.segmentGrid}>{componentCounts.map((value) => <button key={value} type="button" aria-pressed={form.componentCount === value} className={styles.segment} onClick={() => setForm((current) => ({ ...current, componentCount: value }))}>{value}</button>)}</div>
            <details className={styles.explainer}><summary>What counts as one pricing element?</summary><p>A pricing element is one distinct product, rate, or reusable price you currently use when quoting. It could be underlay, valleys, hips, fixings, roof coverings or labour. It could also be one combined square-area rate that already covers several of those things. If one rate bundles material, labour, waste or other rules, count that as one element. We only need a rough total of the different elements you would want configured in QuoteCore+.</p></details>
          </section> : null}

          {step === 4 ? <section className={styles.step} aria-labelledby="dfy-inquiry-title">
            <p className={styles.eyebrow}>Handover</p><h2 id="dfy-inquiry-title">How would you prefer Shaun to show you your finished setup?</h2>
            <div className={styles.handoverGrid}>{handoverOptions.map(([value, title, body]) => <button key={value} type="button" aria-pressed={form.handover === value} className={styles.handoverOption} onClick={() => setForm((current) => ({ ...current, handover: value }))}><span><strong>{title}</strong><small>{body}</small></span><b>{form.handover === value ? <Check /> : null}</b></button>)}</div>
            <label className={styles.label}>Anything else Shaun should know? <span>Optional</span><textarea className={styles.textarea} rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Anything unusual about your workflow, pricing or team…" /></label>
          </section> : null}

          {step === 5 ? <section className={styles.step} aria-labelledby="dfy-inquiry-title">
            <p className={styles.eyebrow}>Your proposal</p><h2 id="dfy-inquiry-title">Where should Shaun send it?</h2>
            <p className={styles.stepLead}>He’ll review your answers and email you with the likely setup, recommended QuoteCore+ features, an indicative price or range, and any next steps.</p>
            <div className={styles.contactGrid}>
              <label className={styles.label}>Your name<input className={styles.input} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} autoComplete="name" /></label>
              <label className={styles.label}>Email address<input className={styles.input} type="email" inputMode="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} autoComplete="email" /></label>
              <label className={styles.label}>Business name <span>Optional</span><input className={styles.input} value={form.businessName} onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))} autoComplete="organization" /></label>
              <label className={styles.label}>Website <span>Optional</span><input className={styles.input} value={form.website} onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))} inputMode="url" placeholder="yourcompany.com" /></label>
            </div>
            <p className={styles.privacy}>We’ll only use these details to respond to your Done For You enquiry.</p>
          </section> : null}

          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          <footer className={styles.formFooter}>
            <span>{step < 5 ? 'Most people finish in around 60 seconds.' : 'No payment or commitment required.'}</span>
            {step < 5 ? <button type="button" className={styles.primary} disabled={!canContinue} onClick={nextStep}>Continue <Chevron /></button> : <button type="button" className={styles.primary} disabled={!canContinue || pending} onClick={() => void submit()}>{pending ? 'Sending…' : 'Send my enquiry'} {!pending ? <Chevron /> : null}</button>}
          </footer>
        </div> : null}

        {view === 'success' ? <div className={styles.successView}>
          <div className={styles.successMark}><Check /></div>
          <p className={styles.eyebrow}>Enquiry sent</p>
          <h2 id="dfy-inquiry-title">Thanks, {form.name.split(' ')[0] || 'we have it'}.</h2>
          <p>Shaun will review your answers and email you with the likely setup, recommended QuoteCore+ features, an indicative price or range, any next steps, and his #1 tip for winning more of the jobs you already quote. If he needs one missing detail, he can ask by email.</p>
          <div className={styles.successEmail}>{form.email}</div>
          <button type="button" className={styles.secondary} onClick={closeModal}>Close</button>
        </div> : null}
      </section>
    </div>
  );
}
