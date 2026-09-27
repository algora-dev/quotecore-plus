'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { scheduleQuoteFollowUp } from '@/app/lib/messages/scheduled';
import type { ScheduledTriggerEvent } from '@/app/lib/messages/scheduled-types';

interface EmailTemplateOption {
  id: string;
  name: string;
  subject: string;
}

interface Props {
  quoteId: string;
  quote: {
    customer_name: string | null;
    accepted_at: string | null;
    declined_at: string | null;
  };
  /** Most recently used recipient email for this quote, if any.
   *  Pre-fills the recipient field. */
  defaultRecipientEmail: string | null;
  defaultRecipientName: string | null;
  emailTemplates: EmailTemplateOption[];
  /** Whether any prior quote_send manual message exists. Affects the
   *  default trigger choice (quote_sent if true, else manual). */
  hasPriorSend: boolean;
}

type UnitChoice = 'minutes' | 'hours' | 'days';

interface FormState {
  templateId: string;
  triggerEvent: ScheduledTriggerEvent;
  isInstant: boolean;
  wait: number;
  unit: UnitChoice;
  requireNoResponse: boolean;
  respectQuietHours: boolean;
  recipientEmail: string;
  recipientName: string;
}

/**
 * "Schedule follow-up" button + modal on the quote summary.
 *
 * Sits next to "Delete all" in the Sent Messages panel header. Opens a
 * modal that lets the user pick a template, trigger event, delay, and
 * recipient. On submit it calls `scheduleQuoteFollowUp` which writes a
 * row to `public.scheduled_messages` to be picked up by the Vercel
 * Cron dispatcher.
 *
 * Anti-pushy nudge: shows an inline warning (non-blocking) when the
 * delay is \u22642 days or when there are already 2+ scheduled rules on
 * this quote. We never hard-block here because the user knows their
 * customer better than we do.
 */
