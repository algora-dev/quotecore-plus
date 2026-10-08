"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

interface SupplierPageTrackerProps {
  supplierSlug: string;
  supplierName: string;
  hasCalculator: boolean;
  pageType: "directory" | "supplier_detail" | "supplier_calculator";
}

/**
 * Fires GA4 events when supplier-related pages are viewed.
 * No PII is tracked — only supplier slug, page type, and calculator availability.
 */
export function SupplierPageTracker({
  supplierSlug,
  supplierName,
  hasCalculator,
  pageType,
}: SupplierPageTrackerProps) {
  useEffect(() => {
    trackEvent("supplier_page_view", {
      page_type: pageType,
      supplier_slug: supplierSlug,
      supplier_name: supplierName,
      has_calculator: hasCalculator ? 1 : 0,
    });
  }, [supplierSlug, supplierName, hasCalculator, pageType]);

  return null;
}

/**
 * Fires when a user clicks the calculator link on a supplier page.
 */
export function SupplierCalculatorClickTracker({
  supplierSlug,
  supplierName,
}: {
  supplierSlug: string;
  supplierName: string;
}) {
  useEffect(() => {
    const handler = () => {
      trackEvent("supplier_calculator_click", {
        supplier_slug: supplierSlug,
        supplier_name: supplierName,
      });
    };
    // The link has data-track="supplier-calculator-cta"
    const link = document.querySelector('[data-track="supplier-calculator-cta"]');
    if (link) {
      link.addEventListener("click", handler);
      return () => link.removeEventListener("click", handler);
    }
  }, [supplierSlug, supplierName]);

  return null;
}
