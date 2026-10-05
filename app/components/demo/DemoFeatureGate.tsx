'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QcButton, QcLinkButton } from '@/app/components/ui/v2/QcButton';
import { canEnterChapter, DEMO_GUIDE_CHAPTERS } from '@/app/lib/demo/guide';
import { readGuide, type DemoGuideChapter, type DemoGuideState } from '@/app/lib/demo/model';
import { demoJsonRequest, demoRequest, safeDemoHref } from '@/app/lib/demo/client-request';
import type { GuideReply } from './useDemoSession';

type Props = { title: string; description: string; chapter: DemoGuideChapter; workspaceSlug: string; href: string; secondaryHref?: string; secondaryLabel?: string; compact?: boolean };

export function DemoFeatureGate({ title, description, chapter, workspaceSlug, secondaryHref, secondaryLabel, compact = false }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false); const [error, setError] = useState('');
  const [state, setState] = useState<DemoGuideState | null>(null);
  const busy = useRef(false); const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void demoRequest<{ tutorialState: DemoGuideState }>('/api/demo/state', { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setState(readGuide(result.tutorialState)); })
      .catch(() => { /* The start action rechecks; network failure never unlocks anything. */ });
    return () => { mounted.current = false; controller.abort(); };
  }, []);
  const ready = !!state && canEnterChapter(state, chapter);
  // Offer the reachable prerequisite, not an attractive button that inevitably
  // fails with a permission/prerequisite error after the visitor clicks it.
  const firstAvailable = state && canEnterChapter(state, 'customer-quote') ? 'customer-quote'
    : state && canEnterChapter(state, 'takeoff') ? 'takeoff' : 'pricing';
  const destinationChapter: DemoGuideChapter = ready ? chapter : firstAvailable;
  const destinationTitle = DEMO_GUIDE_CHAPTERS.find(item => item.id === destinationChapter)?.title ?? 'Build your pricing';
  async function start() {
    if (busy.current) return; busy.current = true; setPending(true); setError('');
    try {
      // The initial read may still be in flight or may have failed. Re-read
      // before choosing a prerequisite; never guess a visitor back to Pricing.
      const current = readGuide((await demoRequest<{ tutorialState: DemoGuideState }>('/api/demo/state')).tutorialState);
      if (!mounted.current) return;
      setState(current);
      const target = canEnterChapter(current, chapter) ? chapter : canEnterChapter(current, 'customer-quote') ? 'customer-quote' : canEnterChapter(current, 'takeoff') ? 'takeoff' : 'pricing';
      const result = await demoRequest<GuideReply>('/api/demo/state', { ...demoJsonRequest({ action: 'chapter', chapter: target }), method: 'PATCH' }, 30_000);
      if (!mounted.current) return;
      if (!safeDemoHref(result.href, workspaceSlug)) throw new Error('Could not verify the guide destination.');
      router.push(result.href); router.refresh(); window.dispatchEvent(new Event('qc-demo-refresh'));
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Could not open the guide. Please try again.'); }
    finally { busy.current = false; if (mounted.current) setPending(false); }
  }
  const label = !state ? 'Continue guided demo' : ready ? `Start ${chapter === 'smart-assistant' ? 'Smart Assistant' : 'Digital Takeoff'} demo` : `Continue: ${destinationTitle}`;
  if (compact) return <div data-qc-ui="v2"><QcButton variant="secondary" pending={pending} onClick={() => void start()}>{label}</QcButton>{error && <p role="alert" className="mt-2 max-w-xs text-xs text-[var(--qc-color-danger)]">{error}</p>}</div>;
  return <section data-qc-ui="v2" className="mx-auto max-w-xl p-5 sm:p-10"><div className="rounded-2xl border border-[var(--qc-border-divider)] bg-[var(--qc-bg-surface)] p-6 shadow-sm">
    <p className="text-xs font-bold uppercase tracking-wider text-[var(--qc-color-orange-ink)]">PART OF YOUR GUIDED DEMO</p><h1 className="mt-2 text-xl font-semibold text-[var(--qc-text-primary)]">{title}</h1><p className="mt-3 text-sm leading-6 text-[var(--qc-text-secondary)]">{description}</p>
    {state && !ready && <p className="mt-3 text-sm leading-6 text-[var(--qc-text-secondary)]">First, continue <strong>{destinationTitle}</strong>. The guide will bring you back with the records this task needs.</p>}
    <div className="mt-5 grid gap-2"><QcButton variant="primary" size="lg" pending={pending} onClick={() => void start()}>{pending ? 'Opening the guide…' : label}</QcButton>{secondaryHref && secondaryLabel && <QcLinkButton variant="ghost" size="lg" href={secondaryHref} target="_blank" rel="noopener noreferrer">{secondaryLabel}</QcLinkButton>}<QcLinkButton variant="ghost" href={`/${workspaceSlug}/demo-guide`}>View all chapters</QcLinkButton></div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-[var(--qc-color-danger-bg)] p-3 text-sm text-[var(--qc-color-danger)]">{error}</p>}
  </div></section>;
}
