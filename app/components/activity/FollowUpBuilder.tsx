'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  scheduleQuoteFollowUp,
  scheduleOrderFollowUp,
  scheduleInvoiceFollowUp,
} from '@/app/lib/messages/scheduled';
import type { ScheduledTriggerEvent } from '@/app/lib/messages/scheduled-types';

/**
 * Shared follow-up rule builder used by the Activity card's "Schedule
 * follow-up" button across quotes / orders / invoices.
 *
 * Deliberately mirrors the SEND-TIME builder embedded in
 * SendQuoteButton / SendOrderButton / SendInvoiceButton (the
 * 'followups' stage): the user adds up to 3 rules, each either a
 * "Triggered follow-up" (fires on an event, optional delay) or a
 * "Time-based follow-up" (a chase that fires after a delay and cancels
 * on response). Same rule-card layout, same add-buttons, same delay
 * inputs, same "Scheduled ✓" feedback - so a user who has sent before
 * recognises this instantly.
 *
 * Difference from the send-time builder: this one does NOT run a send
 * afterwards. It just persists the scheduled_messages rows via the
 * per-entity schedule action and refreshes. Triggers are entity-driven.
 */

type EntityKind = 'quote' | 'order' | 'invoice';
type FollowUpKind = 'triggered' | 'time_based';

interface EmailTemplateOption {
  id: string;
  name: string;
  subject: string;
  is_default?: boolean | null;
}

interface Props {
  kind: EntityKind;
  entityId: string;
  emailTemplates: EmailTemplateOption[];
  defaultRecipientEmail: string | null;
  defaultRecipientName: string | null;
  /** Called after at least one rule persists OK (parent closes + refreshes). */
  onDone?: () => void;
}

// Per-entity trigger config. `chase` is the time-based anchor trigger;
// `triggers` are the event options shown in the Triggered rule picker.
const ENTITY_CONFIG: Record<
  EntityKind,
  {
    chase: ScheduledTriggerEvent;
    triggers: { value: ScheduledTriggerEvent; label: string }[];
    chaseHint: string;
  }
> = {
  quote: {
    chase: 'quote_sent',
    triggers: [
      { value: 'quote_accepted', label: 'Quote accepted' },
      { value: 'quote_declined', label: 'Quote declined' },
      { value: 'quote_revision_requested', label: 'Dispute / change requested' },
      { value: 'quote_viewed', label: 'On read (opened, no response)' },
    ],
    chaseHint:
      'Chases the customer if they don’t respond. Auto-cancels when they reply, accept, or decline. Respects quiet hours.',
  },
  order: {
    chase: 'order_sent',
    triggers: [
      { value: 'order_accepted', label: 'Order accepted' },
      { value: 'order_declined', label: 'Order declined' },
      { value: 'order_viewed', label: 'On read (opened, no response)' },
    ],
    chaseHint:
      'Chases the supplier if they don’t respond. Auto-cancels when they accept, decline, or request info. Respects quiet hours.',
  },
  invoice: {
    chase: 'invoice_sent',
    triggers: [
      { value: 'invoice_viewed', label: 'On read (opened, no response)' },
    ],
    chaseHint:
      'Chases the customer if they don’t pay. Auto-cancels when they report payment, pay, or dispute. Respects quiet hours.',
  },
};

interface DraftRule {
  id: string;
  kind: FollowUpKind;
  trigger: ScheduledTriggerEvent;
  addDelay: boolean;
  delayDays: number;
  delayHours: number;
  delayMinutes: number;
  templateId: string;
  result: { ok: true; fireAt: string } | { ok: false; error: string } | null;
}

