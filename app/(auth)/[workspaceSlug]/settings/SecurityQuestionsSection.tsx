'use client';

import { useState, useTransition } from 'react';
import { upsertSecurityQuestion, deleteSecurityQuestion, type SecurityQuestionRecord } from './security-questions-actions';
import { SUGGESTED_QUESTIONS, CUSTOM_QUESTION_LABEL, QUESTION_SLOTS } from '@/app/lib/security/questions';

type Props = {
  initialQuestions: SecurityQuestionRecord[];
};

/**
 * Settings card for managing security questions.
 *
 * Behaviour:
 *  - Shows a "X of N set" summary with each slot's current question stem.
 *  - "Edit" opens a modal to set/update a single slot.
 *  - The modal lets the user pick from suggested questions OR write their own.
 *  - Answer field is masked and a confirmation field is required to prevent
 *    typos that would otherwise lock the user out of recovery.
 */
export function SecurityQuestionsSection({ initialQuestions }: Props) {
  const [questions, setQuestions] = useState<SecurityQuestionRecord[]>(initialQuestions);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const setCount = questions.filter((q) => q.isSet).length;

  function handleSaved(slot: number, question: string) {
    setQuestions((prev) => prev.map((q) => (q.slot === slot ? { ...q, question, isSet: true, updatedAt: new Date().toISOString() } : q)));
    setEditingSlot(null);
  }

  function handleDelete(slot: number) {
    if (!confirm('Remove this security question?')) return;
    startTransition(async () => {
      await deleteSecurityQuestion(slot);
      setQuestions((prev) => prev.map((q) => (q.slot === slot ? { ...q, question: '', isSet: false, updatedAt: null } : q)));
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
        <div>
          <p className="text-sm font-medium text-slate-900">Recovery Questions</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {setCount} of {QUESTION_SLOTS} set &mdash; used by support to verify your identity if you lose access to your email.
          </p>
        </div>
      </div>

      {questions.map((q) => (
        <div key={q.slot} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl">
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-400 font-medium">Question {q.slot}</p>
            <p className="text-sm text-slate-900 mt-1 truncate">
              {q.isSet ? q.question : <span className="text-slate-400 italic">Not set</span>}
            </p>
            {q.isSet && q.updatedAt && (
              <p className="text-xs text-slate-400 mt-1">Updated {new Date(q.updatedAt).toLocaleDateString()}</p>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0 ml-4">
            {q.isSet && (
              <button
                type="button"
                onClick={() => handleDelete(q.slot)}
                disabled={isPending}
                className="px-3 py-1.5 text-xs font-medium rounded-full text-slate-500 hover:text-red-600 hover:bg-red-50 transition disabled:opacity-50"
              >
                Remove
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditingSlot(q.slot)}
              className="px-3 py-1.5 text-xs font-medium rounded-full bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 transition"
            >
              {q.isSet ? 'Update' : 'Set'}
            </button>
          </div>
        </div>
      ))}

      {editingSlot !== null && (
        <SecurityQuestionEditor
          slot={editingSlot}
          initialQuestion={questions.find((q) => q.slot === editingSlot)?.question ?? ''}
          onClose={() => setEditingSlot(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

/* -------------------- Editor modal --------------------------------------- */

function SecurityQuestionEditor({
  slot,
  initialQuestion,
  onClose,
  onSaved,
}: {
  slot: number;
  initialQuestion: string;
  onClose: () => void;
  onSaved: (slot: number, question: string) => void;
}) {
  // If the existing question matches a suggested one, pre-select it; else custom.
  const initialIsSuggested = SUGGESTED_QUESTIONS.includes(initialQuestion as (typeof SUGGESTED_QUESTIONS)[number]);
  const [pickerValue, setPickerValue] = useState<string>(initialIsSuggested ? initialQuestion : initialQuestion ? CUSTOM_QUESTION_LABEL : SUGGESTED_QUESTIONS[0]);
  const [customText, setCustomText] = useState<string>(!initialIsSuggested ? initialQuestion : '');
  const [answer, setAnswer] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isCustom = pickerValue === CUSTOM_QUESTION_LABEL;
  const finalQuestion = isCustom ? customText.trim() : pickerValue;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!finalQuestion || finalQuestion.length < 5) {
      setError('Please choose or write a question (min 5 characters).');
      return;
    }
    if (!answer.trim()) {
      setError('Please enter an answer.');
      return;
    }
    if (answer !== confirm) {
      setError('The two answers do not match.');
      return;
    }
    startTransition(async () => {
      const res = await upsertSecurityQuestion({ slot, question: finalQuestion, answer });
      if (res.ok) {
        onSaved(slot, finalQuestion);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
        <h3 className="text-base font-semibold text-slate-900">Set recovery question {slot}</h3>
        <p className="text-sm text-slate-500 mt-1 mb-4">
          Pick a question only you would know the answer to. Avoid anything searchable on social media.
        </p>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <label className="block">
            <span className="block text-xs font-medium text-slate-700 mb-1">Question</span>
            <select
              value={pickerValue}
              onChange={(e) => setPickerValue(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
            >
              {SUGGESTED_QUESTIONS.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
              <option value={CUSTOM_QUESTION_LABEL}>{CUSTOM_QUESTION_LABEL}</option>
            </select>
          </label>

          {isCustom && (
            <label className="block">
              <span className="block text-xs font-medium text-slate-700 mb-1">Your custom question</span>
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                maxLength={200}
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                placeholder="e.g. What was the make of your first car?"
              />
            </label>
          )}

          <label className="block">
            <span className="block text-xs font-medium text-slate-700 mb-1">Answer</span>
            <input
              type="password"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              maxLength={200}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
              autoComplete="off"
            />
            <p className="text-xs text-slate-400 mt-1">Case insensitive. Extra spaces are ignored.</p>
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-slate-700 mb-1">Confirm answer</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              maxLength={200}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
              autoComplete="off"
            />
          </label>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2 justify-end mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50 transition-all"
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
