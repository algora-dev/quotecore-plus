'use client';

import { useEffect, useState } from 'react';
import { useFreeToolsAuth } from './FreeToolsAuthProvider';

/**
 * Unified hook that resolves the user's email from either:
 * 1. FreeToolsAuth (Google OAuth / email login) — takes priority
 * 2. localStorage 'free-tools-email' — fallback for non-logged-in users
 *
 * Also exposes openAuthModal so in-page cards can trigger the shared auth modal.
 */
export function useFreeToolsEmail() {
  const { user, loading, signOut, openAuthModal, tierInfo } = useFreeToolsAuth();
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

  // Human-readable daily limits line for the auth status cards.
  // Anonymous (incl. locally-saved email) = tier 1; authed = tier 2 until
  // the account-status fetch resolves, then whatever the server says.
  const limitsLine = isAuthed
    ? `${tierInfo?.hasAppAccount ? 'App account' : 'Logged in'} · Image upload: ${tierInfo?.limits.imagePerDay ?? 10}/day · Text parse: ${tierInfo?.limits.textPerDay ?? 20}/day · Manual: Unlimited`
    : 'Image upload: 3/day · Text parse: 5/day · Manual: Unlimited';

  return {
    email,
    isAuthed,
    emailSaved,
    loadingEmail,
    authUser: user,
    tierInfo,
    limitsLine,
    setEmailInLocalStorage,
    clearLocalEmail,
    signOut,
    openAuthModal,
  };
}
