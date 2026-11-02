'use client';

import { DoneForYouInquiryButton } from "@/components/marketing/DoneForYouInquiryButton";

/** Tracked Done For You conversion CTA. */
export default function DfyCtaButton({ event, label = "Inquire about Done For You", variant = "primary" }: { event: string; label?: string; variant?: "primary" | "outline"; }) {
  return <DoneForYouInquiryButton source={event} variant={variant === "primary" ? "primary" : "glass"} size="large">{label}</DoneForYouInquiryButton>;
}
