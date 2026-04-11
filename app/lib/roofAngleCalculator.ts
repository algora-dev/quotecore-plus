/**
 * Roof Angle Calculator Utilities
 * Accurate formulas for calculating flashing bend angles
 */

export interface AngleResult {
  interior: number;
  exterior: number;
  additionalInfo?: {
    theta?: number;
    hipSlope?: number;
    foldFromFlat?: number;
  };
}

/**
 * Ridge/Apron/Change of Pitch Calculator
 * For simple intersections where two roof planes meet
 */
export function calculateRidgeAngle(pitch1: number, pitch2: number): AngleResult {
  const interior = 180 - (pitch1 + pitch2);
  const exterior = 360 - interior;
  
  return {
    interior: Math.round(interior * 10) / 10, // Round to 1 decimal
    exterior: Math.round(exterior * 10) / 10,
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
  
  return {
    interior: Math.round(interior * 10) / 10,
    exterior: Math.round(exterior * 10) / 10,
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
  
  return {
    interior: Math.round(interior * 10) / 10,
    exterior: Math.round(exterior * 10) / 10,
    additionalInfo: {
      theta: Math.round(theta * 10) / 10,
      foldFromFlat: Math.round(foldFromFlat * 10) / 10,
    },
  };
}
