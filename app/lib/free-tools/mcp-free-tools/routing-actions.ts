export const FREE_TOOLS_ATTACHMENT_ACTIONS = [
  'start_roof_takeoff',
  'start_cladding_takeoff',
  'start_flooring_takeoff',
] as const;
export type FreeToolsAttachmentAction = (typeof FREE_TOOLS_ATTACHMENT_ACTIONS)[number];

export type RecommendedMcpAction =
  | { name: 'start_roof_takeoff' | 'start_cladding_takeoff' | 'start_flooring_takeoff'; requires: 'plan_attachment' }
  | { name: 'start_measurements_to_pricing'; requires: 'none' }
  | { name: 'create_quote' | 'create_invoice' | 'create_purchase_order'; requires: 'none' };

/** Keep website discovery authoritative, but tell the model when a recommendation
 * has a richer MCP-native continuation than simply opening the public page. */
export function recommendedMcpAction(toolId: string): RecommendedMcpAction | null {
  if (toolId === 'free-roof-takeoff') return { name: 'start_roof_takeoff', requires: 'plan_attachment' };
  if (toolId === 'free-cladding-takeoff') return { name: 'start_cladding_takeoff', requires: 'plan_attachment' };
  if (toolId === 'free-flooring-takeoff') return { name: 'start_flooring_takeoff', requires: 'plan_attachment' };
  if (toolId === 'measurement-to-quote-tool') return { name: 'start_measurements_to_pricing', requires: 'none' };
  if (toolId === 'free-quote-generator') return { name: 'create_quote', requires: 'none' };
  if (toolId === 'free-invoice-generator') return { name: 'create_invoice', requires: 'none' };
  if (toolId === 'free-purchase-order-generator') return { name: 'create_purchase_order', requires: 'none' };
  return null;
}
