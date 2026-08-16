export const DEMO_CANVAS = { width: 1200, height: 760 } as const;
/** One metre equals 20 plan pixels. Values stay in image coordinates. */
export const DEMO_SCALE_METRES_PER_PIXEL = 1 / 20;
export const DEMO_PITCH_DEGREES = 25;
export const DEMO_PITCH_FACTOR = 1 / Math.cos((DEMO_PITCH_DEGREES * Math.PI) / 180);
export const DEMO_WASTE_RATE = 0.1;
