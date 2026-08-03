/**
 * Feature flag for Supplier Takeoff V2.
 * Disabled by default. Each phase enables its own piece behind this flag.
 * When false, the builder behaves identically to the current production version.
 *
 * Enable via env: SUPPLIER_TAKEOFF_V2=true (set in Vercel preview env to test).
 */
export function isSupplierTakeoffV2Enabled(): boolean {
  return process.env.SUPPLIER_TAKEOFF_V2 === 'true';
}
