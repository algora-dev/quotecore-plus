'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { QuoteRow } from '@/app/lib/types';

const TakeoffWorkstation = dynamic(
  () => import('./TakeoffWorkstation').then(mod => ({ default: mod.TakeoffWorkstation })),
  { 
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading canvas...</div>
      </div>
    )
  }
);

interface Props {
  workspaceSlug: string;
  quoteId: string;
}

export function TakeoffPage({ workspaceSlug, quoteId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<QuoteRow | null>(null);
  const [planUrl, setPlanUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`/api/quotes/${quoteId}/takeoff-data`);
        if (!res.ok) {
          router.push(`/${workspaceSlug}/quotes/${quoteId}`);
          return;
        }
        const data = await res.json();
        setQuote(data.quote);
        setPlanUrl(data.planUrl);
      } catch (err) {
        console.error('Failed to load takeoff data:', err);
        router.push(`/${workspaceSlug}/quotes/${quoteId}`);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [quoteId, workspaceSlug, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!quote || !planUrl) {
    return null;
  }

  return (
    <TakeoffWorkstation
      workspaceSlug={workspaceSlug}
      quote={quote}
      planUrl={planUrl}
    />
  );
}
