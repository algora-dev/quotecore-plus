'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import styles from './assistant-v2.module.css';

// Domain-scoped C01 adapter. Does not fetch, navigate, or decide permissions.
export type AssistantButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost';
  pending?: boolean;
  pendingLabel?: string;
};

export const AssistantButton = forwardRef<HTMLButtonElement, AssistantButtonProps>(
  function AssistantButton({ variant = 'ghost', pending = false, pendingLabel = 'Saving...', disabled, type = 'button', className, children, ...props }, ref) {
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        className={[styles.button, className].filter(Boolean).join(' ')}
        data-component-id="C01"
        data-variant={variant}
        disabled={disabled || pending}
        aria-busy={pending || undefined}
      >
        {pending ? pendingLabel : children}
      </button>
    );
  },
);
