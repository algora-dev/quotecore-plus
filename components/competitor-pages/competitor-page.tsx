import type { ReactNode } from "react";
import type { CompetitorPageData, ComparisonRow, SupportStatus, SectionKey } from "@/lib/competitor-pages/types";
import { STATUS_LABEL } from "@/lib/competitor-pages/types";
import { TrackedCta } from "./tracked-cta";
import CompetitorVideo from "./competitor-video";
import PricingViewTracker from "./pricing-tracker";
import { VIDEOS } from "@/lib/videos";

/**
 * Shared server layout for competitor alternative pages.
 * Uniform design system (white/zinc surfaces, orange accents, black
 * rounded-full CTAs, rounded-[1.5rem] cards) with per-page section
 * ordering so each page leads with its own switching argument:
 * PlanSwift = roofing specialisation, RoofSnap = self-service vs
 * outsourced, EagleView = cost/control vs per-report.
 *
 * Honesty rules: unverifiable competitor cells say "Not publicly
 * confirmed"; competitor pricing carries a visible checked date;
 * the "choose competitor if" section is mandatory.
 */

const DEFAULT_ORDER: SectionKey[] = [
  "quickAnswer",
  "replace",
  "switching",
  "bestFor",
  "comparison",
  "pricing",
  "workflow",
  "video",
  "honestWhen",
  "freeTool",
  "faq",
  "related",
];

function StatusCell({
  status,
  note,
  accent,
}: {
  status: SupportStatus;
  note?: string;
  accent?: boolean;
}) {
  const label = STATUS_LABEL[status];
  return (
    <div className="flex items-start gap-2">
      {status === "yes" && (
        <span
          aria-hidden="true"
          className={`mt-0.5 shrink-0 font-bold ${accent ? "text-[#FF6B35]" : "text-zinc-950"}`}
        >
          ✓
        </span>
      )}
      {status === "partial" && (
        <span aria-hidden="true" className="mt-0.5 shrink-0 font-bold text-zinc-500">
          ◐
        </span>
      )}
      {(status === "no" || status === "different" || status === "unconfirmed") && (
        <span aria-hidden="true" className="mt-0.5 shrink-0 font-bold text-zinc-400">
          —
        </span>
      )}
      <span>
        <span
          className={
            status === "yes"
              ? "font-medium text-zinc-950"
              : status === "unconfirmed"
                ? "italic text-zinc-500"
                : "text-zinc-700"
          }
        >
          {note ?? label}
        </span>
        {note && status !== "yes" && status !== "unconfirmed" && (
          <span className="mt-0.5 block text-xs leading-5 text-zinc-500">{label}</span>
        )}
      </span>
    </div>
  );
}

