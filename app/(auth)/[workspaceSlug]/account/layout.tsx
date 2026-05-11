/**
 * Shared shell for /account/*.
 *
 * Now intentionally minimal: every account experience lives inside the unified
 * tabbed page (`page.tsx`), which renders its own sidebar via `<AccountTabs>`.
 * The old multi-route shape (one route per tab) was deleted in favour of the
 * tabbed shell because route navigation introduced a noticeable server
 * round-trip on every tab switch.
 *
 * We keep this layout as a passthrough so:
 *   - Legacy redirect-shim routes (/account/company, /account/security, etc.)
 *     can still mount under /account/* and forward to /account?tab=...
 *   - Future per-tab nested routes (e.g. a deep ticket-detail page under
 *     /account/support/[id]) can be added without restructuring.
 */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
