import Link from 'next/link';
import Image from 'next/image';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import MarketingHome from './(marketing)/home/page';
import { hreflangLanguages } from '@/lib/seo/hreflang';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const isMarketingDomain =
    host === 'quote-core.com' ||
    host === 'www.quote-core.com' ||
    host === 'www.quote-core.co.nz' ||
    host === 'quote-core.co.nz';

  if (isMarketingDomain) {
    return {
      alternates: {
        canonical: 'https://quote-core.com/',
        languages: hreflangLanguages('/'),
      },
    };
  }

  return {};
}

export default async function Home() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const isMarketingDomain =
    host === 'quote-core.com' ||
    host === 'www.quote-core.com' ||
    host === 'www.quote-core.co.nz' ||
    host === 'quote-core.co.nz';

  if (isMarketingDomain) {
    return <MarketingHome />;
  }

  // App landing page (app.quote-core.com)
  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-screen bg-slate-50">
      <main className="flex flex-col items-center gap-8 py-20 px-6 text-center">
        <Image 
          src="/logo.png" 
          alt="QuoteCore+" 
          width={320} 
          height={80} 
          priority
          className="h-16 w-auto"
        />
        <p className="text-lg text-slate-600 max-w-xl">
          Measure, quote, order, track, invoice, store, all in 1 place
        </p>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 transition-all hover:border-slate-400 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
          >
            Sign up
          </Link>
        </div>
        <Link
          href="/docs"
          className="text-xs font-semibold uppercase tracking-wide text-slate-500 transition-all hover:text-[#ff6b35] hover:[text-shadow:0_0_8px_rgba(255,107,53,0.6)]"
        >
          Read the docs
        </Link>
      </main>
    </div>
  );
}
