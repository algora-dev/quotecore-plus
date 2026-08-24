"use client";

import { useState } from "react";
import Link from "next/link";

const PROMOTION_METHODS = [
  "YouTube",
  "TikTok / Instagram / social",
  "Website / blog",
  "Newsletter / email list",
  "Construction / trades network",
  "Community / group",
  "Direct outreach",
  "Existing clients / customers",
  "Other",
];

const AUDIENCE_RANGES = [
  "Just getting started",
  "Under 1,000",
  "1k–10k",
  "10k–50k",
  "50k–250k",
  "250k+",
];

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-orange-500 focus:outline-none";

export default function DistributorApplicationForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [methods, setMethods] = useState<string[]>([]);
  const [audience, setAudience] = useState("");
  const [link, setLink] = useState("");
  const [customDeal, setCustomDeal] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const toggleMethod = (m: string) => {
    setMethods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setErrorMsg("");
    try {
      const res = await fetch("/api/distributor-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          promotion_methods: methods,
          audience_range: audience,
          link,
          custom_deal: customDeal,
          message,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("success");
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="py-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-50">
          <svg className="h-7 w-7 text-[#FF6B35]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h3 className="mt-5 text-2xl font-bold text-zinc-950">Application received</h3>
        <p className="mx-auto mt-3 max-w-md leading-7 text-zinc-600">
          Thanks. We will review your application and contact you by email if we think there is a good fit.
        </p>
        <p className="mt-4 text-sm text-zinc-500">
          In the meantime, explore the{" "}
          <Link href="/free-calculators" className="font-semibold text-[#BD4A1A] hover:underline">
            free tools
          </Link>{" "}
          and think about which ones best fit your audience.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Honeypot */}
      <input type="text" name="company_website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <div>
        <label htmlFor="dist-name" className="mb-1.5 block text-sm font-medium text-zinc-900">
          Your name, channel or business <span className="text-[#BD4A1A]">*</span>
        </label>
        <input
          id="dist-name"
          type="text"
          required
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Roofing Reviews UK, J. Smith, or a brand name"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="dist-email" className="mb-1.5 block text-sm font-medium text-zinc-900">
          Email <span className="text-[#BD4A1A]">*</span>
        </label>
        <input
          id="dist-email"
          type="email"
          required
          maxLength={320}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={inputClass}
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-zinc-900">
          How do you plan to promote QuoteCore? <span className="text-[#BD4A1A]">*</span>
          <span className="ml-2 text-xs font-normal text-zinc-500">Select all that apply</span>
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PROMOTION_METHODS.map((m) => (
            <label
              key={m}
              className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-4 py-3 text-sm transition ${
                methods.includes(m)
                  ? "border-orange-300 bg-orange-50/50 text-zinc-950"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-orange-200 hover:bg-orange-50/30"
              }`}
            >
              <input
                type="checkbox"
                checked={methods.includes(m)}
                onChange={() => toggleMethod(m)}
                className="h-4 w-4 rounded border-zinc-300 accent-[#FF6B35]"
              />
              {m}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="dist-audience" className="mb-1.5 block text-sm font-medium text-zinc-900">
            Audience / reach <span className="text-xs font-normal text-zinc-500">(optional)</span>
          </label>
          <select id="dist-audience" value={audience} onChange={(e) => setAudience(e.target.value)} className={inputClass}>
            <option value="">Select…</option>
            {AUDIENCE_RANGES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="dist-link" className="mb-1.5 block text-sm font-medium text-zinc-900">
            Website, channel or profile link <span className="text-xs font-normal text-zinc-500">(optional)</span>
          </label>
          <input
            id="dist-link"
            type="url"
            maxLength={500}
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://"
            className={inputClass}
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 hover:border-orange-200 hover:bg-orange-50/30">
        <input
          type="checkbox"
          checked={customDeal}
          onChange={(e) => setCustomDeal(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-[#FF6B35]"
        />
        <span>
          <span className="block text-sm font-medium text-zinc-900">I&rsquo;d like to discuss a custom partnership deal</span>
          <span className="mt-1 block text-xs leading-5 text-zinc-500">
            Optional. Tick this if you have an established audience, distribution channel, business network, unique
            promotion strategy, or would like to discuss different commercial terms.
          </span>
        </span>
      </label>

      <div>
        <label htmlFor="dist-message" className="mb-1.5 block text-sm font-medium text-zinc-900">
          Anything else we should know? <span className="text-xs font-normal text-zinc-500">(optional)</span>
        </label>
        <textarea
          id="dist-message"
          rows={3}
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Your promotion plan, relevant experience, questions…"
          className={inputClass}
        />
      </div>

      {status === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting" || methods.length === 0}
        className="w-full rounded-full bg-black px-7 py-3.5 text-sm font-semibold text-white transition hover:shadow-[0_0_24px_rgba(255,107,53,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "submitting" ? "Submitting…" : "Apply to Partner with QuoteCore"}
      </button>
      <p className="text-center text-xs text-zinc-400">Takes about 30 seconds.</p>
    </form>
  );
}
