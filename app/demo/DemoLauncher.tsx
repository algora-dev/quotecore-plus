'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { DemoUnitChoice } from '@/app/components/demo/DemoUnitChoice';
import { createDemoBrowserClient } from '@/app/lib/demo/browser-client';
import { demoSystemLabel, type DemoSystem } from '@/app/lib/demo/presentation';
import { DemoRequestError, demoJsonRequest, demoRequest, safeDemoHref } from '@/app/lib/demo/client-request';
import './demo-launcher.css';

type StartResult = { slug: string; sessionId: string; resumed?: boolean; expiresAt?: string | null; system?: DemoSystem };
type Probe = Partial<StartResult> & { needsSetup?: boolean };
type Screen = 'checking' | 'choose' | 'resume' | 'fresh' | 'building' | 'slow' | 'error';

async function establishIdentity() {
  const demo = createDemoBrowserClient();
  const { data: { user }, error } = await demo.auth.getUser();
  if (user) {
    if (user.is_anonymous !== true) throw new Error('This is not a demo session. Your normal QuoteCore+ account has not been changed.');
    return;
  }
  // A network/server error is not evidence that an existing session is invalid.
  // In particular, never sign a visitor out merely because Supabase is offline.
  if (error && error.name !== 'AuthSessionMissingError' && error.status !== 400 && error.status !== 401 && error.status !== 403) {
    throw new Error('Could not verify your demo session. Check your connection and try again.');
  }
  await demo.auth.signOut({ scope: 'local' });
  const result = await demo.auth.signInAnonymously();
  if (result.error) throw new Error('Could not start an anonymous demo session. Please try again shortly.');
}

