"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { trackEvent } from "@/lib/analytics";
import SupplierApplicationModal from "./SupplierApplicationModal";

type SupplierCTAIntent = "free_setup" | "custom_package" | "learn_more" | "book_call" | "email";
type SupplierCTAVariant = "primary" | "accent" | "secondary" | "light" | "darkSecondary";

interface SupplierCTAProps {
  href: string;
  children: ReactNode;
  intent: SupplierCTAIntent;
  location: string;
  variant?: SupplierCTAVariant;
  className?: string;
}

const variantClasses: Record<SupplierCTAVariant, string> = {
  primary:
    "bg-black text-white hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30",
  accent:
    "bg-[#FF6B35] text-white hover:bg-[#E55A2B] hover:shadow-[0_0_14px_rgba(255,107,53,0.36)]",
  secondary:
    "border border-slate-300 bg-white text-slate-900 hover:border-[#FF6B35]/50 hover:bg-orange-50/40",
  light:
    "bg-white text-zinc-950 hover:shadow-[0_0_20px_rgba(255,107,53,0.34)]",
  darkSecondary:
    "border border-zinc-700 bg-zinc-900 text-white hover:border-[#FF6B35]/70 hover:bg-zinc-800",
};

export default function SupplierCTA({
  href,
  children,
  intent,
  location,
  variant = "primary",
  className = "",
}: SupplierCTAProps) {
  const [modalOpen, setModalOpen] = useState(false);

  // CTAs with intent "free_setup" or "custom_package" open the modal
  const opensModal = intent === "free_setup" || intent === "custom_package";

  if (opensModal) {
    return (
      <>
        <button
          type="button"
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:ring-offset-2 ${variantClasses[variant]} ${className}`}
          onClick={() => {
            setModalOpen(true);
            trackEvent("supplier_partnership_cta_click", { intent, location });
          }}
        >
          {children}
        </button>
        <SupplierApplicationModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  return (
    <a
      href={href}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:ring-offset-2 ${variantClasses[variant]} ${className}`}
      onClick={() =>
        trackEvent("supplier_partnership_cta_click", {
          intent,
          location,
        })
      }
    >
      {children}
    </a>
  );
}
