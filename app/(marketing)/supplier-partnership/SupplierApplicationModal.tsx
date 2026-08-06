"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";

type Status = "idle" | "submitting" | "success" | "error";

export default function SupplierApplicationModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [hasAccount, setHasAccount] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    const form = e.currentTarget;
    const formData = new FormData(form);
    const payload = {
      has_account: hasAccount,
      account_email: (formData.get("account_email") as string)?.trim() ?? "",
      business_name: (formData.get("business_name") as string)?.trim() ?? "",
      website: (formData.get("website") as string)?.trim() ?? "",
      contact_person: (formData.get("contact_person") as string)?.trim() ?? "",
      contact_email: (formData.get("contact_email") as string)?.trim() ?? "",
      location: (formData.get("location") as string)?.trim() ?? "",
      message: (formData.get("message") as string)?.trim() ?? "",
    };

    fetch("/api/supplier-application", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Something went wrong");
        }
        setStatus("success");
        trackEvent("supplier_application_submit", { has_account: String(hasAccount) });
      })
      .catch((err) => {
        setStatus("error");
        setErrorMsg(err.message || "Failed to submit. Please try again.");
      });
  }

  function handleClose() {
    setStatus("idle");
    setErrorMsg("");
    setHasAccount(null);
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {status === "success" ? (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-slate-900">Application received</h2>
            <p className="mt-2 text-sm text-slate-600">
              Thanks for your interest in becoming a QuoteCore+ supplier partner. We&apos;ll review your details and get back to you within 1–2 business days.
            </p>
            <button
              onClick={handleClose}
              className="mt-6 inline-flex items-center justify-center rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Become a supplier partner</h2>
                <p className="text-xs text-slate-500 mt-0.5">Takes less than a minute</p>
              </div>
              <button
                onClick={handleClose}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                aria-label="Close"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {/* Account toggle */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Do you already have a QuoteCore+ account?
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setHasAccount(true)}
                    className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                      hasAccount === true
                        ? "bg-slate-900 text-white"
                        : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasAccount(false)}
                    className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                      hasAccount === false
                        ? "bg-slate-900 text-white"
                        : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              {/* Account/preferred email */}
              <div>
                <label htmlFor="account_email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  {hasAccount === true ? "Your account email" : "Email you'll use to create an account"}
                </label>
                <input
                  id="account_email"
                  name="account_email"
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none transition"
                  placeholder={hasAccount === true ? "you@business.com" : "you@business.com"}
                />
              </div>

              {/* Business name */}
              <div>
                <label htmlFor="business_name" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Business name
                </label>
                <input
                  id="business_name"
                  name="business_name"
                  type="text"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none transition"
                  placeholder="Acme Roofing Supplies"
                />
              </div>

              {/* Website */}
              <div>
                <label htmlFor="website" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Website
                </label>
                <input
                  id="website"
                  name="website"
                  type="url"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none transition"
                  placeholder="https://www.acmeroofing.com"
                />
              </div>

              {/* Contact person */}
              <div>
                <label htmlFor="contact_person" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Contact person
                </label>
                <input
                  id="contact_person"
                  name="contact_person"
                  type="text"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none transition"
                  placeholder="John Smith"
                />
              </div>

              {/* Contact email */}
              <div>
                <label htmlFor="contact_email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Contact email
                </label>
                <input
                  id="contact_email"
                  name="contact_email"
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none transition"
                  placeholder="john@acmeroofing.com"
                />
              </div>

              {/* Location */}
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Location <span className="text-slate-400 font-normal">(country + city/state)</span>
                </label>
                <input
                  id="location"
                  name="location"
                  type="text"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none transition"
                  placeholder="UK, London"
                />
              </div>

              {/* Optional message */}
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Anything else? <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none transition resize-none"
                  placeholder="Tell us about your products or what you're looking for..."
                />
              </div>

              {errorMsg && (
                <p className="text-sm text-red-600">{errorMsg}</p>
              )}

              {/* Submit */}
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={status === "submitting" || hasAccount === null}
                  className="inline-flex items-center justify-center rounded-full bg-[#BD4A1A] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#9E3E16] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === "submitting" ? "Submitting..." : "Submit application"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