export function DemoLauncher() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>('checking');
  const [existing, setExisting] = useState<StartResult | null>(null);
  const [system, setSystem] = useState<DemoSystem | null>(null);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);
  const [checkVersion, setCheckVersion] = useState(0);
  const busy = useRef(false);
  const alive = useRef(false);
  const identity = useRef<Promise<void> | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousScreen = useRef(screen);
  const isReset = useRef(false);

  function acceptProbe(body: Probe) {
    if (body.slug && body.sessionId && safeDemoHref(`/${body.slug}`, body.slug)) {
      setExisting(body as StartResult); setSystem(body.system ?? null); setScreen('resume');
    } else { setExisting(null); setScreen('choose'); }
  }

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    setScreen('checking'); setError('');
    // Reuse the initial auth operation across Strict Mode effect setup/cleanup.
    identity.current ??= establishIdentity().catch(cause => { identity.current = null; throw cause; });
    let timeout: ReturnType<typeof setTimeout>;
    const deadline = new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Checking your demo is taking longer than expected. Please try again.')), 25_000); });
    void Promise.race([identity.current, deadline]).then(async () => {
      if (controller.signal.aborted) return;
      const body = await demoRequest<Probe>('/api/demo/start', { ...demoJsonRequest({ probe: true }), signal: controller.signal });
      if (!controller.signal.aborted) acceptProbe(body);
    }).catch(cause => {
      if (controller.signal.aborted) return;
      if (cause instanceof DemoRequestError && cause.code === 'demo_provisioning') setScreen('slow');
      else { setError(cause instanceof Error ? cause.message : 'Could not open the demo.'); setScreen('error'); }
    }).finally(() => clearTimeout(timeout));
    return () => { alive.current = false; controller.abort(); clearTimeout(timeout); };
  }, [checkVersion]);

  useEffect(() => {
    if (previousScreen.current !== screen) heading.current?.focus({ preventScroll: true });
    previousScreen.current = screen;
  }, [screen]);

  useEffect(() => {
    if (!opening) return;
    const timer = setTimeout(() => {
      setOpening(false);
      setError('Opening your workspace took longer than expected. Your demo has not been reset. Please try Continue again.');
    }, 10_000);
    return () => clearTimeout(timer);
  }, [opening]);

  async function build(reset: boolean) {
    if (busy.current || !system || (reset && !existing)) return;
    busy.current = true; isReset.current = reset; setError(''); setScreen('building');
    try {
      const result = await demoRequest<StartResult>(reset ? '/api/demo/reset' : '/api/demo/start', demoJsonRequest(
        reset ? { sessionId: existing!.sessionId, confirm: 'RESET', system } : { system }
      ), 135_000);
      if (!alive.current) return;
      if (!result.slug || !safeDemoHref(`/${result.slug}`, result.slug)) throw new DemoRequestError('The workspace could not be opened. Please check its status before starting again.', 502);
      if (result.resumed && !reset) {
        // Another tab may have completed provisioning while units were shown.
        // Do not silently replace that workspace or pretend the selection applied.
        setExisting(result); setSystem(result.system ?? null); setScreen('resume');
        setError('A demo is already open in this browser. Continue it, or choose Start fresh to change units.');
      } else { window.location.assign(`/${result.slug}`); }
    } catch (cause) {
      if (!alive.current) return;
      if (cause instanceof DemoRequestError && (cause.code === 'demo_provisioning' || cause.status === 0)) {
        setScreen('slow');
      } else {
        setError(cause instanceof Error ? cause.message : 'Could not prepare the demo.');
        setScreen(reset ? 'fresh' : 'choose');
      }
    } finally { busy.current = false; }
  }

  function continueDemo() {
    if (!existing || opening) return;
    setOpening(true); router.replace(`/${existing.slug}`);
  }
  function fresh() { setSystem(existing?.system ?? null); setError(''); setScreen('fresh'); }
  const title = screen === 'checking' ? 'Opening your demo' : screen === 'building' ? (isReset.current ? 'Preparing a fresh workspace' : 'Preparing your workspace')
    : screen === 'slow' ? 'Your workspace may still be preparing' : screen === 'error' ? 'Let’s try that again'
    : screen === 'resume' ? 'Welcome back' : screen === 'fresh' ? 'Start with a clean workspace' : 'How do you measure?';
  const until = existing?.expiresAt && Number.isFinite(Date.parse(existing.expiresAt))
    ? new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(existing.expiresAt)) : null;

  return <section data-qc-ui="v2" className="qc-demo-launch-card" aria-busy={screen === 'checking' || screen === 'building' || opening}>
    <div className="qc-demo-launch-brand"><img src="/marketing/brand/quotecore-logo-transparent.png" alt="QuoteCore+" width={481} height={119} decoding="async" /><span className="qc-demo-launch-tag">LIVE DEMO</span></div>
    <h1 ref={heading} tabIndex={-1}>{title}</h1>
    {screen === 'checking' || screen === 'building' ? <div className="qc-demo-launch-loading" role="status">
      <span className="qc-demo-launch-spinner" aria-hidden="true" />
      <p>{screen === 'checking' ? 'Checking for your existing workspace…' : 'Setting up fictional jobs, component prices and the prepared roof plan. You don’t need to do anything else.'}</p>
    </div> : screen === 'slow' ? <>
      <p>We haven’t confirmed the result yet. Check its status before trying to create another demo.</p>
      <QcButton className="qc-demo-launch-primary" variant="primary" size="lg" onClick={() => setCheckVersion(v => v + 1)}>Check workspace status</QcButton>
      <p className="qc-demo-launch-footnote">This checks the existing request. It does not reset your work or allowances.</p>
    </> : screen === 'error' ? <>
      <p role="alert" className="qc-demo-launch-error">{error}</p>
      <QcButton className="qc-demo-launch-primary" variant="primary" size="lg" onClick={() => setCheckVersion(v => v + 1)}>Try again</QcButton>
    </> : screen === 'resume' ? <>
      <p>Your fictional QCP workspace is ready where you left it.</p>
      <dl className="qc-demo-launch-summary"><div><dt>Measurements</dt><dd>{demoSystemLabel(existing?.system)}</dd></div>{until && <div><dt>Available until</dt><dd>{until}</dd></div>}</dl>
      <QcButton className="qc-demo-launch-primary" variant="primary" size="lg" pending={opening} onClick={continueDemo}>{opening ? 'Opening your workspace…' : 'Continue my demo'}</QcButton>
      <QcButton className="qc-demo-launch-secondary" variant="ghost" size="lg" disabled={opening} onClick={fresh}>Start fresh or change units</QcButton>
      {error && <p role="status" className="qc-demo-launch-footnote">{error}</p>}
    </> : <>
      <p>{screen === 'fresh' ? 'Your current demo edits will be removed. Choose the measurements for your new workspace.' : 'Choose one system for the whole demo. Your component prices, measurements and example tasks will follow it.'}</p>
      <div className="qc-demo-launch-choice"><DemoUnitChoice value={system} onChange={setSystem} /></div>
      {error && <p role="alert" className="qc-demo-launch-error">{error}</p>}
      <QcButton className="qc-demo-launch-primary" variant="primary" size="lg" disabled={!system} onClick={() => void build(screen === 'fresh')}>{screen === 'fresh' ? 'Replace my demo & start fresh' : 'Open my demo workspace'}</QcButton>
      {screen === 'fresh' ? <>
        <QcButton className="qc-demo-launch-secondary" variant="ghost" size="lg" onClick={() => { setError(''); setScreen('resume'); }}>Keep my current demo</QcButton>
        <p className="qc-demo-launch-footnote">AI and email allowances carry over. Starting fresh does not renew them.</p>
      </> : <p className="qc-demo-launch-footnote">No signup or card. Fictional data. Yours to explore for up to 24 hours.</p>}
    </>}
  </section>;
}
