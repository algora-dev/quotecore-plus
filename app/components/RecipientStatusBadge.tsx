'use client';

/**
 * Recipient-driven status pill shown in the Status column of the main
 * Quotes / Orders / Invoices lists (Message Center Phase 3).
 *
 * Two recipient states, surfaced ALONGSIDE the owner's status control so the
 * owner can still drive their own lifecycle status:
 *   - 'action_required'  -> "Action Required" (dispute opened OR change
 *      requested from an order/quote). Highest priority.
 *   - 'read'             -> "Read" (recipient opened the public link).
 *
 * `null` renders nothing (keeps untouched rows visually clean).
 *
 * Internal codes are stable ('action_required' / 'read'); the user-visible
 * label for action_required is ALWAYS "Action Required" (never "Action
 * Needed").
 */

export type RecipientStatus = 'action_required' | 'read' | null;

const CONFIG: Record<'action_required' | 'read', { label: string; cls: string; dot: string }> = {
  action_required: {
    label: 'Action Required',
    cls: 'bg-amber-50 text-amber-700 border-amber-300',
    dot: 'bg-amber-500',
  },
  read: {
    label: 'Read',
    cls: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
  },
};

export function RecipientStatusBadge({ status }: { status: RecipientStatus }) {
  if (!status) return null;
  const cfg = CONFIG[status];
  return (
    <span
      title={status === 'action_required' ? 'Action required from a dispute or change request' : 'The recipient has opened this'}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${cfg.cls}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
