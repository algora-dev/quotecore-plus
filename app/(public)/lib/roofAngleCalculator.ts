/**
 * Roof Angle Calculator Utilities
 * Accurate formulas for calculating flashing bend angles
 */

export type AngleType = 'internal' | 'external' | 'straight';
export type BendDirection = 'internal' | 'external' | 'none';

export interface AngleResult {
  /** Legacy field — kept for backward compat. Same as finishedAngle. */
  interior: number;
  /** Legacy field — kept for backward compat. */
  exterior: number;
  /** The included angle of the finished flashing. */
  finishedAngle: number;
  /** Angle the flashing must be bent from a flat sheet = |180 - finishedAngle|. */
  bendAngleFromFlat: number;
  /** Whether the finished angle is internal (<180°), external (>180°), or straight (=180°). */
  angleType: AngleType;
  /** Which direction the flashing bends. Matches angleType for most calcs; 'none' when straight. */
  bendDirection: BendDirection;
  additionalInfo?: {
    theta?: number;
    hipSlope?: number;
    foldFromFlat?: number;
  };
}

/** Infer angleType + bendDirection from a finished angle. */
function inferAngleType(finishedAngle: number): { angleType: AngleType; bendDirection: BendDirection } {
  if (Math.abs(finishedAngle - 180) < 0.05) return { angleType: 'straight', bendDirection: 'none' };
  if (finishedAngle > 180) return { angleType: 'external', bendDirection: 'external' };
  return { angleType: 'internal', bendDirection: 'internal' };
}

/**
 * Ridge Calculator
 * Used where two roof planes meet at the ridge.
 * Finished Angle = 180 - Pitch1 - Pitch2
 */
export function calculateRidgeAngle(pitch1: number, pitch2: number): AngleResult {
  const interior = 180 - (pitch1 + pitch2);
  const exterior = 360 - interior;
  const bend = Math.abs(180 - interior);
  const { angleType, bendDirection } = inferAngleType(interior);
  
  return {
    interior: Math.round(interior * 10) / 10,
    exterior: Math.round(exterior * 10) / 10,
    finishedAngle: Math.round(interior * 10) / 10,
    bendAngleFromFlat: Math.round(bend * 10) / 10,
    angleType,
    bendDirection,
  };
}

/**
 * Change of Pitch Calculator
 * Used where one roof slope changes into another running in the same direction.
 * Finished Angle = 180 - Upper Pitch + Lower Pitch (can exceed 180°)
 * Bend Angle = |180 - Finished Angle|
 *
 * Direction is determined by the pitch comparison, NOT just the finished angle:
 * - Upper > Lower → internal (folds inward, finished < 180°)
 * - Upper < Lower → external (opens outward, finished > 180°)
 * - Upper = Lower → straight (finished = 180°)
 */
export function calculateChangeOfPitch(upperPitch: number, lowerPitch: number): AngleResult {
  const finished = 180 - upperPitch + lowerPitch;
  const bend = Math.abs(180 - finished);
  const exterior = 360 - finished;

  let angleType: AngleType;
  let bendDirection: BendDirection;
  if (upperPitch > lowerPitch) {
    angleType = 'internal';
    bendDirection = 'internal';
  } else if (upperPitch < lowerPitch) {
    angleType = 'external';
    bendDirection = 'external';
  } else {
    angleType = 'straight';
    bendDirection = 'none';
  }

  return {
    interior: Math.round(finished * 10) / 10,
    exterior: Math.round(exterior * 10) / 10,
    finishedAngle: Math.round(finished * 10) / 10,
    bendAngleFromFlat: Math.round(bend * 10) / 10,
    angleType,
    bendDirection,
  };
}

/**
 * Upstand onto Roof Calculator
 * Used where flashing starts on a vertical upstand and turns down onto the roof.
 * Finished Angle = 90 + Roof Pitch
 */
export function calculateUpstandOntoRoof(pitch: number): AngleResult {
  const finished = 90 + pitch;
  const bend = Math.abs(180 - finished);
  const exterior = 360 - finished;
  const { angleType, bendDirection } = inferAngleType(finished);
  
  return {
    interior: Math.round(finished * 10) / 10,
    exterior: Math.round(exterior * 10) / 10,
    finishedAngle: Math.round(finished * 10) / 10,
    bendAngleFromFlat: Math.round(bend * 10) / 10,
    angleType,
    bendDirection,
  };
}

