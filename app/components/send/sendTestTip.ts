'use client';

import { useCallback, useEffect, useState } from 'react';
import { dismissSendTestTip } from './sendTestTip-actions';

/**
 * One-time "test it on yourself first" tip, shared across the Quote / Order /
 * Invoice send buttons. It must fire on the FIRST send of ANY of the three,
 * then never again for that user.
 *
 * Coordination:
 *  - Server passes `seen` (users.send_test_tip_seen_at IS NOT NULL) into each
 *    send button.
 *  - A module-level flag mirrors that + any in-session dismissal, so once the
 *    tip is shown/dismissed on (say) the Quote button, the Order and Invoice
 *    buttons in the same session immediately treat it as seen WITHOUT waiting
 *    for a server refresh.
 */

let sessionSeen = false;
const listeners = new Set<() => void>();

function markSeenLocal() {
  if (sessionSeen) return;
  sessionSeen = true;
  listeners.forEach((l) => l());
}

export interface SendTestTipController {
  /** True when the tip still needs to be shown before sending. */
  shouldShow: boolean;
  /** Call to record the tip as seen (server + local), e.g. on "Got it". */
  markSeen: () => void;
}

/**
 * @param seenFromServer whether the server says the user has already seen it.
 */
export function useSendTestTip(seenFromServer: boolean): SendTestTipController {
  // Seed the module flag from the server prop on first mount.
  useEffect(() => {
    if (seenFromServer) sessionSeen = true;
  }, [seenFromServer]);

  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const markSeen = useCallback(() => {
    markSeenLocal();
    // Best-effort server persist; failure just means it may show again later.
    void dismissSendTestTip();
  }, []);

  return {
    shouldShow: !sessionSeen && !seenFromServer,
    markSeen,
  };
}
