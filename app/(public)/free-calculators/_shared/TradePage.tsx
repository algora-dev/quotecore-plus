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

      {/* Related Free tools */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold text-slate-900">Related Free tools</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/free-quote-generator"
            prefetch={false}
            className="block w-full text-left p-5 bg-white border-2 border-slate-200 rounded-xl hover:border-[#FF6B35] hover:shadow-lg transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-orange-50 group-hover:bg-orange-100 transition-colors">
                <svg className="w-5 h-5 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">Free Quote Generator</p>
                <p className="text-xs text-slate-500 mt-0.5">Turn your measurements into a professional quote</p>
              </div>
            </div>
          </Link>

          <Link
            href="/free-purchase-order-generator"
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
                <p className="font-semibold text-slate-900 text-sm">Free Purchase Order Generator</p>
                <p className="text-xs text-slate-500 mt-0.5">Create supplier order forms from your calculations</p>
              </div>
            </div>
          </Link>

          <Link
            href="/free-invoice-generator"
            prefetch={false}
            className="block w-full text-left p-5 bg-white border-2 border-slate-200 rounded-xl hover:border-[#FF6B35] hover:shadow-lg transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-orange-50 group-hover:bg-orange-100 transition-colors">
                <svg className="w-5 h-5 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">Free Invoice Generator</p>
                <p className="text-xs text-slate-500 mt-0.5">Send professional invoices and get paid faster</p>
              </div>
            </div>
          </Link>

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

      {/* Worked example */}
      {c.workedExample && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold text-slate-900">{c.workedExample.title}</h2>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
            <ol className="space-y-2">
              {c.workedExample.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-xs font-bold text-[#FF6B35]">
                    {i + 1}
                  </span>
                  <span className="text-sm text-slate-600 leading-relaxed pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* Assumptions & limitations */}
      {c.assumptions && c.assumptions.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold text-slate-900">Assumptions & limitations</h2>
          <ul className="mt-4 space-y-2">
            {c.assumptions.map((a, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-600">
                <svg className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                </svg>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* When to ask a professional */}
      {c.whenToAskPro && (
        <section className="mt-8">
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-amber-900">When to ask a professional</h3>
                <p className="mt-1 text-sm text-amber-800 leading-relaxed">{c.whenToAskPro}</p>
              </div>
            </div>
          </div>
        </section>
      )}

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
