import { TIER_LIMITS, type TierLimits } from '@/app/lib/free-tools/tiers';
export { TIER_LIMITS };
export interface DocumentAccount {
  ready: boolean;
  signedIn: boolean;
  /** Only true following a server-verified, email-confirmed account response. */
  canRemoveBranding: boolean;
  hasPaidAppAccess: boolean;
  email?: string;
  userId?: string;
  limits: TierLimits;
  error?: string;
  refresh: () => Promise<boolean>;
  signOut: () => Promise<void>;
}
export interface DocumentAuthServices {
  preview: boolean;
  google: (redirectTo:string) => Promise<void>;
  email: (email:string,redirectTo:string) => Promise<void>;
  password: (email:string,password:string) => Promise<void>;
  /** Only exists in the offline adapter. Never included in the production one. */
  simulateVerification?: () => Promise<void>;
}
export interface PreparedAuth { redirectTo:string; backupAvailable:boolean; }
export type AuthIntent='signin'|'signup'|'branding'|'allowance';
export function dailyDocumentLabel(limit:number|null) {return limit===null?'Unlimited documents':`${limit} documents / day`;}
