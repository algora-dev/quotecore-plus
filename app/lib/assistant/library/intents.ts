/**
 * AI Assistant — Authored Workflow Intents (Stage 2)
 * ===================================================
 * The ONLY net-new authored data in the workflow library. A map of
 * workflow id → natural-language phrasings a user might type that should map
 * to that workflow. Authored by reading the guide name + step content, NOT
 * derived by code.
 *
 * These feed the keyword candidate-finder (findWorkflowsByIntent). They are
 * deliberately phrased the way a roofer/estimator would actually ask ("quote a
 * job", "send it to my customer", "order materials"). 3-6 per workflow.
 *
 * NOTE on the cross-page example (Shaun): the quote-builder workflow includes
 * "add a component to a quote" / "add a component to this quote" — a user on
 * the Components page who says "add a component" often means adding one to a
 * QUOTE (quote-builder), not creating a library component (`components`). Both
 * surface as candidates; the chatbot disambiguates using browser facts.
 *
 * Keyed by guide id. Both roofing and generic guide sets share the same ids,
 * so one map covers both trades. Ids with no entry fall back to [] (the
 * candidate-finder still scores on name + summary).
 */

import type { LibraryTrade } from './types';

/** Phrasings shared across both trades, keyed by workflow id. */
const BASE_INTENTS: Record<string, string[]> = {
  components: [
    'create a component',
    'add a component to my library',
    'set up my materials and labour items',
    'edit a component',
    'build my component library',
  ],
  'create-quote': [
    'create a quote',
    'start a new quote',
    'make a quote',
    'quote a job',
    'set up a new quote with customer details',
  ],
  'quote-builder': [
    'build my quote',
    'add a roof area',
    'add a component to a quote',
    'add a component to this quote',
    'assign materials to a roof area',
    'set my profit margins and confirm the quote',
  ],
  'customer-labor': [
    'create a customer quote',
    'send the quote to my customer',
    'make a professional quote for the client',
    'email the quote to my customer',
    'share a quote link with my customer',
  ],
  'labor-sheet': [
    'create a labor sheet',
    'make a labour-only breakdown',
    'quote for a subcontractor',
    'hide material prices for the subbie',
    'send a labour sheet',
  ],
  'digital-quote-builder': [
    'finish my digital takeoff quote',
    'review my digital takeoff in the builder',
    'edit a quote from a digital takeoff',
    'confirm a quote built from a roof plan',
  ],
  'digital-takeoff': [
    'measure a roof plan',
    'do a digital takeoff',
    'measure off an uploaded roof plan',
    'use the takeoff tools',
    'measure areas and lengths on screen',
  ],
  'flashing-draw': [
    'draw a flashing',
    'create a flashing profile',
    'sketch a custom flashing with measurements',
    'design a barge or ridge flashing',
  ],
  'account-settings': [
    'change my account settings',
    'update my company details',
    'change my password or 2fa',
    'manage notifications and billing',
    'where are my settings',
  ],
  'flashings-orders': [
    'open my flashings library',
    'manage my flashing designs',
    'start a new flashing drawing',
  ],
  'material-orders-hub': [
    'order materials',
    'create a material order',
    'order materials from a quote',
    'set up a supplier order',
    'go to material orders',
  ],
  'material-order-create': [
    'build a material order',
    'customise a material order',
    'add items to a supplier order',
    'set up supplier details on an order',
    'save and print a material order',
  ],
  'catalog-upload': [
    'upload a catalog',
    'import a supplier price list',
    'add a CSV price list',
    'map columns in my catalog',
    'how do I get supplier prices into the app',
    'create a catalog',
  ],
  'catalog-add-to-quote': [
    'add a catalog item to a quote',
    'search catalog on a quote',
    'find a supplier price and add it to my quote',
    'insert a priced item from my catalog',
    'use my catalog when quoting',
  ],
  'attachments-upload': [
    'upload a file to my attachment library',
    'add a file to my attachment library',
    'upload an attachment',
    'add images to my attachment library',
    'store a document for reuse',
    'how do I upload attachments',
  ],
  'attachments-send': [
    'send a quote with an attachment',
    'attach a file to a quote',
    'attach a file when sending a quote',
    'send images to a customer with a quote',
    'include a document when I send a quote',
    'add an attachment to a quote I am sending',
    'how do I send a quote with an attachment',
  ],
  'order-line-by-line': [
    'build a line by line material order',
    'create a text list order for a supplier',
    'make a priced line order',
    'order materials with individual line items',
    'create a material order with prices',
  ],
  'order-from-quote': [
    'create an order from a quote',
    'order materials from a quote',
    'pre-populate a material order',
    'turn a quote into a material order',
    'order from my quote',
    'order materials for a job',
  ],
  // ── Invoices (added 2026-06-07) ──
  'invoices-hub': [
    'create an invoice',
    'make an invoice',
    'go to invoices',
    'open my invoice library',
    'view my invoices',
    'send an invoice to a customer',
  ],
  'invoice-from-quote': [
    'create an invoice from a quote',
    'turn a quote into an invoice',
    'invoice a quote',
    'generate an invoice from my quote',
    'convert a quote to invoice',
  ],
  'invoice-blank': [
    'create a blank invoice',
    'new blank invoice',
    'make an invoice from scratch',
    'build an invoice manually',
  ],
  'invoice-send': [
    'send an invoice',
    'share an invoice link',
    'email an invoice to a customer',
    'how do I send an invoice',
  ],
  'invoice-payment': [
    'confirm invoice payment',
    'mark invoice as paid',
    'customer said they paid',
    'payment reported on invoice',
    'confirm payment received',
  ],
};

/**
 * Resolve the authored intents for a workflow id. Trade is accepted for future
 * trade-specific phrasing divergence; today both trades share BASE_INTENTS.
 */
export function intentsForWorkflow(
  id: string,
  _trade: LibraryTrade
): string[] {
  return BASE_INTENTS[id] ?? [];
}

/** Exposed for review/tests. */
export const WORKFLOW_INTENTS = BASE_INTENTS;
