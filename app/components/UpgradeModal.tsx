'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Props {
  open: boolean;
  /**
   * Modal title (e.g. "Digital takeoff is a paid feature").
   */
  title: string;
  /**
   * Body copy. Plain string; newlines render via whitespace-pre-line.
   * Keep it short - one sentence explaining what's gated and why.
   */
  description: string;
  /**
   * Plan code to highlight on the billing page. Optional; we pass it as a
   * query param so the billing page can scroll the right card into view.
   */
  recommendedPlan?: string;
  /**
   * Primary CTA label. Defaults to "View plans".
   */
  ctaLabel?: string;
  /**
   * Secondary "close" label. Defaults to "Not now".
   */
  closeLabel?: string;
  onClose: () => void;
}

/**
 * Reusable "you've hit a tier gate" modal. Replaces the previous mix of
 * native alert()s and bespoke per-gate dialogs.
 *
 * Usage pattern from any client component:
 *
 *   const [upgradeOpen, setUpgradeOpen] = useState(false);
 *   ...
 *   <UpgradeModal
 *     open={upgradeOpen}
 *     onClose={() => setUpgradeOpen(false)}
 *     title="Digital takeoff requires a paid plan"
 *     description="Upgrade your account to draw measurements on imported roof plans."
 *     recommendedPlan="growth"
 *   />
 *
 * The "View plans" button navigates to /<workspaceSlug>/account?tab=billing
 * with `&plan=<recommendedPlan>` so the upgrade-card with that code can be
 * highlighted server-side.
 */
export function UpgradeModal({
  open,
  title,
  description,
  recommendedPlan,
  ctaLabel = 'View plans',
  closeLabel = 'Not now',
  onClose,
}: Props) {
  const params = useParams();
  // Workspace slug is part of every authenticated route; fall back to '/' if
  // we're somehow rendered outside the workspace shell (shouldn't happen).
  const slug = typeof params?.workspaceSlug === 'string' ? params.workspaceSlug : '';
  const href = slug
    ? `/${slug}/account?tab=billing${recommendedPlan ? `&plan=${recommendedPlan}` : ''}`
    : `/account?tab=billing${recommendedPlan ? `&plan=${recommendedPlan}` : ''}`;

  // Close on Escape so keyboard users aren't trapped.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"

    >
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-amber-100 text-amber-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v.01M12 9v.01M12 3l9 16H3l9-16z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="upgrade-modal-title" className="text-lg font-semibold text-slate-900">
              {title}
            </h3>
            <p className="text-sm text-slate-500 mt-2 whitespace-pre-line break-words">
              {description}
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-full text-slate-700 hover:bg-slate-100"
          >
            {closeLabel}
          </button>
          <Link
            href={href}
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
