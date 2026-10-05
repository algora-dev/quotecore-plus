/** Exact critically damped spring step. Independent of display refresh rate.
 * Pure math: the pointer handler never schedules React state updates. */
export type SpringValue = { value: number; velocity: number };
export const HERO_MOTION = {
  appFrequency: 16,
  reviewFrequency: 11.5,
  engagementFrequency: 13,
  maxDeltaSeconds: .05,
  positionEpsilon: .0002,
  velocityEpsilon: .002,
} as const;
export function springStep(state: SpringValue, target: number, seconds: number, frequency: number): SpringValue {
  if (!Number.isFinite(target) || !Number.isFinite(seconds) || !Number.isFinite(frequency) || frequency <= 0) return state;
  const dt = Math.max(0, Math.min(seconds, HERO_MOTION.maxDeltaSeconds));
  if (dt === 0) return state;
  const offset = state.value - target;
  const decay = Math.exp(-frequency * dt);
  const carry = (state.velocity + frequency * offset) * dt;
  return { value: target + (offset + carry) * decay, velocity: (state.velocity - frequency * carry) * decay };
}
export function springSettled(state: SpringValue, target: number): boolean {
  return Math.abs(state.value - target) < HERO_MOTION.positionEpsilon && Math.abs(state.velocity) < HERO_MOTION.velocityEpsilon;
}
export function normalizePointer(client: number, start: number, length: number): number {
  if (!Number.isFinite(client) || !Number.isFinite(start) || !Number.isFinite(length) || length <= 0) return 0;
  return Math.max(-1, Math.min(1, (client - start) / length * 2 - 1));
}
