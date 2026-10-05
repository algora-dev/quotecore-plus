'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { DemoGuideChapter } from '@/app/lib/demo/model';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { demoJsonRequest, demoRequest, safeDemoHref } from '@/app/lib/demo/client-request';
import type { GuideReply } from './useDemoSession';

export function DemoChapterButton({ chapter, disabled = false, completed = false, primary = false, workspaceSlug }: { chapter: DemoGuideChapter; disabled?: boolean; completed?: boolean; primary?: boolean; workspaceSlug: string }) {
  const router = useRouter(); const [error, setError] = useState(''); const [pending, setPending] = useState(false);
  const busy = useRef(false); const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function start() {
    if (disabled || busy.current) return; busy.current = true; setPending(true); setError('');
    try {
      const result = await demoRequest<GuideReply>('/api/demo/state', { ...demoJsonRequest({ action: 'chapter', chapter }), method: 'PATCH' }, 30_000);
      if (!mounted.current) return;
      if (!safeDemoHref(result.href, workspaceSlug)) throw new Error('Could not verify the guide destination.');
      router.push(result.href); router.refresh(); window.dispatchEvent(new Event('qc-demo-refresh'));
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Could not open chapter. Please retry.'); }
    finally { busy.current = false; if (mounted.current) setPending(false); }
  }
  if (disabled) return <p className="text-xs leading-5 text-[var(--qc-text-secondary)]">Complete the required lesson in the preceding chapter to unlock this one.</p>;
  return <><QcButton variant={primary ? 'primary' : completed ? 'ghost' : 'secondary'} pending={pending} onClick={() => void start()}>{pending ? 'Opening…' : completed ? 'Revisit chapter' : primary ? 'Continue here' : 'Open chapter'}</QcButton>{error && <p role="alert" className="mt-3 text-sm text-[var(--qc-color-danger)]">{error}</p>}</>;
}
