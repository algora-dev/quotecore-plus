/**
 * /account/billing — placeholder until paid plans ship.
 *
 * Kept as its own route so the URL/anchor exists in the sidebar from day
 * one. The page is intentionally minimal so users can see the section is
 * coming without us implying any plan / pricing prematurely.
 */
export default function BillingPage() {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Billing &amp; Subscription</h2>
        <p className="text-sm text-slate-500 mt-1">Manage your plan and payment details.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6" data-copilot="account-billing">
        <div className="p-6 bg-slate-50 rounded-xl text-center space-y-2">
          <p className="text-sm text-slate-700">
            You&apos;re currently on the <strong>Free Beta</strong> plan.
          </p>
          <p className="text-xs text-slate-400">
            Subscription plans and billing will be available soon.
          </p>
        </div>
      </div>
    </section>
  );
}
