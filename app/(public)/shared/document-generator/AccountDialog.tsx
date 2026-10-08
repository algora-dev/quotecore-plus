'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, Disclosure, Field } from './ui';
import { Icon } from './Icon';
import { TIER_LIMITS, type AuthIntent, type DocumentAccount, type DocumentAuthServices, type PreparedAuth } from './document-account';
import s from './DocumentGenerator.module.css';
function GoogleMark(){return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/></svg>;}
export function AccountDialog({intent,account,auth,onClose,prepare,onVerified}: {
  intent:AuthIntent;account:DocumentAccount;auth:DocumentAuthServices;onClose:()=>void;
  prepare:(consent:boolean,email:string|null)=>PreparedAuth;onVerified:()=>void;
}) {
  const [email,setEmail]=useState(account.email||''),[password,setPassword]=useState(''),[consent,setConsent]=useState(false);
  const [stage,setStage]=useState<'start'|'email'|'google'>('start'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [resendAt,setResendAt]=useState(0),[clock,setClock]=useState(Date.now()),[backupWarning,setBackupWarning]=useState(false);
  const lock=useRef(false),alive=useRef(true),pendingEmail=useRef('');
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{if(stage!=='email')return;const id=window.setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(id);},[stage]);
  const remaining=Math.max(0,Math.ceil((resendAt-clock)/1000));
  async function run(action:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');setMessage('');try{await action();}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Something went wrong. Your quote has not changed.');}finally{lock.current=false;if(alive.current)setBusy(false);}}
  function ready(email:string|null){const result=prepare(consent,email);setBackupWarning(!result.backupAvailable);return result.redirectTo;}
  async function sendEmail(){await run(async()=>{const value=email.trim();await auth.email(value,ready(value.toLowerCase()));pendingEmail.current=value;if(alive.current){setStage('email');setResendAt(Date.now()+60000);setClock(Date.now());}});}
  async function google(){await run(async()=>{await auth.google(ready(null));if(alive.current&&auth.preview)setStage('google');});}
  async function check(){await run(async()=>{const confirmed=await account.refresh();if(confirmed)onVerified();else setMessage('We have not received a confirmed sign-in yet. Open the latest email link, then return here.');});}
  async function simulate(){await run(async()=>{await auth.simulateVerification?.();});}
  const title=stage==='email'?'Check your inbox.':stage==='google'?'Preview Google sign-in.':intent==='signin'?'Good to see you again.':'Your branding. Your quote.';
  return <Dialog title={title} eyebrow={auth.preview?'FREE TOOLS ACCOUNT · PREVIEW':'FREE TOOLS ACCOUNT'} onClose={onClose} tone="focus">
    {stage==='start'?<>
      <p className={s.dialogIntro}>{intent==='signin'?'Sign in to use your free-tool allowance and remove QuoteCore+ branding.':'Create a free account. Keep your quote, remove our branding and get more free-tool uses.'}</p>
      <div className={s.accountBenefits}><span><Icon name="check"/><strong>No branding</strong><small>Just your business</small></span><span><strong>{TIER_LIMITS[2].docPerDay}</strong><small>documents / day</small></span><span><strong>{TIER_LIMITS[2].aiPerDay}</strong><small>AI drafts / day</small></span></div>
      <Button className={s.googleButton} onClick={()=>void google()} disabled={busy}><GoogleMark/>Continue with Google</Button>
      <div className={s.orLine}><span/>or use your email<span/></div>
      <form onSubmit={e=>{e.preventDefault();void sendEmail();}}>
        <Field id="account-email" label="Your email address" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@yourbusiness.com" disabled={busy}/>
        <label className={`${s.checkbox} ${s.marketingConsent}`}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} disabled={busy}/><span>Email me QuoteCore+ tips and product updates.<small>Optional. Unsubscribe anytime. Not required for a free account.</small></span></label>
        <Button className={s.fullButton} type="submit" variant="primary" icon="message" pending={busy}>Email me a verification link</Button>
        <p className={s.authFine}>No password or payment card needed. Confirm your email to activate the benefits.</p>
      </form>
      {intent==='signin'&&<Disclosure title="Already use a password?" subtitle="Sign in with your existing details"><form onSubmit={e=>{e.preventDefault();void run(async()=>{ready(null);await auth.password(email,password);const verified=await account.refresh();if(verified)onVerified();else setMessage('Please confirm your email to activate your free-tool benefits.');});}}><Field label="Email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/><Field label="Password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/><Button type="submit" variant="primary" pending={busy}>Sign in</Button></form></Disclosure>}
      <p className={s.authSeparate}><Icon name="shield"/>This is a free tools account. The full QuoteCore+ app is a separate paid product.</p>
      <p className={s.authTerms}>By continuing, you agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</p>
    </>:stage==='email'?<>
      <div className={s.emailIllustration}><Icon name="message"/><Icon name="check"/></div>
      <p className={s.emailDestination}>{auth.preview?'Simulated verification email for:':'We sent a sign-in link to:'}<strong>{pendingEmail.current||email}</strong></p>
      <p className={s.dialogIntro}>Open the link to confirm your email, then return to your quote. The branding stays until your account is verified.</p>
      {auth.preview&&<div className={s.notice}><Icon name="shield"/><div><strong>No email has been sent.</strong><p>This offline preview never contacts Google or an email service. Use the button below to test the verified-account state.</p></div></div>}
      <div className={s.authActions}>{auth.preview?<Button variant="primary" icon="check" pending={busy} onClick={()=>void simulate()}>Simulate email verification</Button>:<Button variant="primary" icon="check" pending={busy} onClick={()=>void check()}>I’ve verified my email</Button>}
        <Button disabled={busy||remaining>0} onClick={()=>void sendEmail()}>{remaining>0?`Resend in ${remaining}s`:'Resend email'}</Button></div>
      <button type="button" className={s.textButton} disabled={busy} onClick={()=>{setStage('start');setError('');setMessage('');}}>Use a different email</button>
    </>:<>
      <div className={s.emailIllustration}><GoogleMark/></div><p className={s.dialogIntro}>On the live site, Google confirms your identity and returns you to this quote. No Google connection is made in this offline preview.</p>
      <Button variant="primary" icon="check" pending={busy} onClick={()=>void simulate()}>Simulate Google sign-in</Button>
    </>}
    {backupWarning?<p className={s.errorBox}>Your browser could not save a sign-in backup. Keep this tab open and return here after verification; a new tab may not contain your quote.</p>:<p className={s.authStorage}><Icon name="lock"/>Your quote stays on this device. When you continue, a local sign-in backup expires after one hour and is cleared after verification.</p>}
    {error&&<p className={s.errorBox} role="alert">{error}</p>}{message&&<p className={s.notice} role="status">{message}</p>}
  </Dialog>;
}
