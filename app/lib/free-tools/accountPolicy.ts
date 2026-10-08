/** Pure policy, shared by the resolver and unit tests. Never use user_metadata
 * or a typed email address to grant an allowance or remove branding. */
export interface VerifiedAuthUser {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  is_anonymous?: boolean;
}
export function hasConfirmedEmail(user: VerifiedAuthUser | null | undefined): boolean {
  return !!(user?.id && user.email && user.email_confirmed_at && !user.is_anonymous);
}
export interface FreeToolsCompany {
  onboarding_completed_at: string | null;
  subscription_status: string;
  admin_paused: boolean | null;
}
/** Paid-only: onboarding, a historical account, trial, or client claim is not enough.
 * The existing billing RPC must independently say the company is active. */
export function hasPaidFreeToolsAccess(company: FreeToolsCompany | null, effectiveActive: unknown): boolean {
  return !!(company?.onboarding_completed_at && company.subscription_status === 'active'
    && company.admin_paused !== true && effectiveActive === true);
}
