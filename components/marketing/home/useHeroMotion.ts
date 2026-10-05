'use client';
import { useEffect, useRef } from 'react';
import { HERO_MOTION, normalizePointer, springSettled, springStep, type SpringValue } from './hero-motion';

/** Stable, untransformed hit area + one requestAnimationFrame loop.
 * No competing CSS transform transition, event-level RAF cancellation,
 * React renders, or measurements of the transformed children.
 * Both layers retain velocity, and the proof card follows more slowly.
 */
export function useHeroMotion() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const el: HTMLDivElement = element;
    const fine = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 768px)');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    let rect: DOMRect | null = null;
    let frame = 0, last = 0, targetX = 0, targetY = 0, engaged = 0;
    const zero = (): SpringValue => ({ value: 0, velocity: 0 });
    let ax = zero(), ay = zero(), rx = zero(), ry = zero(), depth = zero();
    const enabled = () => fine.matches && !reduce.matches && !document.hidden;
    const write = () => {
      el.style.setProperty('--app-x', ax.value.toFixed(5));
      el.style.setProperty('--app-y', ay.value.toFixed(5));
      el.style.setProperty('--review-x', rx.value.toFixed(5));
      el.style.setProperty('--review-y', ry.value.toFixed(5));
      el.style.setProperty('--engaged', depth.value.toFixed(5));
    };
    const stop = (immediate: boolean) => {
      targetX = targetY = engaged = 0;
      rect = null;
      if (immediate) {
        cancelAnimationFrame(frame); frame = last = 0;
        ax = zero(); ay = zero(); rx = zero(); ry = zero(); depth = zero(); write();
        el.dataset.motion = enabled() ? 'idle' : 'disabled';
      } else start();
    };
    function tick(now: number) {
      frame = 0;
      if (!enabled()) { stop(true); return; }
      const dt = last ? (now - last) / 1000 : 1 / 60;
      last = now;
      ax = springStep(ax, targetX, dt, HERO_MOTION.appFrequency);
      ay = springStep(ay, targetY, dt, HERO_MOTION.appFrequency);
      rx = springStep(rx, targetX, dt, HERO_MOTION.reviewFrequency);
      ry = springStep(ry, targetY, dt, HERO_MOTION.reviewFrequency);
      depth = springStep(depth, engaged, dt, HERO_MOTION.engagementFrequency);
      const settled = springSettled(ax,targetX) && springSettled(ay,targetY) && springSettled(rx,targetX) && springSettled(ry,targetY) && springSettled(depth,engaged);
      if (settled) {
        ax = {value:targetX,velocity:0}; ay = {value:targetY,velocity:0};
        rx = {value:targetX,velocity:0}; ry = {value:targetY,velocity:0}; depth = {value:engaged,velocity:0};
      }
      write();
      if (!settled) frame = requestAnimationFrame(tick);
      else { last = 0; el.dataset.motion = 'idle'; }
    }
    function start() {
      if (!enabled() || frame) return;
      if (springSettled(ax,targetX) && springSettled(ay,targetY) && springSettled(rx,targetX) && springSettled(ry,targetY) && springSettled(depth,engaged)) return;
      el.dataset.motion = 'moving';
      frame = requestAnimationFrame(tick);
    }
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || !enabled()) return;
      // Parent never transforms; descendants cannot feed back into these bounds.
      rect ??= el.getBoundingClientRect();
      targetX = normalizePointer(event.clientX, rect.left, rect.width);
      targetY = normalizePointer(event.clientY, rect.top, rect.height);
      engaged = 1;
      start();
    };
    const enter = (event: PointerEvent) => { rect = null; move(event); };
    const leave = () => stop(false);
    const preferences = () => stop(true);
    const resized = () => stop(false);
    const blurred = () => stop(true);
    el.dataset.motion = enabled() ? 'idle' : 'disabled';
    el.addEventListener('pointerenter', enter, { passive: true });
    el.addEventListener('pointermove', move, { passive: true });
    el.addEventListener('pointerleave', leave, { passive: true });
    el.addEventListener('pointercancel', leave, { passive: true });
    fine.addEventListener('change', preferences);
    reduce.addEventListener('change', preferences);
    document.addEventListener('visibilitychange', preferences);
    window.addEventListener('blur', blurred);
    window.addEventListener('scroll', leave, { passive: true });
    const observer = new ResizeObserver(resized); observer.observe(el);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      el.removeEventListener('pointerenter', enter); el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave); el.removeEventListener('pointercancel', leave);
      fine.removeEventListener('change', preferences); reduce.removeEventListener('change', preferences);
      document.removeEventListener('visibilitychange', preferences);
      window.removeEventListener('blur', blurred); window.removeEventListener('scroll', leave);
    };
  }, []);
  return root;
}
