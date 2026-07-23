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
  const { user, loading, signOut, openAuthModal, tierInfo, accessToken } = useFreeToolsAuth();
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
  const docLimit = tierInfo?.limits.docPerDay ?? 3;
  const aiLimit = tierInfo?.limits.aiPerDay ?? 1;
  const limitsLine = isAuthed
    ? `${tierInfo?.hasAppAccount ? 'App account' : 'Logged in'} · Documents: ${tierInfo?.limits.docPerDay === null ? 'Unlimited' : docLimit + '/day'} · AI: ${aiLimit}/day`
    : `Documents: 3/day · AI: 1/day`;

  return {
    email,
    isAuthed,
    emailSaved,
    loadingEmail,
    authUser: user,
    accessToken,
    tierInfo,
    limitsLine,
    setEmailInLocalStorage,
    clearLocalEmail,
    signOut,
    openAuthModal,
  };
}
