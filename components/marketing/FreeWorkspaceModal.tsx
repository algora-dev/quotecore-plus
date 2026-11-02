'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { appUrl } from '@/lib/app-url';
import styles from './FreeWorkspaceModal.module.css';

export const FREE_WORKSPACE_EVENT = 'qc:open-free-workspace';

function callbackUrl(): string {
  const base = appUrl() || window.location.origin;
  const callback = new URL('/auth/callback', base);
  return callback.href;
}

/**
 * Opens the shared Free Workspace modal when one is mounted on the page.
 * Public utility pages do not all mount the marketing shell, so the event is
 * cancelable: a mounted modal prevents the event; otherwise we fail safely to
 * /signup, where the same modal auto-opens.
 */
export function openFreeWorkspaceModal(): boolean {
  if (typeof window === 'undefined') return false;
  const event = new CustomEvent(FREE_WORKSPACE_EVENT, { cancelable: true });
  const unhandled = window.dispatchEvent(event);
  if (unhandled && window.location.pathname !== '/signup') {
    window.location.assign('/signup');
    return false;
  }
  return !unhandled;
}

export function FreeWorkspaceModal() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [sentEmail, setSentEmail] = useState('');
  const [pending, setPending] = useState<'google' | 'email' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  function closeModal() {
    setOpen(false);
    requestAnimationFrame(() => openerRef.current?.focus({ preventScroll: true }));
  }

  useEffect(() => {
    const show = (event: Event) => {
      if (event.cancelable) event.preventDefault();
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
    };
    window.addEventListener(FREE_WORKSPACE_EVENT, show);
    return () => window.removeEventListener(FREE_WORKSPACE_EVENT, show);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
        return;
      }
      if (event.key !== 'Tab' || !modalRef.current) return;
      const focusable = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('hidden'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKey);
    requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function continueGoogle() {
    setError(null);
    setPending('google');
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl() },
    });
    if (authError) {
      setError(authError.message);
      setPending(null);
    }
  }

  async function continueEmail() {
    const clean = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(clean)) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    setPending('email');
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: clean,
      options: { emailRedirectTo: callbackUrl(), shouldCreateUser: true },
    });
    if (authError) {
      setError(authError.message);
      setPending(null);
      return;
    }
    setSentEmail(clean);
    setPending(null);
  }

  if (!open) return null;
  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
      <section ref={modalRef} className={styles.modal} data-qc-theme="dark" role="dialog" aria-modal="true" aria-labelledby="free-workspace-title" aria-describedby="free-workspace-description">
        <div className={styles.head}>
          <img className={styles.logo} src="/marketing/brand/quotecore-logo-white.png" alt="QuoteCore+" />
          <button ref={closeRef} type="button" className={styles.close} onClick={closeModal} aria-label="Close">×</button>
        </div>

        {!sentEmail ? <>
          <div className={styles.content}>
            <h2 id="free-workspace-title">Create a free workspace</h2>
            <p id="free-workspace-description" className={styles.lead}>Instantly access your real QuoteCore+ account. Start using it on your own jobs straight away, for as long as you want.</p>
            <div className={styles.guide}>
              <strong>We recommend the guided walkthrough</strong>
              <span>Learn the basics in 10 to 15 minutes, or skip it and explore everything yourself if you prefer.</span>
            </div>
          </div>
          <div className={styles.auth}>
            <button type="button" className={styles.google} onClick={continueGoogle} disabled={pending !== null}>
              <span className={styles.googleMark}>G</span>{pending === 'google' ? 'Redirecting…' : 'Continue with Google'}
            </button>
            <div className={styles.or}>or</div>
            <div className={styles.emailRow}>
              <input className={styles.email} value={email} onChange={(event) => setEmail(event.target.value)} type="email" inputMode="email" autoComplete="email" placeholder="Enter your email" aria-label="Email address" onKeyDown={(event) => { if (event.key === 'Enter') void continueEmail(); }} />
              <button type="button" className={styles.primary} onClick={continueEmail} disabled={pending !== null}>{pending === 'email' ? 'Sending…' : 'Continue'}</button>
            </div>
          </div>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          <div className={styles.reassure}>
            <span><b className={styles.check}>✓</b> No card needed</span><span className={styles.dot}>•</span><span><b className={styles.check}>✓</b> Upgrade if you want, or keep using it free</span>
          </div>
        </> : <div className={styles.success}>
          <div className={styles.successMark}>✓</div>
          <h3>Nice. Check your inbox.</h3>
          <p>Click the link we sent you to open your new QuoteCore+ workspace.</p>
          <div className={styles.sentEmail}>{sentEmail}</div><br />
          <button type="button" className={styles.back} onClick={() => { setSentEmail(''); setError(null); }}>← Use a different email</button>
        </div>}
      </section>
    </div>
  );
}
