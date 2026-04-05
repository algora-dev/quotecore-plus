
'use client';

import { useState, useTransition } from 'react';
import { signupWithCompany } from './actions';

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <main style={{ maxWidth: 420, margin: '40px auto', padding: 16 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <img src="/logo.png" alt="QuoteCore" style={{ height: 48, display: 'inline-block' }} />
      </div>
      <h1>Create your QuoteCore account</h1>
      <p>Create your company and owner account in one step.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);

          const form = new FormData(e.currentTarget);
          const companyName = String(form.get('companyName') || '');
          const fullName = String(form.get('fullName') || '');
          const email = String(form.get('email') || '');
          const password = String(form.get('password') || '');

          startTransition(async () => {
            const result = await signupWithCompany({
              companyName,
              fullName,
              email,
              password,
            });

            if (!result?.ok) {
              setError(result?.error ?? 'Something went wrong.');
            }
          });
        }}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <label>
            Company name
            <input name="companyName" type="text" required style={{ width: '100%' }} />
          </label>

          <label>
            Full name
            <input name="fullName" type="text" required style={{ width: '100%' }} />
          </label>

          <label>
            Email
            <input name="email" type="email" required style={{ width: '100%' }} />
          </label>

          <label>
            Password
            <input name="password" type="password" minLength={8} required style={{ width: '100%' }} />
          </label>

          <button type="submit" disabled={isPending}>
            {isPending ? 'Creating account...' : 'Create account'}
          </button>

          {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
        </div>
      </form>
    </main>
  );
}
