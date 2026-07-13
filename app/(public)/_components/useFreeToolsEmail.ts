'use client';

import { useEffect, useState } from 'react';
import { useFreeToolsAuth } from './FreeToolsAuthProvider';

/**
 * Unified hook that resolves the user's email from either:
 * 1. FreeToolsAuth (Google OAuth / email login) — takes priority
 * 2. localStorage 'free-tools-email' — fallback for non-logged-in users
 *
 * Returns:
 * - email: the effective email (auth user email or localStorage email or '')
 * - isAuthed: true if logged in via FreeToolsAuth
 * - emailSaved: true if we have an email from either source
 * - setEmailInLocalStorage: save an email to localStorage (for non-authed users)
 * - clearLocalEmail: remove localStorage email
 * - authUser: the raw Supabase user object if authed
 */
export function useFreeToolsEmail() {
  const { user, loading } = useFreeToolsAuth();
  const [localEmail, setLocalEmail] = useState<string>('');
  const [localEmailLoaded, setLocalEmailLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('free-tools-email');
      if (saved) setLocalEmail(saved);
    } catch {}
    setLocalEmailLoaded(true);
  }, []);

  const isAuthed = !!user;
  const email = user?.email || localEmail;
  const emailSaved = !!email;
  const loadingEmail = loading || !localEmailLoaded;

  function setEmailInLocalStorage(email: string) {
    try {
      localStorage.setItem('free-tools-email', email);
      setLocalEmail(email);
    } catch {}
  }

  function clearLocalEmail() {
    try {
      localStorage.removeItem('free-tools-email');
      setLocalEmail('');
    } catch {}
  }

  return {
    email,
    isAuthed,
    emailSaved,
    loadingEmail,
    authUser: user,
    setEmailInLocalStorage,
    clearLocalEmail,
  };
}
