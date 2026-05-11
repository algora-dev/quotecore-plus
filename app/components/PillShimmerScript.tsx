'use client';

import { useEffect } from 'react';

/**
 * One-shot controller for the `.pill-shimmer` orange-sheen hover animation.
 *
 * Why this exists: CSS alone can't run an animation to completion when the
 * hover state ends mid-animation. Removing `:hover` instantly cancels the
 * animation and leaves the sheen frozen wherever it was, which looked
 * janky on fast hover-on/off motions. (See screenshot Shaun sent 2026-05-11.)
 *
 * What this does:
 *   1. Listens for `pointerenter` events on any `.pill-shimmer` element.
 *   2. Adds the `.pill-shimmer--playing` class, which triggers the keyframe
 *      animation via the rule in `globals.css`.
 *   3. On `animationend` removes the class so the next hover restarts cleanly.
 *
 * Single delegated listener on `document` (no per-element attachment) so this
 * works for elements added dynamically after mount (Copilot overlays, etc.).
 *
 * Implementation notes:
 *   - Pointer events not mouse events: covers touch + pen + mouse uniformly.
 *   - Re-entry while already playing is a no-op (the class is already there,
 *     and we don't want to interrupt the running animation \u2014 one full sweep
 *     per hover entry is the spec).
 *   - Honour `prefers-reduced-motion: reduce`: skip animation entirely.\n */
export function PillShimmerScript() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Respect users who've asked the OS not to animate.
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const PLAYING_CLASS = 'pill-shimmer--playing';

    function onEnter(e: PointerEvent) {
      const target = e.target as Element | null;
      if (!target) return;
      // closest() handles cases where the cursor enters a child element
      // (e.g. an <svg> icon) inside the pill.
      const pill = target.closest?.('.pill-shimmer');
      if (!pill || pill.classList.contains(PLAYING_CLASS)) return;
      pill.classList.add(PLAYING_CLASS);
    }

    function onAnimationEnd(e: AnimationEvent) {
      if (e.animationName !== 'shimmer') return;
      const target = e.target as Element | null;
      // The animation lives on the ::before pseudo-element, but
      // animationend bubbles up to the element that owns the pseudo.
      if (!target || !(target instanceof Element)) return;
      if (target.classList.contains(PLAYING_CLASS)) {
        target.classList.remove(PLAYING_CLASS);
      }
    }

    // `pointerover` bubbles (unlike `pointerenter`) so a single document
    // listener catches every pill without per-element wiring. The early
    // return inside `onEnter` keeps the work to nothing for events that
    // didn't hit a pill, and the playing-class guard prevents re-triggers
    // while the pointer moves around inside the pill.
    document.addEventListener('pointerover', onEnter);
    document.addEventListener('animationend', onAnimationEnd, true);
    return () => {
      document.removeEventListener('pointerover', onEnter);
      document.removeEventListener('animationend', onAnimationEnd, true);
    };
  }, []);

  return null;
}