/**
 * Roof into Upstand Calculator
 * Used where flashing starts on the roof and turns up into a vertical upstand.
 * Finished Angle = 90 - Roof Pitch
 */
export function calculateRoofIntoUpstand(pitch: number): AngleResult {
  const finished = 90 - pitch;
  const bend = Math.abs(180 - finished);
  const exterior = 360 - finished;
  const { angleType, bendDirection } = inferAngleType(finished);
  
  return {
    interior: Math.round(finished * 10) / 10,
    exterior: Math.round(exterior * 10) / 10,
    finishedAngle: Math.round(finished * 10) / 10,
    bendAngleFromFlat: Math.round(bend * 10) / 10,
    angleType,
    bendDirection,
  };
}

/**
 * Hip/Valley Calculator - Single Pitch
 * For hips/valleys where both roof planes have the same pitch
 * Assumes 45° plan view angle (standard square corner)
 */
export function calculateHipValleySinglePitch(pitch: number): AngleResult {
  // Convert to radians
  const pitchRad = pitch * Math.PI / 180;
  
  // Calculate actual hip slope (45° plan view)
  // Formula: arctan(tan(pitch) × √2)
  const hipSlope = Math.atan(Math.tan(pitchRad) * Math.sqrt(2)) * 180 / Math.PI;
  
  // Calculate cap angle
  const interior = 180 - (2 * hipSlope);
  const exterior = 360 - interior;
  const bend = Math.abs(180 - interior);
  const { angleType, bendDirection } = inferAngleType(interior);
  
  return {
    interior: Math.round(interior * 10) / 10,
    exterior: Math.round(exterior * 10) / 10,
    finishedAngle: Math.round(interior * 10) / 10,
    bendAngleFromFlat: Math.round(bend * 10) / 10,
    angleType,
    bendDirection,
    additionalInfo: {
      hipSlope: Math.round(hipSlope * 10) / 10,
    },
  };
}

/**
 * Hip/Valley Calculator - Multi Pitch
 * For hips/valleys where roof planes have different pitches
 * 
 * @param pitch1 - First roof pitch in degrees
 * @param pitch2 - Second roof pitch in degrees
 * @param planAngle - Plan angle between roof directions (default 90° for square corners)
 */
export function calculateHipValleyMultiPitch(
  pitch1: number, 
  pitch2: number, 
  planAngle: number = 90
): AngleResult {
  // Convert to radians
  const p1Rad = pitch1 * Math.PI / 180;
  const p2Rad = pitch2 * Math.PI / 180;
  const phiRad = planAngle * Math.PI / 180;
  
  let theta: number;
  
  if (planAngle === 90) {
    // Simplified formula for 90° corner (most common case)
    // cos(θ) = cos(pitch1) × cos(pitch2)
    const cosTheta = Math.cos(p1Rad) * Math.cos(p2Rad);
    theta = Math.acos(cosTheta) * 180 / Math.PI;
  } else {
    // General formula for any plan angle
    // cos(θ) = [1 + tan(α) × tan(β) × cos(φ)] / [√(1 + tan²(α)) × √(1 + tan²(β))]
    const numerator = 1 + Math.tan(p1Rad) * Math.tan(p2Rad) * Math.cos(phiRad);
    const denominator = Math.sqrt(1 + Math.tan(p1Rad)**2) * Math.sqrt(1 + Math.tan(p2Rad)**2);
    const cosTheta = numerator / denominator;
    theta = Math.acos(cosTheta) * 180 / Math.PI;
  }
  
  const interior = 180 - theta;
  const exterior = 360 - interior;
  const foldFromFlat = theta;
  const bend = Math.abs(180 - interior);
  const { angleType, bendDirection } = inferAngleType(interior);
  
  return {
    interior: Math.round(interior * 10) / 10,
    exterior: Math.round(exterior * 10) / 10,
    finishedAngle: Math.round(interior * 10) / 10,
    bendAngleFromFlat: Math.round(bend * 10) / 10,
    angleType,
    bendDirection,
    additionalInfo: {
      theta: Math.round(theta * 10) / 10,
      foldFromFlat: Math.round(foldFromFlat * 10) / 10,
    },
  };
}
