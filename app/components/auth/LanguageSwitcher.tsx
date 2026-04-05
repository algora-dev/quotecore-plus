"use client";

import { useState, useTransition } from 'react';

import { updateCompanyLanguage } from '@/app/actions';
import { SUPPORTED_LANGUAGES } from '@/app/lib/i18n/languages';

export function LanguageSwitcher({ currentLanguage }: { currentLanguage: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSelect = (value: string) => {
    startTransition(async () => {
      const result = await updateCompanyLanguage(value);
      if (!result.success) {
        setMessage(result.message ?? 'Unable to update language yet.');
      } else {
        if (value === 'en-gb' || value === 'en-us') {
          setMessage('Language updated');
        } else {
          setMessage('English only for MVP. More languages coming soon!');
        }
      }
      setOpen(false);
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center rounded-full border-2 border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-600 pill-shimmer"
      >
        English
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          {SUPPORTED_LANGUAGES.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={pending}
              onClick={() => handleSelect(option.value)}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {message && (
        <p className="absolute -bottom-6 right-0 text-xs text-slate-500" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
}
