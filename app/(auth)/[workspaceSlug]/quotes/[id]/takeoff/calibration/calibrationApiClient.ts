'use client';
// Thin authenticated fetch wrapper for the calibration search/refine endpoint
// (Phase P6). All contracts, failure classification and the server->client frame
// mapping live in the pure, testable calibrationApiClientCore. This module only
// performs the POST and parses/validates the response.
import {
  CalibrationApiError,
  classifyCalibrationHttpFailure,
  parseCalibrationSearchResponse,
  type CalibrationFailureResponse,
  type CalibrationSearchRequestBody,
  type CalibrationSearchResponse,
} from '@/app/lib/takeoff/calibrationApiClientCore';

export type {
  CalibrationSearchRequestBody,
  CalibrationSearchResponse,
} from '@/app/lib/takeoff/calibrationApiClientCore';
export { CalibrationApiError } from '@/app/lib/takeoff/calibrationApiClientCore';

/** New replay-safe request identity (spec 12.4). */
export function newCalibrationRequestId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `cal-req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Execute one calibration search/refine request. Network failures and HTTP
 * errors throw CalibrationApiError with the P6 recoverable/terminal
 * classification; a 200 body that fails structural validation is treated as a
 * terminal technical failure. The caller owns AbortController lifecycle.
 */
export async function calibrationSearch(
  body: CalibrationSearchRequestBody,
  signal: AbortSignal,
): Promise<CalibrationSearchResponse> {
  let response: Response;
  try {
    response = await fetch('/api/takeoff/calibration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (signal.aborted) throw err;
    throw new CalibrationApiError(null, null, classifyCalibrationHttpFailure(null));
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new CalibrationApiError(response.status, null, classifyCalibrationHttpFailure(response.status));
  }

  if (!response.ok) {
    const failure = raw as Partial<CalibrationFailureResponse>;
    const code = typeof failure?.code === 'string' ? failure.code : null;
    throw new CalibrationApiError(response.status, code, classifyCalibrationHttpFailure(response.status, code));
  }

  const parsed = parseCalibrationSearchResponse(raw);
  if (!parsed) {
    throw new CalibrationApiError(
      response.status,
      'INVALID_RESPONSE',
      classifyCalibrationHttpFailure(502, 'INVALID_RESPONSE'),
    );
  }
  return parsed;
}
