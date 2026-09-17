"use client";

import { useState } from "react";

/**
 * Public feedback questionnaire (quote-core.com/feedback, 2026-09-17).
 * Conditional step flow: anything stopping you -> features you like ->
 * features you don't -> improvement wish -> send -> thank you.
 * Every step is skippable so the whole thing can be done in ~30 seconds.
 */

const FEATURES: { key: string; label: string }[] = [
  { key: "smart_components", label: "Smart Components" },
  { key: "digital_measure", label: "Digital measuring & takeoff tool" },
  { key: "ai_scan_assist", label: "AI Scan Assist (upload plans, auto-measure)" },
  {
    key: "auto_follow_ups",
    label: "Automatic follow-ups for quotes, orders & invoices",
  },
  {
    key: "catalog_converter",
    label: "Catalog (spreadsheet) to components converter",
  },
  { key: "supplier_tools", label: "Supplier pricing tools & enquiries" },
  { key: "orders_hub", label: "Orders hub & job tracking" },
  { key: "pdf_quotes", label: "Instant branded PDF quotes" },
  { key: "team_workspace", label: "Team workspace & roles" },
];

const STOPPING_REASONS: { key: string; label: string }[] = [
  { key: "too_hard", label: "It's too hard to understand" },
  { key: "too_complex", label: "It's too complex to set up" },
  { key: "missing_features", label: "It doesn't have the features I want" },
  { key: "not_what_i_need", label: "It's not what I need" },
  { key: "other", label: "Something else" },
];

const CALENDLY_URL = "https://calendly.com/quote-core-info/15-minute-meeting";

type Step =
  | "stopping"
  | "reason"
  | "liked"
  | "disliked"
  | "wish"
  | "send"
  | "done";

const STEP_ORDER: Step[] = ["stopping", "reason", "liked", "disliked", "wish", "send", "done"];

function OptionButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm font-medium ${
        selected
          ? "border-[#FF6B35] bg-orange-50 text-slate-900 shadow-[0_0_8px_rgba(255,107,53,0.08)]"
          : "border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50/40"
      }`}
    >
      {children}
    </button>
  );
}

export function FeedbackForm() {
  const [step, setStep] = useState<Step>("stopping");
  const [anythingStopping, setAnythingStopping] = useState<"yes" | "no" | null>(null);
  const [stoppingReason, setStoppingReason] = useState<string | null>(null);
  const [stoppingReasonOther, setStoppingReasonOther] = useState("");
  const [liked, setLiked] = useState<string[]>([]);
  const [disliked, setDisliked] = useState<string[]>([]);
  const [featureComment, setFeatureComment] = useState("");
  const [wish, setWish] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [responseRequested, setResponseRequested] = useState(false);

  const stepIndex = STEP_ORDER.indexOf(step);

  function goStopping(value: "yes" | "no") {
    setAnythingStopping(value);
    setStep(value === "yes" ? "reason" : "liked");
  }

  function pickReason(key: string) {
    setStoppingReason(key);
  }

  function toggleFeature(list: string[], setList: (v: string[]) => void, key: string) {
    setList(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  }

  async function submit(withEmail: string) {
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: withEmail || null,
          anythingStopping,
          stoppingReason,
          stoppingReasonOther,
          likedFeatures: liked,
          dislikedFeatures: disliked,
          featureComment,
          improvementWish: wish,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      setSubmissionId(data.id ?? null);
      setStep("done");
    } catch (err) {
      setSendError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setSending(false);
    }
  }

  async function requestResponse() {
    if (!submissionId || responseRequested) return;
    setResponseRequested(true);
    try {
      await fetch("/api/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: submissionId }),
      });
    } catch {
      // Non-fatal: the submission itself is already saved.
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 sm:p-8 space-y-6">
      {/* Brand header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
          <span className="text-white text-sm font-bold">Q</span>
        </div>
        <span className="font-semibold text-slate-900">QuoteCore+</span>
      </div>

      {step === "stopping" && (
        <section className="space-y-4" aria-label="Is anything stopping you">
          <h1 className="text-2xl font-semibold text-slate-900">
            Is there anything stopping you from using QuoteCore+?
          </h1>
          <p className="text-sm text-slate-500">
            Your feedback goes straight to the team and shapes what we build next.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <OptionButton selected={anythingStopping === "no"} onClick={() => goStopping("no")}>
              No, all good
            </OptionButton>
            <OptionButton selected={anythingStopping === "yes"} onClick={() => goStopping("yes")}>
              Yes
            </OptionButton>
          </div>
        </section>
      )}

      {step === "reason" && (
        <section className="space-y-4" aria-label="What is stopping you">
          <h1 className="text-2xl font-semibold text-slate-900">
            What's getting in the way?
          </h1>
          <div className="space-y-2">
            {STOPPING_REASONS.map((r) => (
              <OptionButton key={r.key} selected={stoppingReason === r.key} onClick={() => pickReason(r.key)}>
                {r.label}
              </OptionButton>
            ))}
          </div>
          {stoppingReason === "other" && (
            <textarea
              value={stoppingReasonOther}
              onChange={(e) => setStoppingReasonOther(e.target.value)}
              placeholder="Tell us what it is..."
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base md:text-sm focus:border-orange-500 focus:outline-none"
            />
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep("liked")}
              className="text-sm text-slate-500 hover:text-slate-700 px-1"
            >
              Skip
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setStep("liked")}
              disabled={!stoppingReason}
              className="inline-flex items-center rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </section>
      )}

      {(step === "liked" || step === "disliked") && (
        <section className="space-y-4" aria-label={step === "liked" ? "Features you like" : "Features you don't use"}>
          <h1 className="text-2xl font-semibold text-slate-900">
            {step === "liked"
              ? "Which features do you like?"
              : "Which features don't you use or like?"}
          </h1>
          <p className="text-sm text-slate-500">Select as many as you want, or skip.</p>
          <div className="space-y-2">
            {FEATURES.map((f) => (
              <OptionButton
                key={f.key}
                selected={
                  step === "liked" ? liked.includes(f.key) : disliked.includes(f.key)
                }
                onClick={() =>
                  step === "liked"
                    ? toggleFeature(liked, setLiked, f.key)
                    : toggleFeature(disliked, setDisliked, f.key)
                }
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`w-4 h-4 rounded-[4px] border flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${
                      (step === "liked" ? liked.includes(f.key) : disliked.includes(f.key))
                        ? "bg-[#FF6B35] border-[#FF6B35] text-white"
                        : "border-slate-300 bg-white text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  {f.label}
                </span>
              </OptionButton>
            ))}
          </div>
          {step === "disliked" && (
            <textarea
              value={featureComment}
              onChange={(e) => setFeatureComment(e.target.value)}
              placeholder="Anything you'd like to tell us about these? (optional)"
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base md:text-sm focus:border-orange-500 focus:outline-none"
            />
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(step === "liked" ? "disliked" : "wish")}
              className="text-sm text-slate-500 hover:text-slate-700 px-1"
            >
              Skip
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setStep(step === "liked" ? "disliked" : "wish")}
              className="inline-flex items-center rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
            >
              Continue
            </button>
          </div>
        </section>
      )}

      {step === "wish" && (
        <section className="space-y-4" aria-label="What should we add">
          <h1 className="text-2xl font-semibold text-slate-900">
            If we could add one thing that would help you get more out of QuoteCore+,
            what would it be?
          </h1>
          <p className="text-sm text-slate-500">
            We'll probably build it. We also provide custom solutions built around the way
            you currently work - making things easier, faster and more accurate for you and
            your staff.
          </p>
          <textarea
            value={wish}
            onChange={(e) => setWish(e.target.value)}
            placeholder="Type your idea here... (optional)"
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base md:text-sm focus:border-orange-500 focus:outline-none"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep("send")}
              className="text-sm text-slate-500 hover:text-slate-700 px-1"
            >
              Skip
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setStep("send")}
              className="inline-flex items-center rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
            >
              Continue
            </button>
          </div>
        </section>
      )}

      {step === "send" && (
        <section className="space-y-4" aria-label="Send your feedback">
          <h1 className="text-2xl font-semibold text-slate-900">Send us your feedback</h1>
          <p className="text-sm text-slate-500">
            Add your email so we can respond or get in touch about what you told us. You can
            also send it anonymously.
          </p>
          <input
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base md:text-sm focus:border-orange-500 focus:outline-none"
          />
          {sendError && <p className="text-sm text-red-600">{sendError}</p>}
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              type="button"
              onClick={() => submit("")}
              disabled={sending}
              className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              Send anonymously
            </button>
            <button
              type="button"
              onClick={() => submit(email)}
              disabled={sending || !email.trim()}
              className="inline-flex items-center rounded-full bg-[#FF6B35] px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-[#ff5722] hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send with my email"}
            </button>
          </div>
        </section>
      )}

      {step === "done" && (
        <section className="space-y-5 text-center" aria-label="Thank you">
          <div className="mx-auto w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-3xl font-semibold text-slate-900">Thank you</h1>
          <p className="text-sm text-slate-500">
            We really appreciate your feedback. If you'd like to talk it through, we're
            here.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={requestResponse}
              disabled={!submissionId || responseRequested}
              className="inline-flex items-center justify-center rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] disabled:opacity-50"
            >
              {responseRequested ? "We'll be in touch" : "Request a response"}
            </button>
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-[#FF6B35] px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-[#ff5722] hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
            >
              Book a call
            </a>
          </div>
        </section>
      )}

      {/* Progress dots */}
      {step !== "done" && (
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex gap-1.5">
            {STEP_ORDER.slice(0, 6).map((s, i) => (
              <span
                key={s}
                className={`w-1.5 h-1.5 rounded-full ${i <= stepIndex ? "bg-[#FF6B35]" : "bg-slate-200"}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              const prevIndex = Math.max(0, stepIndex - 1);
              setStep(STEP_ORDER[prevIndex]);
            }}
            disabled={stepIndex === 0}
            className="text-xs text-slate-400 hover:text-slate-600 disabled:opacity-0"
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
}
