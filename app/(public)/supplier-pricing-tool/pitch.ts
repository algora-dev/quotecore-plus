// Pitch conversion - ported from measurement-to-quote-tool calc.ts.
// Applies only when entryPath === 'plan'.

const RAD = Math.PI / 180;

export function rafterPitchFactor(degrees: number): number {
  if (!degrees || degrees <= 0 || degrees >= 90) return 1;
  return 1 / Math.cos(degrees * RAD);
}

export function hipValleyPitchFactor(degrees: number): number {
  if (!degrees || degrees <= 0 || degrees >= 90) return 1;
  const tangent = Math.tan(degrees * RAD);
  return Math.sqrt(1 + (tangent * tangent) / 2);
}

/** Which conversion rule each group uses for plan measurements. */
export type PitchRule = 'rafter' | 'hipvalley' | 'none';

export const GROUP_PITCH_RULES: Record<string, PitchRule> = {
  roofAreas: 'rafter',   // plan area x 1/cos(pitch)
  ridges: 'none',        // ridge runs horizontally - no conversion
  hips: 'hipvalley',     // sqrt(1 + tan^2/2)
  valleys: 'hipvalley',
  barges: 'rafter',      // barge follows the rafter slope
  spouting: 'none',      // eaves edge is horizontal
  downpipes: 'none',     // counted points - no conversion
};

export function pitchFactor(rule: PitchRule, degrees: number): number {
  if (rule === 'none') return 1;
  if (rule === 'hipvalley') return hipValleyPitchFactor(degrees);
  return rafterPitchFactor(degrees);
}
