'use client';

import { useState, useTransition } from 'react';
import { setOnboardingSecurityQuestions } from '@/app/(auth)/[workspaceSlug]/settings/security-questions-actions';
import { SUGGESTED_QUESTIONS, CUSTOM_QUESTION_LABEL, QUESTION_SLOTS } from '@/app/lib/security/questions';
import { PasswordField } from '@/app/components/ui/PasswordField';

type Props = {
  /** Called after the step completes (whether the user filled it in or skipped). */
  onDone: () => void;
};

/**
 * Optional onboarding step. Encourages but never blocks.
 *
 * Layout: two slots, each with a question selector + answer field. Both slots
 * are optional individually - partial save is allowed. The "Skip for now"
 * button bypasses entirely. The hard sell is in the copy: this is the safety
 * net for losing email access.
 */
export function SecurityQuestionsStep({ onDone }: Props) {
  type Slot = { question: string; isCustom: boolean; answer: string };
  const [slots, setSlots] = useState<Slot[]>(
    Array.from({ length: QUESTION_SLOTS }, (_, i) => ({
      question: SUGGESTED_QUESTIONS[i] ?? SUGGESTED_QUESTIONS[0],
      isCustom: false,
      answer: '',
    }))
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateSlot(idx: number, patch: Partial<Slot>) {
    setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function handleSave() {
    setError(null);
    const filled = slots
      .map((s, i) => ({ slot: i + 1, question: s.isCustom ? s.question.trim() : s.question, answer: s.answer }))
      .filter((s) => s.answer.trim().length > 0);

    if (filled.length === 0) {
      // Treat as a skip - nothing to save.
      onDone();
      return;
    }

    startTransition(async () => {
      const res = await setOnboardingSecurityQuestions(filled);
      if (res.ok) {
        onDone();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 mx-auto bg-orange-100 rounded-full flex items-center justify-center">
          <svg className="w-7 h-7 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-slate-900">Account recovery questions</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          If you ever lose access to your email, support can verify it&apos;s really you with these.
          <span className="block mt-2 text-amber-700 font-medium">
            Highly recommended &mdash; without these, recovery may not be possible.
          </span>
          <span className="block mt-2 text-xs text-slate-500">You can set or change these any time in Settings → Account Recovery.</span>
        </p>
      </div>

      {slots.map((slot, idx) => (
        <div key={idx} className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">Question {idx + 1}</p>
          <select
            value={slot.isCustom ? CUSTOM_QUESTION_LABEL : slot.question}
            onChange={(e) => {
              const v = e.target.value;
              if (v === CUSTOM_QUESTION_LABEL) {
                updateSlot(idx, { isCustom: true, question: '' });
              } else {
                updateSlot(idx, { isCustom: false, question: v });
              }
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
          >
            {SUGGESTED_QUESTIONS.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
            <option value={CUSTOM_QUESTION_LABEL}>{CUSTOM_QUESTION_LABEL}</option>
          </select>
          {slot.isCustom && (
            <input
              type="text"
              placeholder="Write your own question…"
              value={slot.question}
              onChange={(e) => updateSlot(idx, { question: e.target.value })}
              maxLength={200}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          )}
          <PasswordField
            placeholder="Your answer"
            value={slot.answer}
            onChange={(e) => updateSlot(idx, { answer: e.target.value })}
            maxLength={200}
            autoComplete="off"
            inputClassName="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      ))}

      {error && <p className="text-xs text-red-600 text-center">{error}</p>}

      <div className="space-y-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="w-full py-3 bg-black text-white font-semibold rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save & continue'}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={isPending}
          className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition disabled:opacity-50"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
