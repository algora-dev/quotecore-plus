
'use client';

import { useState, useTransition } from 'react';
import { loginAction } from './actions';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <main style={{ maxWidth: 420, margin: '40px auto', padding: 16 }}>
      <h1>Log in to QuoteCore</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const formData = new FormData(e.currentTarget);

          startTransition(async () => {
            const result = await loginAction(formData);
            if (result && !result.ok) {
              setError(result.error);
            }
          });
        }}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <label>
            Email
            <input name="email" type="email" required style={{ width: '100%' }} />
          </label>

          <label>
            Password
            <input name="password" type="password" required style={{ width: '100%' }} />
          </label>

          <button type="submit" disabled={isPending}>
            {isPending ? 'Logging in...' : 'Log in'}
          </button>

          {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
        </div>
      </form>
    </main>
  );
}
