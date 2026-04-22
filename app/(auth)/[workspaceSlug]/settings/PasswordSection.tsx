'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

interface Props {
  authProvider: string;
  userEmail: string;
}

export function PasswordSection({ authProvider, userEmail }: Props) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const isGoogleOnly = authProvider === 'google';

  async function handlePasswordAction() {
    setStatus('sending');
    setMessage('');

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        setStatus('error');
        setMessage(error.message);
      } else {
        setStatus('sent');
        setMessage(`Password ${isGoogleOnly ? 'setup' : 'reset'} email sent to ${userEmail}. Check your inbox.`);
      }
    } catch {
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    }
  }

  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
      <div>
        <p className="text-sm font-medium text-slate-900">
          {isGoogleOnly ? 'Add Password' : 'Change Password'}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {isGoogleOnly
            ? 'Add a password so you can also log in with email + password'
            : 'Change your account password via email confirmation'}
        </p>
        {status === 'sent' && (
          <p className="text-xs text-emerald-600 mt-1 font-medium">{message}</p>
        )}
        {status === 'error' && (
          <p className="text-xs text-red-600 mt-1">{message}</p>
        )}
      </div>
      <button
        onClick={handlePasswordAction}
        disabled={status === 'sending' || status === 'sent'}
        className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all ${
          status === 'sent'
            ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
            : 'bg-black text-white hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50'
        }`}
      >
        {status === 'sending' ? 'Sending...' :
         status === 'sent' ? '✓ Email Sent' :
         isGoogleOnly ? 'Add Password' : 'Send Reset Email'}
      </button>
    </div>
  );
}
