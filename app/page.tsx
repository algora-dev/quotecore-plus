import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
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
        <p className="text-lg text-slate-600 max-w-md">
          Roofing measurement and quoting — built for estimators.
        </p>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 transition hover:border-slate-400"
          >
            Sign up
          </Link>
        </div>
      </main>
    </div>
  );
}