export function ScheduleFollowUpButton({
  quoteId,
  quote,
  defaultRecipientEmail,
  defaultRecipientName,
  emailTemplates,
  hasPriorSend,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const defaultTrigger: ScheduledTriggerEvent = hasPriorSend ? 'quote_sent' : 'manual';

  const [form, setForm] = useState<FormState>({
    templateId: emailTemplates[0]?.id ?? '',
    triggerEvent: defaultTrigger,
    isInstant: false,
    wait: 7,
    unit: 'days',
    requireNoResponse: true,
    respectQuietHours: true,
    recipientEmail: defaultRecipientEmail ?? '',
    recipientName: defaultRecipientName ?? quote.customer_name ?? '',
  });

  // Compute the projected fire time client-side so the user sees what
  // they're about to schedule. The server applies the SAME quiet-hours
  // logic when it inserts the row; if the values disagree it'll be
  // because the server clock or quiet-hours rule has shifted, in which
  // case the server wins.
  const projectedFire = useMemo(() => {
    const now = new Date();
    if (form.isInstant) return now;
    const ms =
      form.unit === 'days'
        ? form.wait * 24 * 60 * 60 * 1000
        : form.unit === 'hours'
          ? form.wait * 60 * 60 * 1000
          : form.wait * 60 * 1000;
    let candidate = new Date(now.getTime() + ms);
    if (form.respectQuietHours) {
      candidate = applyQuietHoursClient(candidate);
    }
    return candidate;
  }, [form.isInstant, form.wait, form.unit, form.respectQuietHours]);

  // Show warning when instant or short delay.
  const isPushyDelay = form.isInstant ||
    (form.unit === 'days' && form.wait <= 2) ||
    (form.unit === 'hours' && form.wait <= 48) ||
    (form.unit === 'minutes' && form.wait <= 120);

  const isEventTrigger =
    form.triggerEvent === 'quote_accepted' ||
    form.triggerEvent === 'quote_declined' ||
    form.triggerEvent === 'quote_revision_requested';

  const canSubmit =
    !!form.templateId &&
    (form.isInstant || form.wait > 0) &&
    form.recipientEmail.trim().length > 0 &&
    !isPending;

  function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const waitDays = form.isInstant ? 0 : (form.unit === 'days' ? form.wait : 0);
      const waitHours = form.isInstant ? 0 : (form.unit === 'hours' ? form.wait : 0);
      const waitMinutes = form.isInstant ? 0 : (form.unit === 'minutes' ? form.wait : 0);
      const result = await scheduleQuoteFollowUp({
        quoteId,
        templateId: form.templateId,
        triggerEvent: form.triggerEvent,
        waitDays,
        waitHours,
        waitMinutes,
        requireNoResponse: form.requireNoResponse,
        respectQuietHours: form.respectQuietHours,
        recipientEmail: form.recipientEmail,
        recipientName: form.recipientName || null,
      });
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  // Trigger options. Each option is only selectable when the quote
  // is actually in a state that can anchor it (e.g. "after the
  // customer accepted" needs accepted_at stamped). The disabled-
  // reason copy tells the user EXACTLY why an option is greyed out
  // so they don't think the feature is broken.
  const triggerOptions: {
    value: ScheduledTriggerEvent;
    label: string;
    available: boolean;
    disabledReason?: string;
  }[] = [
    {
      value: 'quote_sent',
      label: 'After the quote was sent',
      available: hasPriorSend,
      disabledReason: 'Send the quote at least once first',
    },
    {
      // Pre-event scheduling supported: row is parked with sentinel
      // timestamps until the customer actually accepts, then the
      // accept handler activates it.
      value: 'quote_accepted',
      label: quote.accepted_at ? 'After the customer accepted' : 'After the customer accepts (when it happens)',
      available: true,
    },
    {
      value: 'quote_declined',
      label: quote.declined_at ? 'After the customer declined' : 'After the customer declines (when it happens)',
      available: true,
    },
    {
      value: 'manual',
      label: 'Starting now',
      available: true,
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Schedule follow-up
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Schedule a follow-up</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Template */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email template</label>
                {emailTemplates.length === 0 ? (
                  <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                    You don&apos;t have any email templates yet. Create one in Settings &rarr; Email templates first.
                  </p>
                ) : (
                  <select
                    value={form.templateId}
                    onChange={(e) => setForm((f) => ({ ...f, templateId: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    {emailTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Trigger */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Trigger</label>
                <select
                  value={form.triggerEvent}
                  onChange={(e) => setForm((f) => ({ ...f, triggerEvent: e.target.value as ScheduledTriggerEvent }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {triggerOptions.map((opt) => (
                    <option key={opt.value} value={opt.value} disabled={!opt.available}>
                      {opt.label}
                      {!opt.available && opt.disabledReason ? ` - ${opt.disabledReason}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Delay */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Wait</label>
                {isEventTrigger ? (
                  <label className="flex items-center gap-2 text-sm text-slate-700 mb-2">
                    <input
                      type="checkbox"
                      checked={form.isInstant}
                      onChange={(e) => setForm((f) => ({ ...f, isInstant: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    Instant (fire immediately when the event happens)
                  </label>
                ) : null}
                {!form.isInstant ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={form.wait}
                      onChange={(e) => setForm((f) => ({ ...f, wait: Number(e.target.value) || 0 }))}
                      className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <select
                      value={form.unit}
                      onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value as UnitChoice }))}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                      <option value="minutes">minutes</option>
                      <option value="hours">hours</option>
                      <option value="days">days</option>
                    </select>
                    <span className="text-xs text-slate-500 flex-1">
                      after {triggerOptions.find((t) => t.value === form.triggerEvent)?.label.toLowerCase()}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Fires immediately when {triggerOptions.find((t) => t.value === form.triggerEvent)?.label.toLowerCase()}
                  </p>
                )}
              </div>

              {/* Recipient */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Recipient email</label>
                  <input
                    type="email"
                    value={form.recipientEmail}
                    onChange={(e) => setForm((f) => ({ ...f, recipientEmail: e.target.value }))}
                    placeholder="customer@example.com"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Recipient name (optional)</label>
                  <input
                    type="text"
                    value={form.recipientName}
                    onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
                    placeholder={quote.customer_name ?? ''}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Safety toggles. The "cancel if customer responds"
                  gate only applies to chase-type triggers (quote_sent,
                  manual). For event-triggered rules the event IS the
                  response so cancelling on it makes the rule incapable
                  of ever firing. Hidden in that case. */}
              <div className="space-y-2 pt-1">
                {form.triggerEvent === 'quote_sent' || form.triggerEvent === 'manual' ? (
                  <label className="flex items-start gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.requireNoResponse}
                      onChange={(e) => setForm((f) => ({ ...f, requireNoResponse: e.target.checked }))}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <span>
                      Cancel automatically if the customer accepts, declines, or requests a change first.
                      <span className="block text-slate-400">Recommended. Stops the follow-up firing after the customer has already replied.</span>
                    </span>
                  </label>
                ) : (
                  <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    Event follow-ups fire when the trigger event happens - the customer&apos;s response IS what activates this rule, so it won&apos;t auto-cancel on their action.
                  </p>
                )}
                <label className="flex items-start gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.respectQuietHours}
                    onChange={(e) => setForm((f) => ({ ...f, respectQuietHours: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span>
                    Avoid evenings (8pm–8am) and weekends.
                    <span className="block text-slate-400">If the calculated time falls inside the quiet window, we push it to the next allowed slot.</span>
                  </span>
                </label>
              </div>

              {/* Preview + nudge. For pre-event triggers (no
                  accepted_at / declined_at yet) we can't compute a
                  real fire time - the wait clock starts when the
                  event happens. Show wait-window copy instead. */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {form.triggerEvent === 'quote_accepted' && !quote.accepted_at ? (
                  <p>
                    Parked until the customer accepts. Then fires{' '}
                    {form.isInstant
                      ? 'instantly'
                      : `${form.wait} ${
                          form.unit === 'days'
                            ? form.wait === 1 ? 'day' : 'days'
                            : form.unit === 'hours'
                              ? form.wait === 1 ? 'hour' : 'hours'
                              : form.wait === 1 ? 'minute' : 'minutes'
                        } later`}
                    .
                  </p>
                ) : form.triggerEvent === 'quote_declined' && !quote.declined_at ? (
                  <p>
                    Parked until the customer declines. Then fires{' '}
                    {form.isInstant
                      ? 'instantly'
                      : `${form.wait} ${
                          form.unit === 'days'
                            ? form.wait === 1 ? 'day' : 'days'
                            : form.unit === 'hours'
                              ? form.wait === 1 ? 'hour' : 'hours'
                              : form.wait === 1 ? 'minute' : 'minutes'
                        } later`}
                    .
                  </p>
                ) : (
                  <p>
                    Will send around{' '}
                    <span className="font-semibold text-slate-900">
                      {projectedFire.toLocaleString('en-GB', {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>{' '}
                    <span className="text-slate-400">(your timezone)</span>
                  </p>
                )}
              </div>

              {isPushyDelay ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Heads-up: a short delay can come across as pushy. Try send follow ups even 10 minutes after the event happens.
                </div>
              ) : null}

              {error ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="px-4 py-2 text-sm font-medium rounded-full bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
              >
                {isPending ? 'Scheduling\u2026' : 'Schedule send'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * Client-side mirror of the server's `applyQuietHours`. Kept in sync
 * with `app/lib/messages/scheduled.ts`. If the rules diverge the user
 * will see a slightly different time on the modal preview vs the row
 * the server actually creates; the server wins.
 */
function applyQuietHoursClient(date: Date): Date {
  const out = new Date(date.getTime());
  const day = out.getUTCDay();
  if (day === 6) {
    out.setUTCDate(out.getUTCDate() + 2);
    out.setUTCHours(8, 0, 0, 0);
    return out;
  }
  if (day === 0) {
    out.setUTCDate(out.getUTCDate() + 1);
    out.setUTCHours(8, 0, 0, 0);
    return out;
  }
  const hour = out.getUTCHours();
  if (hour >= 20) {
    out.setUTCDate(out.getUTCDate() + 1);
    out.setUTCHours(8, 0, 0, 0);
    return applyQuietHoursClient(out);
  }
  if (hour < 8) {
    out.setUTCHours(8, 0, 0, 0);
    return out;
  }
  return out;
}
