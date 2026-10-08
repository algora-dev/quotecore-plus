/** Server-only authority for free-tool allowances and document branding.
 * Uses getUser(token), then confirmed email, then the existing billing RPC.
 * Account lookup failures never promote a caller. No client-declared tier. */
import { createClient } from '@supabase/supabase-js';
import { TIER_LIMITS, type FreeToolsTier } from './tiers';
import { hasConfirmedEmail, hasPaidFreeToolsAccess, type FreeToolsCompany } from './accountPolicy';

const APP_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const APP_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
export interface ResolvedTier {
  tier: FreeToolsTier;
  userId: string | null;
  email: string | null;
  /** Backwards-compatible property: now requires active paid access. */
  hasAppAccount: boolean;
  hasPaidAppAccess: boolean;
  canRemoveBranding: boolean;
  limits: (typeof TIER_LIMITS)[FreeToolsTier];
}
const ANON_RESULT: ResolvedTier = {
  tier:1,userId:null,email:null,hasAppAccount:false,hasPaidAppAccess:false,
  canRemoveBranding:false,limits:TIER_LIMITS[1],
};
export async function resolveFreeToolsTier(authHeader: string | null): Promise<ResolvedTier> {
  if (!authHeader?.startsWith('Bearer ') || !APP_URL || !APP_ANON) return ANON_RESULT;
  const token=authHeader.slice(7).trim();
  if (!token) return ANON_RESULT;
  try {
    const client=createClient(APP_URL,APP_ANON,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await client.auth.getUser(token);
    if (error || !hasConfirmedEmail(data.user)) return ANON_RESULT;
    const userId=data.user!.id, email=data.user!.email!.toLowerCase();
    let paid=false;
    if (APP_SERVICE) {
      try {
        const admin=createClient(APP_URL,APP_SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
        const {data:profile,error:profileError}=await admin.from('users').select('company_id').eq('id',userId).maybeSingle();
        if (!profileError && profile?.company_id) {
          // Company is derived from the verified user's membership, never request input.
          const [{data:company,error:companyError},{data:active,error:activeError}]=await Promise.all([
            admin.from('companies').select('onboarding_completed_at, subscription_status, admin_paused').eq('id',profile.company_id).maybeSingle(),
            admin.rpc('company_effective_plan_active',{p_company_id:profile.company_id}),
          ]);
          paid=!companyError && !activeError && hasPaidFreeToolsAccess(company as FreeToolsCompany | null,active);
        }
      } catch { paid=false; }
    }
    const tier:FreeToolsTier=paid?3:2;
    return {tier,userId,email,hasAppAccount:paid,hasPaidAppAccess:paid,canRemoveBranding:true,limits:TIER_LIMITS[tier]};
  } catch { return ANON_RESULT; }
}