export function FollowUpBuilder({
  kind,
  entityId,
  emailTemplates,
  defaultRecipientEmail,
  defaultRecipientName,
  onDone,
}: Props) {
  const router = useRouter();
  const cfg = ENTITY_CONFIG[kind];

  const [draftRules, setDraftRules] = useState<DraftRule[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Editable recipient: prefilled from the item's associated contact email
  // (prior send history, else the entity's stored supplier/customer email).
  // The user can override it, or type one in when none is on file - so a
  // missing email is no longer a dead-end. Mirrors the send-time builder,
  // which already lets the user edit the recipient before sending.
  const [recipientEmail, setRecipientEmail] = useState(defaultRecipientEmail ?? '');

  function defaultTemplateId(): string {
    const def = emailTemplates.find((t) => t.is_default) || emailTemplates[0];
    return def?.id ?? '';
  }

  const usedTriggers = new Set(
    draftRules.filter((r) => r.kind === 'triggered').map((r) => r.trigger),
  );

  function addDraftRule(ruleKind: FollowUpKind) {
    setError(null);
    if (draftRules.length >= 3) {
      setError('You can add at most 3 follow-ups.');
      return;
    }
    if (ruleKind === 'triggered') {
      const free = cfg.triggers.find((t) => !usedTriggers.has(t.value));
      if (!free) {
        setError('All available triggers already have a follow-up.');
        return;
      }
      setDraftRules((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          kind: 'triggered',
          trigger: free.value,
          addDelay: false,
          delayDays: 0,
          delayHours: 0,
          delayMinutes: 0,
          templateId: defaultTemplateId(),
          result: null,
        },
      ]);
    } else {
      setDraftRules((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          kind: 'time_based',
          trigger: cfg.chase,
          addDelay: true,
          delayDays: 3,
          delayHours: 0,
          delayMinutes: 0,
          templateId: defaultTemplateId(),
          result: null,
        },
      ]);
    }
  }

  function updateDraftRule(id: string, patch: Partial<DraftRule>) {
    setDraftRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeDraftRule(id: string) {
    setError(null);
    setDraftRules((prev) => prev.filter((r) => r.id !== id));
  }

  async function persistRule(rule: DraftRule) {
    const isTriggered = rule.kind === 'triggered';
    const triggerEvent: ScheduledTriggerEvent = isTriggered ? rule.trigger : cfg.chase;
    const waitDays = isTriggered ? (rule.addDelay ? rule.delayDays : 0) : rule.delayDays;
    const waitHours = isTriggered ? (rule.addDelay ? rule.delayHours : 0) : rule.delayHours;
    const waitMinutes = isTriggered ? (rule.addDelay ? rule.delayMinutes : 0) : rule.delayMinutes;
    const common = {
      templateId: rule.templateId,
      triggerEvent,
      waitDays,
      waitHours,
      waitMinutes,
      // Time-based chase cancels on response; triggered rules don't.
      requireNoResponse: !isTriggered,
      respectQuietHours: true,
      recipientEmail: recipientEmail.trim(),
      recipientName: defaultRecipientName ?? null,
    };
    if (kind === 'quote') return scheduleQuoteFollowUp({ quoteId: entityId, ...common });
    if (kind === 'order') return scheduleOrderFollowUp({ orderId: entityId, ...common });
    return scheduleInvoiceFollowUp({ invoiceId: entityId, ...common });
  }

  async function handleSave() {
    const rules = draftRules.filter((r) => r.templateId);
    if (rules.length === 0) {
      setError('Add at least one follow-up with a template.');
      return;
    }
    const email = recipientEmail.trim();
    if (!email || !/^.+@.+\..+$/.test(email)) {
      setError('Enter a valid recipient email for these follow-ups.');
      return;
    }
    setSaving(true);
    setError(null);
    let anyOk = false;
    for (const rule of rules) {
      try {
        const result = await persistRule(rule);
        updateDraftRule(
          rule.id,
          result.ok
            ? { result: { ok: true, fireAt: result.fireAt } }
            : { result: { ok: false, error: result.error } },
        );
        if (result.ok) anyOk = true;
      } catch (err) {
        updateDraftRule(rule.id, {
          result: { ok: false, error: err instanceof Error ? err.message : 'Failed' },
        });
      }
    }
    setSaving(false);
    if (anyOk) {
      router.refresh();
      onDone?.();
    }
  }

  if (emailTemplates.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-xs text-slate-500">
          You have no message templates yet - follow-ups need one. Create one in Resources → Templates first.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-900">Add follow-ups</p>
        <span className="text-xs text-slate-500">{draftRules.length} / 3</span>
      </div>

      {/* Recipient email - editable, prefilled from the item's contact email.
          Lets the user confirm/override the address, or supply one when none
          is on file (e.g. an order/quote/invoice sent without a stored email). */}
      <div className="space-y-1">
        <label htmlFor="followup-recipient" className="block text-xs font-medium text-slate-600">
          Send follow-ups to
        </label>
        <input
          id="followup-recipient"
          type="email"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          placeholder="name@example.com"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20"
        />
        {!defaultRecipientEmail && (
          <p className="text-xs text-slate-400">
            No email was on file for this item - enter the recipient address above.
          </p>
        )}
      </div>

      {/* Add buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => addDraftRule('triggered')}
          disabled={draftRules.length >= 3}
          className="px-3 py-1.5 text-xs font-semibold rounded-full bg-black text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Triggered follow-up
        </button>
        <button
          type="button"
          onClick={() => addDraftRule('time_based')}
          disabled={draftRules.length >= 3}
          className="px-3 py-1.5 text-xs font-semibold rounded-full bg-black text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Time-based follow-up
        </button>
      </div>

      {draftRules.length === 0 ? (
        <p className="text-[11px] text-slate-500">
          Add a follow-up above to get started - choose a trigger-based rule (fires on an event) or a time-based chase. You can add up to 3.
        </p>
      ) : null}

      {draftRules.map((rule) => {
        const isTriggered = rule.kind === 'triggered';
        const isErr = rule.result && !rule.result.ok;
        const isOk = rule.result?.ok === true;
        return (
          <div
            key={rule.id}
            className={`rounded-xl border p-3 space-y-2 ${
              isOk ? 'border-emerald-200 bg-emerald-50' : isErr ? 'border-rose-200 bg-rose-50/60' : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-900">
                {isTriggered ? 'Triggered follow-up' : 'Time-based follow-up'}
              </span>
              <button
                type="button"
                onClick={() => removeDraftRule(rule.id)}
                className="text-slate-400 hover:text-rose-600 text-sm leading-none p-1"
                aria-label="Remove follow-up"
              >
                ✕
              </button>
            </div>

            {isTriggered ? (
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Trigger event</label>
                  <select
                    value={rule.trigger}
                    onChange={(e) => updateDraftRule(rule.id, { trigger: e.target.value as ScheduledTriggerEvent })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
                  >
                    {cfg.triggers.map((t) => {
                      const usedElsewhere = draftRules.some(
                        (r) => r.id !== rule.id && r.kind === 'triggered' && r.trigger === t.value,
                      );
                      return (
                        <option key={t.value} value={t.value} disabled={usedElsewhere}>
                          {t.label}
                          {usedElsewhere ? ' (already added)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rule.addDelay}
                    onChange={(e) => updateDraftRule(rule.id, { addDelay: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-xs text-slate-700">Add time delay (otherwise fires immediately)</span>
                </label>
                {rule.addDelay ? <DelayInputs rule={rule} update={updateDraftRule} /> : null}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-500">{cfg.chaseHint}</p>
                <DelayInputs rule={rule} update={updateDraftRule} />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Template</label>
              <select
                value={rule.templateId}
                onChange={(e) => updateDraftRule(rule.id, { templateId: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
              >
                {emailTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.is_default ? ' (Default)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {isOk ? <p className="text-[10px] text-emerald-700">Scheduled ✓</p> : null}
            {isErr ? (
              <p className="text-[11px] text-rose-700">{(rule.result as { ok: false; error: string }).error}</p>
            ) : null}
          </div>
        );
      })}

      {error ? (
        <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">{error}</p>
      ) : null}

      <div className="flex items-center justify-end pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || draftRules.length === 0}
          className="px-4 py-2 text-sm font-medium rounded-full bg-[#FF6B35] text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
        >
          {saving ? 'Saving…' : 'Save follow-ups'}
        </button>
      </div>
    </div>
  );
}

function DelayInputs({
  rule,
  update,
}: {
  rule: DraftRule;
  update: (id: string, patch: Partial<DraftRule>) => void;
}) {
  return (
    <div className="flex items-end gap-2">
      <div className="w-24">
        <label className="block text-[10px] font-medium text-slate-500 mb-0.5"># days</label>
        <input
          type="number"
          min={0}
          max={365}
          value={rule.delayDays}
          onChange={(e) => update(rule.id, { delayDays: Math.max(0, Math.min(365, Number(e.target.value) || 0)) })}
          className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
        />
      </div>
      <div className="w-24">
        <label className="block text-[10px] font-medium text-slate-500 mb-0.5"># hours</label>
        <input
          type="number"
          min={0}
          max={23}
          value={rule.delayHours}
          onChange={(e) => update(rule.id, { delayHours: Math.max(0, Math.min(23, Number(e.target.value) || 0)) })}
          className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
        />
      </div>
      <div className="w-24">
        <label className="block text-[10px] font-medium text-slate-500 mb-0.5"># minutes</label>
        <input
          type="number"
          min={0}
          max={59}
          value={rule.delayMinutes}
          onChange={(e) => update(rule.id, { delayMinutes: Math.max(0, Math.min(59, Number(e.target.value) || 0)) })}
          className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
        />
      </div>
    </div>
  );
}
