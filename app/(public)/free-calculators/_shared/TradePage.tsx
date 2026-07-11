import Link from 'next/link';
import type { TradeConfig } from './types';
import { signupHref } from './types';
import { TradeCalculator } from './TradeCalculator';

/**
 * Shared page body for every trade calculator: hero, calculator, related
 * links, tips, formula reference, FAQ. All copy comes from the config so
 * each trade page stays genuinely unique for SEO.
 */
export function TradePage({ config }: { config: TradeConfig }) {
  const c = config.content;
  const signup = signupHref(config);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-6">
      {/* Hero */}
      <section className="mb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{c.h1}</h1>
            <p className="mt-2 text-sm text-slate-500 max-w-xl">{c.heroText}</p>
          </div>
        </div>
      </section>

      {/* Calculator */}
      <TradeCalculator config={config} />

      {/* Related tools */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold text-slate-900">Related calculators</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {c.related.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              className="block w-full text-left p-5 bg-white border-2 border-slate-200 rounded-xl hover:border-[#FF6B35] hover:shadow-lg transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-orange-50 group-hover:bg-orange-100 transition-colors">
                  <svg className="w-5 h-5 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{link.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{link.desc}</p>
                </div>
              </div>
            </Link>
          ))}

          <Link
            href={signup}
            className="block w-full text-left p-5 bg-white border-2 border-slate-200 rounded-xl hover:border-[#FF6B35] hover:shadow-lg transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-orange-50 group-hover:bg-orange-100 transition-colors">
                <svg className="w-5 h-5 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">Start free trial</p>
                <p className="text-xs text-slate-500 mt-0.5">Full quoting, takeoff, and job management</p>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Tips & Knowledge */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold text-slate-900">{c.tipsHeading}</h2>
        <div className="mt-4 space-y-4">
          {c.tips.map((tip) => (
            <Tip key={tip.title} title={tip.title} body={tip.body} />
          ))}
        </div>
      </section>

      {/* Formula reference */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold text-slate-900">Formulas used</h2>
        <div className="mt-4 space-y-2">
          {c.formulas.map((f) => (
            <Formula key={f.name} name={f.name} formula={f.formula} />
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-12 mb-8">
        <h2 className="text-lg font-semibold text-slate-900">Frequently asked questions</h2>
        <div className="mt-4 space-y-4">
          {c.faqs.map((f) => (
            <FAQ key={f.q} question={f.q} answer={f.a} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Tip({ title, body }: { title: string; body: string }) {
  return (
    <details className="rounded-xl border border-slate-200 bg-white">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 hover:text-[#FF6B35] transition select-none">
        {title}
      </summary>
      <div className="px-4 pb-4">
        <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
      </div>
    </details>
  );
}

function Formula({ name, formula }: { name: string; formula: string }) {
  return (
    <details className="rounded-lg border border-slate-200 bg-white">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-700 hover:text-[#FF6B35] transition select-none">
        {name}
      </summary>
      <div className="px-4 pb-3">
        <p className="text-xs text-slate-600 font-mono">{formula}</p>
      </div>
    </details>
  );
}

function FAQ({ question, answer }: { question: string; answer: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700">{question}</h3>
      <p className="mt-1 text-sm text-slate-600">{answer}</p>
    </div>
  );
}
