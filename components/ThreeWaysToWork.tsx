import React from "react";

export type ThreeWaysCard = {
  title: string;
  body: string;
  href?: string;
  linkLabel?: string;
};

export type ThreeWaysToWorkProps = {
  eyebrow?: string;
  title: string;
  intro?: string;
  cards: ThreeWaysCard[];
  footnote?: string;
  footnoteLink?: { href: string; label: string };
  className?: string;
};

/**
 * Shared marketing section: the "ways to get from measurements to a quote" model.
 * Page-specific copy is passed in via props so each page keeps its own SEO intent.
 * Marketing surface only - do not import into product/app pages.
 */
export default function ThreeWaysToWork({
  eyebrow,
  title,
  intro,
  cards,
  footnote,
  footnoteLink,
  className = "",
}: ThreeWaysToWorkProps) {
  return (
    <section className={`mx-auto max-w-5xl px-6 pb-16 lg:px-8 ${className}`}>
      {eyebrow && (
        <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-[#FF6B35]">
          {eyebrow}
        </p>
      )}
      <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h2>
      {intro && (
        <p className="mx-auto mt-3 max-w-2xl text-center text-zinc-600">{intro}</p>
      )}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, i) => {
          const inner = (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#FF6B35]">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-2 text-base font-semibold text-slate-900">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{card.body}</p>
              {card.href && card.linkLabel && (
                <p className="mt-4 text-sm font-medium text-[#BD4A1A]">{card.linkLabel}</p>
              )}
            </>
          );
          return card.href ? (
            <a
              key={card.title}
              href={card.href}
              className="block rounded-xl border border-slate-200 bg-white p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)]"
            >
              {inner}
            </a>
          ) : (
            <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-6">
              {inner}
            </div>
          );
        })}
      </div>
      {(footnote || footnoteLink) && (
        <div className="mt-6 rounded-xl border border-dashed border-slate-200 px-6 py-5">
          {footnote && <p className="text-sm text-slate-600">{footnote}</p>}
          {footnoteLink && (
            <p className="mt-2 text-sm">
              <a href={footnoteLink.href} className="font-medium text-[#BD4A1A] hover:underline">
                {footnoteLink.label}
              </a>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
