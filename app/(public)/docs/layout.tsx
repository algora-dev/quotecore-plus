import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { getDocTree, getSearchIndex } from '@/app/lib/docs/tree';
import { DocsSidebar, DocsSidebarMobile } from '@/app/components/docs/DocsSidebar';
import { DocsSearch } from '@/app/components/docs/DocsSearch';

export default function DocsLayout({ children }: { children: ReactNode }) {
  const tree = getDocTree();
  const index = getSearchIndex();

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <Link href="/" prefetch={false} className="flex items-center gap-2">
            {/* next/image instead of raw <img> for the public docs logo so
                Next handles responsive sizing, format negotiation, and the
                lint rule about <img> elements. Width/height match the
                rendered 8 × 8 (32px) target. (Gerald audit L-04.) */}
            <Image src="/logo.png" alt="QuoteCore+" width={140} height={32} className="h-8 w-auto" priority />
            <span className="hidden text-sm font-semibold text-slate-700 sm:inline">Docs</span>
          </Link>
          <div className="hidden flex-1 max-w-md md:block">
            <DocsSearch index={index} />
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-slate-700 hover:text-slate-900">Log in</Link>
            <Link href="/signup" className="rounded-full bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700">
              Sign up
            </Link>
          </div>
        </div>
        {/* Mobile search row */}
        <div className="mx-auto w-full max-w-7xl px-4 pb-3 md:hidden">
          <DocsSearch index={index} />
        </div>
      </header>

      <DocsSidebarMobile tree={tree} />

      <div className="mx-auto w-full max-w-7xl px-4 py-8 lg:flex lg:gap-10 lg:px-6">
        {/* Left sidebar - sticky on desktop */}
        <aside className="hidden lg:block lg:w-64 lg:flex-shrink-0">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-auto pr-2">
            <DocsSidebar tree={tree} />
          </div>
        </aside>

        {/* Main + right TOC */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 text-center text-xs text-slate-500 lg:px-6">
          <p>QuoteCore+ - quoting and job management for trade businesses.</p>
        </div>
      </footer>
    </div>
  );
}
