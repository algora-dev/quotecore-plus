'use client';

/**
 * PasswordField - <input type="password"> with an eye toggle so users can
 * verify what they typed. Standard sign-up/login UX. Used for passwords AND
 * recovery-question answers (anywhere we mask user typing).
 *
 * Pass-through:
 *   - All <input> props EXCEPT `type` (forced to "password" / "text" by the
 *     toggle state).
 *   - `inputClassName` lets the caller style the input itself; the wrapper
 *     uses `className` for the container.
 *
 * Accessibility:
 *   - Toggle button gets aria-label that flips with state.
 *   - aria-pressed reflects the visible/hidden state.
 *   - v2 callers include the toggle in keyboard order. Legacy callers retain
 *     the original tabIndex=-1 behavior; appearance defaults to legacy.
 */

import { forwardRef, useState, type InputHTMLAttributes } from 'react';

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  inputClassName?: string;
  /** Opt-in journey styling; legacy callers keep their original tab sequence. */
  appearance?: 'legacy' | 'v2';
  /** Wrapper class (positions the icon inside the input). */
  wrapperClassName?: string;
};

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(
    { inputClassName, wrapperClassName, className, appearance = 'legacy', ...rest },
    ref
  ) {
    const [visible, setVisible] = useState(false);

    // Combine wrapper classes - caller can override via wrapperClassName,
    // or fall back to className when no inputClassName was given.
    const wrapper = wrapperClassName ?? 'relative w-full';
    const input =
      inputClassName ??
      className ??
      'w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500';

    return (
      <div className={wrapper}>
        <input
          {...rest}
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={input + (input.includes('pr-') ? '' : ' pr-10')}
        />
        <button
          type="button"
          tabIndex={appearance === 'v2' ? 0 : -1}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide value' : 'Show value'}
          aria-pressed={visible}
          className={`${appearance === 'v2' ? 'qc-flow-control qc-flow-password-toggle ' : ''}absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none focus:text-slate-700`}
        >
          {visible ? (
            // Eye-off icon
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            // Eye icon
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    );
  }
);
