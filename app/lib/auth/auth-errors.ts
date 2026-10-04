import { temporaryAuthFailure } from '@/app/lib/supabase/cookie-batch';

export type AuthErrorShape = { name?: string; code?: string; status?: number };

/** Unknown failures are not proof of logout. No raw provider messages in telemetry. */
export function authFailureCategory(error: AuthErrorShape | null | undefined): 'missing' | 'invalid' | 'temporary' | 'unknown' | 'none' {
  if (!error) return 'none';
  if (temporaryAuthFailure(error) || error.status === 429 || error.status === 408) return 'temporary';
  if (error.name === 'AuthSessionMissingError' || error.code === 'session_not_found') return 'missing';
  if (error.status === 401 || error.status === 403 || [
    'refresh_token_not_found', 'refresh_token_already_used', 'session_expired', 'bad_jwt', 'jwt_expired', 'user_not_found', 'user_banned',
  ].includes(error.code ?? '')) return 'invalid';
  return 'unknown';
}
