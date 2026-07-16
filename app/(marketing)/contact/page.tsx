"use client";

import { useState } from "react";
import Script from "next/script";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import { buildBreadcrumbSchema, siteUrl } from "@/lib/schema";

export default function ContactPage() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  return (
    <>
      <Script
        id="contact-breadcrumb-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildBreadcrumbSchema([
            { name: "Home", url: `${siteUrl}/` },
            { name: "Contact", url: `${siteUrl}/contact` },
          ])),
        }}
      />
      <BlogHeader backLabel="Back to homepage" backHref="/" />

      <main className="relative overflow-hidden bg-[linear-gradient(180deg,#fff_0%,#fff7f2_48%,#fff_100%)]">
        <div className="pointer-events-none absolute right-0 top-20 h-72 w-72 rounded-full bg-[#FF6B35]/8 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute left-0 bottom-24 h-64 w-80 rounded-full bg-[#FF6B35]/6 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-6 py-16 lg:px-8">
        {/* Hero */}
        <div className="mx-auto mb-14 max-w-4xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#FF6B35]">Get in touch</p>
          <h1 className="mb-4 text-5xl font-semibold tracking-tight text-zinc-900 sm:text-6xl md:whitespace-nowrap">
            We&apos;d love to hear from you
          </h1>
          <p className="text-lg leading-8 text-zinc-500">
            Not ready to book a call? No problem. Send us a message and we&apos;ll get back to you within 24 hours - no jargon, no pressure.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-20 items-start">
          {/* Left - info */}
          <div>
            <div className="space-y-8">
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-50">
                  <svg className="h-5 w-5 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="mb-1 text-base font-semibold text-zinc-900">Email us directly</h3>
                  <p className="mb-1 text-base leading-7 text-zinc-500">For general questions, support, or feedback.</p>
                  <a href="mailto:info@quote-core.com" className="text-base font-semibold text-[#FF6B35] hover:underline">info@quote-core.com</a>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-50">
                  <svg className="h-5 w-5 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="mb-1 text-base font-semibold text-zinc-900">Book a free call</h3>
                  <p className="mb-1 text-base leading-7 text-zinc-500">15 minutes. No pitch. Just a straight conversation.</p>
                  <a
                    href="https://calendly.com/quote-core-info/15-minute-meeting"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base font-semibold text-[#FF6B35] hover:underline"
                  >
                    Book on Calendly &rarr;
                  </a>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-50">
                  <svg className="h-5 w-5 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="mb-1 text-base font-semibold text-zinc-900">Response time</h3>
                  <p className="text-base leading-7 text-zinc-500">We reply to all messages within 24 hours, usually much faster.</p>
                </div>
              </div>
            </div>

            {/* Reassurance box */}
            <div className="mt-10 rounded-2xl border border-zinc-100 bg-zinc-50 p-6">
              <p className="mb-2 text-base font-semibold text-zinc-800">What happens when you reach out?</p>
              <ul className="space-y-2 text-base leading-7 text-zinc-500">
                <li className="flex items-start gap-2"><span className="mt-0.5 text-[#FF6B35] font-bold">&#10003;</span> A real person reads your message</li>
                <li className="flex items-start gap-2"><span className="mt-0.5 text-[#FF6B35] font-bold">&#10003;</span> No automated sales sequences</li>
                <li className="flex items-start gap-2"><span className="mt-0.5 text-[#FF6B35] font-bold">&#10003;</span> Straight, useful answer - no fluff</li>
                <li className="flex items-start gap-2"><span className="mt-0.5 text-[#FF6B35] font-bold">&#10003;</span> Reply within 24 hours, often same day</li>
              </ul>
            </div>
          </div>

          {/* Right - form */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
            <h2 className="mb-1 text-2xl font-semibold text-zinc-900">Send us a message</h2>
            <p className="mb-6 text-base leading-7 text-zinc-500">Fill in what you can - we only need your name, email, and message.</p>

            <form
              className="space-y-5"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const data = Object.fromEntries(new FormData(form));
                setStatus("sending");
                try {
                  const res = await fetch("/api/contact", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                  });
                  if (res.ok) {
                    setStatus("success");
                  } else {
                    setStatus("error");
                  }
                } catch {
                  setStatus("error");
                }
              }}
            >
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-zinc-700 mb-1.5">
                  Your name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="First name or full name"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-100"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-zinc-700 mb-1.5">
                  Email address <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="you@company.com"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-100"
                />
              </div>

              <div>
                <label htmlFor="company" className="block text-sm font-semibold text-zinc-700 mb-1.5">
                  Company name <span className="text-xs font-normal text-zinc-400">(optional)</span>
                </label>
                <input
                  id="company"
                  name="company"
                  type="text"
                  placeholder="Your business name"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-100"
                />
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-semibold text-zinc-700 mb-1.5">
                  Subject <span className="text-xs font-normal text-zinc-400">(optional)</span>
                </label>
                <input
                  id="subject"
                  name="subject"
                  type="text"
                  placeholder="e.g. Question about pricing, Feature request..."
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-100"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-semibold text-zinc-700 mb-1.5">
                  Your message <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={5}
                  required
                  placeholder="Tell us what you need help with or what you'd like to know..."
                  className="w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-100"
                />
              </div>

              {status !== "success" && (
                <>
                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FF6B35] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#E55A28] disabled:opacity-60"
                  >
                    {status === "sending" ? "Sending..." : "Send message"}
                    {status !== "sending" && (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </button>
                  <p className="text-center text-xs text-zinc-400">We reply within 24 hours. No spam, ever.</p>
                </>
              )}

              {status === "success" && (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-6 py-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500 text-white text-xl font-bold">&#10003;</div>
                  <p className="font-bold text-zinc-900 text-lg">Message sent!</p>
                  <p className="text-sm text-zinc-500">We&apos;ll be in touch within 24 hours. Check your inbox - we&apos;ve sent you a copy too.</p>
                </div>
              )}

              {status === "error" && (
                <p className="text-center text-sm text-red-500">Something went wrong. Please email us directly at <a href="mailto:info@quote-core.com" className="underline">info@quote-core.com</a></p>
              )}
            </form>
          </div>
        </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
