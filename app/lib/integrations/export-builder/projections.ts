/**
 * Projections - data minimisation layer.
 *
 * Each connector receives only the fields it needs from the canonical export.
 * Sensitive scopes (internal costs, margins, labour) are excluded by default.
 */

import type { QuoteExportV1 } from '../contracts/envelope-v1';
import type { DataScopes } from '../contracts/connector';

/**
 * Apply data scope filtering to a quote export.
 * Returns a new object with sensitive fields stripped if not enabled.
 */
export function applyDataScopes(
  data: QuoteExportV1,
  scopes: DataScopes
): QuoteExportV1 {
  const projected: QuoteExportV1 = { ...data };

  // Strip internal notes if not enabled
  if (!scopes.internalNotes) {
    projected.quote = {
      ...projected.quote,
      internalNotes: null,
      assumptions: null,
    };
  }

  // Strip cost/margin data if not enabled
  if (!scopes.internalCosts && !scopes.marginInformation) {
    projected.components = projected.components.map((c) => ({
      ...c,
      materialRate: null,
      labourRate: null,
      materialCost: null,
      labourCost: null,
      overrideFlags: null,
    }));
  } else if (!scopes.internalCosts) {
    // Keep margins but strip raw costs
    projected.components = projected.components.map((c) => ({
      ...c,
      materialCost: null,
      labourCost: null,
    }));
  }

  if (!scopes.marginInformation) {
    projected.totals = {
      ...projected.totals,
      costTotals: {
        materialCost: '0',
        labourCost: '0',
        totalCost: '0',
      },
      marginTotals: {
        materialMargin: '0',
        labourMargin: '0',
        grossProfit: '0',
      },
    };
  }

  // Strip labour breakdown if not enabled
  if (!scopes.labourBreakdown) {
    projected.labourLines = null;
  }

  // Strip measurements/takeoff if not enabled
  if (!scopes.measurementsAndTakeoff) {
    projected.roofAreas = [];
    projected.components = projected.components.map((c) => ({
      ...c,
      entries: [],
      measurementType: null,
      inputMode: null,
      quantity: null,
      pricedQuantity: null,
      wastePercent: null,
      pitchDegrees: null,
      pricingStrategy: null,
    }));
  }

  // Strip files if not enabled
  if (!scopes.filesAndPlans) {
    projected.files = [];
    projected.documents = [];
  }

  // Strip acceptance details if not enabled
  if (!scopes.acceptanceDetails) {
    projected.acceptance = {
      status: projected.acceptance.status,
      acceptedAt: null,
      acceptedBy: null,
    };
  }

  // Strip customer details if not enabled
  if (!scopes.customerDetails) {
    projected.customer = {
      name: ' withheld',
      email: null,
      phone: null,
      billingAddress: null,
    };
  }

  // Strip site details if not enabled
  if (!scopes.siteDetails) {
    projected.site = {
      name: null,
      address: null,
      latitude: null,
      longitude: null,
      accessNotes: null,
    };
  }

  return projected;
}

/**
 * Simplified projection for Zapier - flat, webhook-friendly payload.
 */
export function toZapierPayload(
  data: QuoteExportV1,
  scopes: DataScopes
): Record<string, unknown> {
  const projected = applyDataScopes(data, scopes);

  return {
    event: 'quote_export',
    eventId: crypto.randomUUID(),
    quote: {
      id: projected.source.quoteId,
      number: projected.source.quoteNumber,
      status: projected.acceptance.status,
      currency: projected.totals.currency,
      total: projected.totals.customerTotals.totalIncludingTax,
      subtotal: projected.totals.customerTotals.subtotalExcludingTax,
      tax: projected.totals.customerTotals.taxTotal,
      quoteUrl: projected.source.quoteUrl,
    },
    customer: {
      name: projected.customer.name,
      email: projected.customer.email,
      phone: projected.customer.phone,
    },
    site: {
      name: projected.site.name,
      address: projected.site.address?.fullAddress ?? null,
    },
    job: {
      name: projected.job.name,
      trade: projected.job.trade,
    },
    company: {
      name: projected.company.name,
      email: projected.company.email,
      phone: projected.company.phone,
    },
    customerLines: projected.customerLines
      .filter((l) => l.visibleToCustomer)
      .map((l) => ({
        description: l.description,
        quantity: l.quantity,
        quantityText: l.quantityText,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
      })),
    customerLinesJson: JSON.stringify(
      projected.customerLines.filter((l) => l.visibleToCustomer)
    ),
    filesCount: projected.files.length,
    quotePdfUrl: projected.source.quoteUrl,
  };
}
