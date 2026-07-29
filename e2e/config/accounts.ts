/**
 * E2E Account Definitions
 *
 * Five ordinary (non-admin) accounts created through dev admin UI.
 * Passwords are loaded from environment (.env.e2e), never committed.
 *
 * Safety Rule 3: Only named ordinary E2E email/password accounts.
 * Safety Rule 4: Never load admin, service-role, or provider credentials.
 */

export interface E2EAccount {
  /** Fixture name (e.g. "trial-a") */
  fixture: string;
  /** Email address (e2e-* prefix, quotecore.invalid domain preferred) */
  email: string;
  /** Password loaded from env â€” never hardcoded */
  password: string;
  /** Workspace slug for direct URL access */
  workspaceSlug: string;
  /** Company name visible in UI */
  company: string;
  /** Intended plan code */
  plan: 'trial' | 'starter' | 'pro' | 'pro_plus';
  /** Intended tests for this account */
  purpose: string;
}

/**
 * Account emails. Passwords come from env vars.
 * These are loaded from .env.e2e (gitignored).
 */

function loadAccount(
  fixture: string,
  emailKey: string,
  passKey: string,
  slugKey: string,
  company: string,
  plan: E2EAccount['plan'],
  purpose: string
): E2EAccount {
  const email = process.env[emailKey];
  const password = process.env[passKey];
  const workspaceSlug = process.env[slugKey];

  if (!email || !password || !workspaceSlug) {
    throw new Error(
      `[e2e:accounts] Missing env vars for fixture "${fixture}". ` +
      `Required: ${emailKey}, ${passKey}, ${slugKey}. ` +
      `Check .env.e2e is present and populated.`
    );
  }

  return { fixture, email, password, workspaceSlug, company, plan, purpose };
}

/**
 * The five E2E accounts.
 * Defined lazily so guard failures happen at test time, not import time.
 */
export function getAccounts(): E2EAccount[] {
  return [
    loadAccount(
      'trial-a',
      'E2E_TRIAL_A_EMAIL',
      'E2E_TRIAL_A_PASSWORD',
      'E2E_TRIAL_A_SLUG',
      'E2E Trial Company A',
      'trial',
      'Trial restrictions and baseline flows'
    ),
    loadAccount(
      'starter-b',
      'E2E_STARTER_B_EMAIL',
      'E2E_STARTER_B_PASSWORD',
      'E2E_STARTER_B_SLUG',
      'E2E Starter Company B',
      'starter',
      'Core paid flows'
    ),
    loadAccount(
      'paid-c',
      'E2E_PAID_C_EMAIL',
      'E2E_PAID_C_PASSWORD',
      'E2E_PAID_C_SLUG',
      'E2E Paid Company C',
      'pro',
      'Higher-tier access'
    ),
    loadAccount(
      'cross-tenant-d',
      'E2E_CROSS_D_EMAIL',
      'E2E_CROSS_D_PASSWORD',
      'E2E_CROSS_D_SLUG',
      'E2E CrossTenant Company D',
      'starter',
      'Tenant isolation verification'
    ),
    loadAccount(
      'onboarding-e',
      'E2E_ONBOARD_E_EMAIL',
      'E2E_ONBOARD_E_PASSWORD',
      'E2E_ONBOARD_E_SLUG',
      'E2E Onboarding User E',
      'trial',
      'Repeatable onboarding gate'
    ),
  ];
}

/** Flat list of all known E2E account emails for guard checks */
export function getKnownAccountEmails(): string[] {
  return getAccounts().map((a) => a.email);
}

/** Get a single account by fixture name */
export function getAccount(fixture: string): E2EAccount {
  const accounts = getAccounts();
  const account = accounts.find((a) => a.fixture === fixture);
  if (!account) {
    throw new Error(
      `[e2e:accounts] Unknown fixture "${fixture}". Known: ${accounts.map((a) => a.fixture).join(', ')}`
    );
  }
  return account;
}
