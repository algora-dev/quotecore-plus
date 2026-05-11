/**
 * Loading skeleton for /account/* pages.
 *
 * Next 16 uses this automatically while the route's server component is
 * fetching, so the user sees structure (sidebar still there, content area
 * pulses) instead of a frozen page. Cuts perceived navigation latency to
 * near-zero on the Account section even when the underlying queries are
 * still running.
 *
 * Matches the layout in `layout.tsx`: header card + two content blocks
 * standing in for the typical Account subpage shape (Profile / Company /
 * Security / Notifications all follow this pattern). The skeleton is
 * deliberately generic; we don't try to mimic exact card heights because
 * that risks layout shift when the real content arrives.
 */
export default function AccountLoading() {
  return (
    <section className="space-y-6 animate-pulse">
      <div>
        <div className="h-6 w-40 rounded bg-slate-200" />
        <div className="mt-2 h-3 w-72 rounded bg-slate-100" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="h-4 w-32 rounded bg-slate-200" />
        <div className="h-9 w-full rounded bg-slate-100" />
        <div className="h-9 w-3/4 rounded bg-slate-100" />
        <div className="h-9 w-32 rounded-full bg-slate-200" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="h-3 w-80 rounded bg-slate-100" />
        <div className="h-9 w-full rounded bg-slate-100" />
      </div>
    </section>
  );
}
