"use client";

import { useState } from "react";

interface Faq {
  question: string;
  answer: string;
}

const icons = [
  "M4 7h16v10H4V7zm3 3h4m-4 3h8",
  "M12 6v6l4 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  "M6 4v16M6 5h10l-2 4 2 4H6",
  "M8 10a4 4 0 118 0M4 19a8 8 0 0116 0M8 19a4 4 0 018 0",
  "M5 8a7 5 0 0114 0c0 3.3-3.1 6-7 6a9 9 0 01-2-.2L5 17l1.1-4A5.8 5.8 0 015 8z",
  "M7 3h10v18H7V3zm3 4h4m-4 4h4m-4 4h2",
];

function getFaqIcon(question: string) {
  const lowerQuestion = question.toLowerCase();

  if (lowerQuestion.includes("credit card")) return "/faq-credit-card.png";
  if (lowerQuestion.includes("real quotes")) return "/faq-customers.png";
  if (lowerQuestion.includes("get started")) return "/faq-get-started.png";
  if (lowerQuestion.includes("who is")) return "/faq-who-is-it-for.png";
  if (lowerQuestion.includes("smart components")) return "/faq-smart-components.png";

  return null;
}

function FaqItem({ question, answer, index }: Faq & { index: number }) {
  const [open, setOpen] = useState(false);
  const iconPath = icons[index % icons.length];
  const iconSrc = getFaqIcon(question);

  return (
    <div className="rounded-[1.35rem] border border-zinc-200 bg-white px-5 py-4 shadow-[0_14px_44px_rgba(15,23,42,0.04)]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <span className="flex min-w-0 items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FF6B35]/10 text-[#BD4A1A]">
            {iconSrc ? (
              <img src={iconSrc} alt="" className="h-6 w-6 object-contain" aria-hidden="true" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d={iconPath} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span className="text-base font-semibold leading-snug text-zinc-950">{question}</span>
        </span>
        <span className="shrink-0 text-2xl leading-none text-zinc-600">{open ? "-" : "+"}</span>
      </button>
      <p
        className="pl-[3.75rem] text-sm leading-7 text-zinc-600"
        style={
          open
            ? { marginTop: "1rem", display: "block" }
            : {
                position: "absolute",
                width: "1px",
                height: "1px",
                padding: 0,
                margin: "-1px",
                overflow: "hidden",
                clip: "rect(0,0,0,0)",
                whiteSpace: "nowrap",
                border: 0,
              }
        }
      >
        {answer}
      </p>
    </div>
  );
}

export default function FreeTrialFaqPanel({ faqs }: { faqs: Faq[] }) {
  return (
    <div className="rounded-[2rem] border border-zinc-100 bg-white p-6 shadow-[0_28px_90px_rgba(15,23,42,0.08)] sm:p-8">
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Frequently Asked Questions</h2>
          <div className="mt-5 h-0.5 w-14 bg-[#FF6B35]" />
        </div>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <FaqItem key={faq.question} question={faq.question} answer={faq.answer} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
