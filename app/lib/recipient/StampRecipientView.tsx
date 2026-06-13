'use client';

import { useEffect, useRef } from 'react';

type Kind = 'quote' | 'order' | 'invoice';

/**
 * Fires a recipient-view POST server action exactly once on mount.
 *
 * Renders nothing. Lives on the PUBLIC token pages so the "Read" status is
 * stamped by a genuine human page open (a POST/server action), NOT by the
 * page's GET render - which email/link scanners trigger and would falsely
 * mark items read (MEMORY: "GET-on-mutate is a class of bug").
 *
 * The server actions themselves are idempotent, so a double-invoke (e.g.
 * React strict-mode double render in dev) is harmless; the `fired` ref is a
 * belt-and-braces guard against firing twice in the same mount.
 */
export function StampRecipientView({ kind, token }: { kind: Kind; token: string }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    let cancelled = false;

    (async () => {
      try {
        const mod = await import('./stampViewActions');
        if (cancelled) return;
        if (kind === 'quote') await mod.stampQuoteViewed(token);
        else if (kind === 'order') await mod.stampOrderViewed(token);
        else await mod.stampInvoiceViewed(token);
      } catch {
        // Best-effort: stamping must never break the public page render.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [kind, token]);

  return null;
}
