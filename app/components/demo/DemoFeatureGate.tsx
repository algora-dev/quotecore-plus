'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import type { DemoGuideChapter } from '@/app/lib/demo/model';
type Props = { title: string; description: string; chapter: DemoGuideChapter; workspaceSlug: string; href: string; secondaryHref?: string; secondaryLabel?: string; compact?: boolean };
export function DemoFeatureGate({ title, description, chapter, workspaceSlug, secondaryHref, secondaryLabel, compact = false }: Props) {
  const router = useRouter(); const [pending,setPending] = useState(false); const [error,setError] = useState('');
  async function start() { setPending(true); setError('');
    try { const response = await fetch('/api/demo/state',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({action:'chapter',chapter})}); const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not open this chapter.'); router.push(result.href); router.refresh(); window.dispatchEvent(new Event('qc-demo-refresh'));
    } catch(cause) { setError(cause instanceof Error ? cause.message : 'Could not open the chapter.'); } finally { setPending(false); }
  }
  const action = <QcButton variant={compact ? 'secondary' : 'primary'} disabled={pending} onClick={start}>{pending ? 'Opening…' : compact ? title : `Start ${chapter === 'smart-assistant' ? 'Smart Assistant' : 'guided Takeoff'}`}</QcButton>;
  if (compact) return <div>{action}{error && <p role="alert" className="max-w-xs text-xs text-red-700">{error} <a className="underline" href={`/${workspaceSlug}/demo-guide`}>Open guide</a></p>}</div>;
  return <section className="mx-auto max-w-xl p-5 sm:p-10"><div className="rounded-xl border border-orange-200 bg-orange-50 p-6"><p className="text-xs font-bold uppercase tracking-wider text-orange-700">QuoteCore+ demo</p><h1 className="mt-2 text-xl font-semibold">{title}</h1><p className="mt-3 text-sm leading-6 text-slate-600">{description}</p><div className="mt-5 flex flex-wrap gap-3">{action}{secondaryHref && secondaryLabel && <a className="inline-flex items-center rounded-lg border bg-white px-4 py-2 text-sm font-semibold underline" href={secondaryHref} target="_blank" rel="noopener noreferrer">{secondaryLabel}</a>}</div>{error && <p role="alert" className="mt-4 text-sm text-red-700">{error} <a className="underline" href={`/${workspaceSlug}/demo-guide`}>Return to Pricing</a></p>}</div></section>;
}