function ComparisonTable({
  rows,
  competitorName,
}: {
  rows: ComparisonRow[];
  competitorName: string;
}) {
  return (
    <>
      {/* Desktop / tablet table */}
      <div className="mt-10 hidden overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th scope="col" className="px-6 py-4 font-semibold text-zinc-950">
                Feature
              </th>
              <th scope="col" className="px-6 py-4 font-semibold text-zinc-950">
                {competitorName}
              </th>
              <th scope="col" className="px-6 py-4 font-semibold text-zinc-950">
                QuoteCore+
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.feature} className="border-b border-zinc-100 last:border-0">
                <th scope="row" className="px-6 py-4 align-top font-medium text-zinc-900">
                  {row.feature}
                </th>
                <td className="px-6 py-4 align-top text-zinc-600">
                  <StatusCell status={row.competitor.status} note={row.competitor.note} />
                </td>
                <td className="px-6 py-4 align-top text-zinc-600">
                  <StatusCell status={row.qc.status} note={row.qc.note} accent />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked rows */}
      <div className="mt-8 space-y-4 md:hidden">
        {rows.map((row) => (
          <div key={row.feature} className="rounded-[1.5rem] border border-zinc-200 bg-white px-5 py-5">
            <p className="font-semibold text-zinc-950">{row.feature}</p>
            <div className="mt-3 grid gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {competitorName}
                </p>
                <div className="mt-1 text-sm text-zinc-600">
                  <StatusCell status={row.competitor.status} note={row.competitor.note} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#BD4A1A]">
                  QuoteCore+
                </p>
                <div className="mt-1 text-sm text-zinc-600">
                  <StatusCell status={row.qc.status} note={row.qc.note} accent />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

const VERDICT_STYLES: Record<"yes" | "mixed" | "no", string> = {
  yes: "bg-black text-white",
  mixed: "bg-[#FF6B35] text-white",
  no: "bg-zinc-200 text-zinc-800",
};

export default function CompetitorPage({ data }: { data: CompetitorPageData }) {
  const slug = data.slug;
  const video = VIDEOS[data.video.videoKey];
  const order = data.sectionOrder ?? DEFAULT_ORDER;

  const sections: Record<SectionKey, ReactNode> = {
    quickAnswer: (
      <section key="quickAnswer" className="mx-auto max-w-4xl px-6 py-16 lg:px-8">
        <div className="rounded-[2rem] border border-zinc-200 bg-zinc-50 px-8 py-8">
          <h2 className="text-2xl font-semibold sm:text-3xl">{data.quickAnswer.heading}</h2>
          <p className="mt-4 text-lg leading-8 text-zinc-700">{data.quickAnswer.body}</p>
        </div>
      </section>
    ),

    replace: (
      <section key="replace" className="mx-auto max-w-4xl px-6 py-16 lg:px-8">
        <h2 className="text-3xl font-semibold sm:text-4xl">
          Can QuoteCore+ replace {data.competitorName}?
        </h2>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <span
            className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm font-semibold ${VERDICT_STYLES[data.replace.verdict.tone]}`}
          >
            {data.replace.verdict.pill}
          </span>
          <p className="flex-1 text-lg font-medium text-zinc-900">
            {data.replace.verdict.answer}
          </p>
        </div>
        <p className="mt-5 text-lg leading-8 text-zinc-600">{data.replace.body}</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {data.replace.bullets.map((b) => (
            <li
              key={b.label}
              className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5"
            >
              <p className="flex items-start gap-2 font-semibold text-zinc-950">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 shrink-0 font-bold ${b.positive ? "text-[#FF6B35]" : "text-zinc-400"}`}
                >
                  {b.positive ? "✓" : "—"}
                </span>
                {b.label}
              </p>
              <p className="mt-2 pl-6 text-sm leading-7 text-zinc-600">{b.detail}</p>
            </li>
          ))}
        </ul>
      </section>
    ),

    switching: (
      <section key="switching" className="mx-auto max-w-5xl px-6 py-16 lg:px-8">
        <h2 className="text-3xl font-semibold sm:text-4xl">
          Switching from {data.competitorName}
        </h2>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-600">
          {data.switching.intro ?? "What actually changes in your day-to-day workflow:"}
        </p>

        <div className="mt-10 hidden overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white md:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th scope="col" className="px-6 py-4 font-semibold text-zinc-950">
                  Today with {data.competitorName}
                </th>
                <th scope="col" className="px-6 py-4 font-semibold text-zinc-950">
                  With QuoteCore+
                </th>
                <th scope="col" className="px-6 py-4 font-semibold text-zinc-950">
                  What you gain
                </th>
              </tr>
            </thead>
            <tbody>
              {data.switching.rows.map((r) => (
                <tr key={r.current} className="border-b border-zinc-100 last:border-0">
                  <td className="px-6 py-4 align-top text-zinc-600">{r.current}</td>
                  <td className="px-6 py-4 align-top font-medium text-zinc-900">{r.qc}</td>
                  <td className="px-6 py-4 align-top text-zinc-600">{r.benefit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 space-y-4 md:hidden">
          {data.switching.rows.map((r) => (
            <div key={r.current} className="rounded-[1.5rem] border border-zinc-200 bg-white px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Today with {data.competitorName}
              </p>
              <p className="mt-1 text-sm text-zinc-600">{r.current}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#BD4A1A]">
                With QuoteCore+
              </p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{r.qc}</p>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{r.benefit}</p>
            </div>
          ))}
        </div>
      </section>
    ),

    bestFor: (
      <section key="bestFor" className="bg-zinc-50 py-20">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">Which one fits your business?</h2>
          <p className="mt-4 text-lg leading-8 text-zinc-600">
            An honest starting point — both tools are good at what they do.
          </p>
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <div className="rounded-[1.5rem] border border-zinc-200 bg-white px-7 py-7">
              <h3 className="text-xl font-semibold">Choose {data.competitorName} if…</h3>
              <ul className="mt-5 space-y-4">
                {data.bestFor.competitorBestFor.map((c) => (
                  <li key={c.title}>
                    <p className="font-medium text-zinc-900">{c.title}</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-600">{c.body}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[1.5rem] border border-orange-200 bg-white px-7 py-7 shadow-[0_0_8px_rgba(255,107,53,0.08)]">
              <h3 className="text-xl font-semibold">Choose QuoteCore+ if…</h3>
              <ul className="mt-5 space-y-4">
                {data.bestFor.qcBestFor.map((c) => (
                  <li key={c.title} className="flex items-start gap-3">
                    <span aria-hidden="true" className="mt-1 shrink-0 font-bold text-[#FF6B35]">
                      ✓
                    </span>
                    <span>
                      <p className="font-medium text-zinc-900">{c.title}</p>
                      <p className="mt-1 text-sm leading-6 text-zinc-600">{c.body}</p>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    ),

    comparison: (
      <section key="comparison" className="mx-auto max-w-5xl px-6 py-20 lg:px-8">
        <h2 className="text-3xl font-semibold sm:text-4xl">{data.comparison.heading}</h2>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-600">
          {data.comparison.intro}
        </p>
        <ComparisonTable rows={data.comparison.rows} competitorName={data.competitorName} />
        <p className="mt-6 text-sm text-zinc-500">
          “Not publicly confirmed” means the capability is not clearly stated on the
          vendor’s official website — it may exist, but we do not claim it either way.
        </p>
      </section>
    ),

    pricing: (
      <section key="pricing" id="pricing" className="bg-zinc-50 py-20">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <PricingViewTracker slug={slug} />
          <h2 className="text-3xl font-semibold sm:text-4xl">{data.pricing.heading}</h2>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-600">
            {data.pricing.intro}
          </p>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <div className="rounded-[1.5rem] border border-zinc-200 bg-white px-7 py-7">
              <h3 className="text-lg font-semibold">{data.competitorName} pricing</h3>
              <ul className="mt-5 space-y-4">
                {data.pricing.competitorTiers.map((t) => (
                  <li key={t.name} className="flex items-baseline justify-between gap-4">
                    <span>
                      <span className="font-medium text-zinc-900">{t.name}</span>
                      {t.detail && (
                        <span className="mt-0.5 block text-xs leading-5 text-zinc-500">
                          {t.detail}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-semibold text-zinc-950">{t.price}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-xs leading-5 text-zinc-500">{data.pricing.sourceNote}</p>
            </div>

            <div className="rounded-[1.5rem] border border-orange-200 bg-white px-7 py-7 shadow-[0_0_8px_rgba(255,107,53,0.08)]">
              <h3 className="text-lg font-semibold">QuoteCore+ pricing</h3>
              <ul className="mt-5 space-y-4">
                <li className="flex items-baseline justify-between gap-4">
                  <span className="font-medium text-zinc-900">Free Lite plan</span>
                  <span className="shrink-0 font-semibold text-zinc-950">$0</span>
                </li>
                <li className="flex items-baseline justify-between gap-4">
                  <span>
                    <span className="font-medium text-zinc-900">Starter</span>
                    <span className="mt-0.5 block text-xs leading-5 text-zinc-500">
                      25 quotes/month
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold text-zinc-950">$19/mo</span>
                </li>
                <li className="flex items-baseline justify-between gap-4">
                  <span>
                    <span className="font-medium text-zinc-900">Pro</span>
                    <span className="mt-0.5 block text-xs leading-5 text-zinc-500">
                      100 quotes/month, 50 AI Assist points
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold text-zinc-950">$39/mo</span>
                </li>
                <li className="flex items-baseline justify-between gap-4">
                  <span>
                    <span className="font-medium text-zinc-900">Pro Plus</span>
                    <span className="mt-0.5 block text-xs leading-5 text-zinc-500">
                      200 quotes/month, 100 AI Assist points
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold text-zinc-950">$59/mo</span>
                </li>
              </ul>
              <p className="mt-6 text-sm text-zinc-600">
                <a href="/pricing" className="font-medium text-[#FF6B35] hover:underline">
                  See full pricing →
                </a>
              </p>
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th scope="col" className="px-6 py-4 font-semibold text-zinc-950">
                    Scenario
                  </th>
                  <th scope="col" className="px-6 py-4 font-semibold text-zinc-950">
                    {data.competitorName}
                  </th>
                  <th scope="col" className="px-6 py-4 font-semibold text-zinc-950">
                    QuoteCore+
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.pricing.scenarios.map((s) => (
                  <tr key={s.label} className="border-b border-zinc-100 last:border-0">
                    <th scope="row" className="px-6 py-4 align-top font-medium text-zinc-900">
                      {s.label}
                    </th>
                    <td className="px-6 py-4 align-top text-zinc-600">{s.competitor}</td>
                    <td className="px-6 py-4 align-top text-zinc-600">{s.qc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.pricing.scenarioNote && (
            <p className="mt-4 text-xs leading-5 text-zinc-500">{data.pricing.scenarioNote}</p>
          )}
        </div>
      </section>
    ),

    workflow: (
      <section key="workflow" className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
        <h2 className="text-3xl font-semibold sm:text-4xl">{data.workflow.heading}</h2>
        <p className="mt-4 text-lg leading-8 text-zinc-600">{data.workflow.intro}</p>
        <div className="mt-12 flex flex-col gap-5">
          {data.workflow.steps.map((s) => (
            <div
              key={s.number}
              className="rounded-[2rem] border border-zinc-200 bg-white px-7 py-6 shadow-sm"
            >
              <div className="flex items-start gap-6">
                <span className="w-12 shrink-0 text-2xl font-semibold text-zinc-950">
                  {s.number}
                </span>
                <div>
                  <h3 className="text-xl font-semibold">{s.title}</h3>
                  <p className="mt-3 text-zinc-600">{s.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {data.workflow.proof && (
          <div className="mt-16">
            <h3 className="text-2xl font-semibold sm:text-3xl">{data.workflow.proof.heading}</h3>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {data.workflow.proof.images.map((img) => (
                <figure key={img.src} className="rounded-[1.5rem] border border-zinc-200 bg-white p-3">
                  <img
                    src={img.src}
                    alt={img.alt}
                    className="w-full rounded-xl border border-zinc-100"
                    loading="lazy"
                  />
                  <figcaption className="px-2 pb-1 pt-3 text-sm text-zinc-600">
                    {img.caption}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}
      </section>
    ),

    video: (
      <section key="video" className="bg-zinc-50 py-20">
        <div className="mx-auto max-w-3xl px-6 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">{data.video.heading}</h2>
          <p className="mt-4 text-lg leading-8 text-zinc-600">{data.video.intro}</p>
          <div className="mt-10">
            <CompetitorVideo
              slug={slug}
              videoId={video.id}
              title={video.title}
              thumbnail={video.thumbnail}
              uploadDate={video.uploadDate}
            />
          </div>
          <div className="mt-8 text-center">
            <TrackedCta
              slug={slug}
              location="video_section"
              href={data.video.ctaHref}
              label={data.video.ctaLabel}
            />
          </div>
        </div>
      </section>
    ),

    honestWhen: (
      <section key="honestWhen" className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
        <h2 className="text-3xl font-semibold sm:text-4xl">{data.honestWhen.heading}</h2>
        <p className="mt-4 text-lg leading-8 text-zinc-600">{data.honestWhen.intro}</p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.honestWhen.cards.map((c) => (
            <div
              key={c.title}
              className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-6"
            >
              <p className="font-semibold text-zinc-950">{c.title}</p>
              <p className="mt-2 text-sm leading-7 text-zinc-600">{c.body}</p>
            </div>
          ))}
        </div>
      </section>
    ),

    freeTool: (
      <section key="freeTool" className="bg-zinc-50 py-20">
        <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">{data.freeTool.heading}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-zinc-600">
            {data.freeTool.body}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <TrackedCta
              slug={slug}
              location="free_tool_primary"
              href={data.freeTool.primaryHref}
              label={data.freeTool.primaryLabel}
              variant="accent"
            />
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            <span className="text-zinc-500">Also free:</span>
            {data.freeTool.secondaryLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="font-medium text-[#FF6B35] hover:underline"
              >
                {l.label} →
              </a>
            ))}
          </div>
        </div>
      </section>
    ),

    faq: (
      <section key="faq" className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
        <h2 className="text-3xl font-semibold sm:text-4xl">Common questions</h2>
        <div className="mt-10 space-y-4">
          {data.faqs.map((f) => (
            <div
              key={f.question}
              className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5"
            >
              <p className="font-semibold text-zinc-950">{f.question}</p>
              <p className="mt-3 text-sm leading-7 text-zinc-600">{f.answer}</p>
            </div>
          ))}
        </div>
      </section>
    ),

    related: (
      <section key="related" className="mx-auto max-w-4xl px-6 pb-20 lg:px-8">
        <h2 className="text-3xl font-semibold sm:text-4xl">Related</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.related.map((r) => (
            <a
              key={r.href}
              href={r.href}
              className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40"
            >
              <p className="font-semibold text-zinc-950">{r.label}</p>
              <p className="mt-1 text-sm text-zinc-600">{r.description}</p>
            </a>
          ))}
        </div>
      </section>
    ),
  };

  return (
    <main className="min-h-screen bg-white text-zinc-950">
      {/* Hero */}
      <section className="relative overflow-hidden pb-16 pt-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.10),transparent_34%)]" />
        <div className="relative mx-auto max-w-4xl px-6 text-center lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
            {data.positioning}
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            {data.hero.title}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-600 sm:text-xl">
            {data.hero.sub}
          </p>

          {data.hero.qualifier && (
            <p className="mx-auto mt-6 max-w-2xl rounded-[1.5rem] border border-zinc-200 bg-zinc-50 px-6 py-4 text-left text-base leading-7 text-zinc-700">
              {data.hero.qualifier}
            </p>
          )}

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <TrackedCta
              slug={slug}
              location="hero"
              href={data.hero.primaryCta.href}
              label={data.hero.primaryCta.label}
            />
            {data.hero.ghostCta && (
              <TrackedCta
                slug={slug}
                location="hero"
                href={data.hero.ghostCta.href}
                label={data.hero.ghostCta.label}
                variant="ghost"
              />
            )}
          </div>
          <p className="mt-3 text-sm text-zinc-500">
            Browser-based, nothing to install. 14-day free trial, no credit card.
          </p>
        </div>
      </section>

      {order.map((key) => sections[key])}

      {/* Final CTA */}
      <section className="mx-auto max-w-4xl px-6 pb-24 pt-4 text-center lg:px-8">
        <h2 className="text-3xl font-semibold sm:text-5xl">{data.finalCta.heading}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600">{data.finalCta.body}</p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <TrackedCta
            slug={slug}
            location="final_cta"
            href="/free-trial"
            label={data.finalCta.ctaLabel ?? "Start your free 14-day trial"}
          />
          <TrackedCta
            slug={slug}
            location="final_cta"
            href="/pricing"
            label="See pricing"
            variant="ghost"
          />
        </div>
        <p className="mt-4 text-sm text-zinc-500">No card required. Cancel anytime.</p>
      </section>
    </main>
  );
}
