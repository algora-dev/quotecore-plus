/**
 * Versioned Account & Fixture State Matrix
 *
 * Acceptance criterion 4.10: fixture-state drift produces a fixture-state error,
 * not a misleading product failure.
 *
 * Before each mutation test, verify the account's plan/state matches what
 * the test expects. If drift is detected, skip with a "fixture drift" reason.
 */

export interface FixtureState {
  /** Account fixture name */
  fixture: string;
  /** Expected plan code visible in UI */
  expectedPlan: string;
  /** Expected onboarding state */
  onboardingComplete: boolean;
  /** Expected company name */
  expectedCompany: string;
  /** Features this account should have access to */
  features: string[];
  /** Features this account should NOT have access to */
  blockedFeatures: string[];
}

/**
 * The canonical fixture state matrix.
 * Version bump when fixture state changes.
 */
export const FIXTURE_MATRIX_VERSION = 1;

export const FIXTURE_MATRIX: FixtureState[] = [
  {
    fixture: 'trial-a',
    expectedPlan: 'Trial',
    onboardingComplete: true,
    expectedCompany: 'E2E Trial Company A',
    features: ['quotes', 'customers', 'invoices', 'orders', 'manual-takeoff'],
    blockedFeatures: ['catalogue', 'ai-assist', 'bulk-operations'],
  },
  {
    fixture: 'starter-b',
    expectedPlan: 'Starter',
    onboardingComplete: true,
    expectedCompany: 'E2E Starter Company B',
    features: ['quotes', 'customers', 'invoices', 'orders', 'manual-takeoff', 'catalogue'],
    blockedFeatures: ['ai-assist-high-tier'],
  },
  {
    fixture: 'paid-c',
    expectedPlan: 'Pro',
    onboardingComplete: true,
    expectedCompany: 'E2E Paid Company C',
    features: ['quotes', 'customers', 'invoices', 'orders', 'manual-takeoff', 'catalogue', 'ai-assist'],
    blockedFeatures: [],
  },
  {
    fixture: 'cross-tenant-d',
    expectedPlan: 'Starter',
    onboardingComplete: true,
    expectedCompany: 'E2E CrossTenant Company D',
    features: ['quotes', 'customers', 'invoices', 'orders', 'manual-takeoff', 'catalogue'],
    blockedFeatures: ['cross-tenant-access'],
  },
  {
    fixture: 'onboarding-e',
    expectedPlan: 'Trial',
    onboardingComplete: false,
    expectedCompany: 'E2E Onboarding User E',
    features: ['onboarding'],
    blockedFeatures: ['workspace', 'quotes', 'customers'],
  },
];

/** Get the expected fixture state for an account */
export function getFixtureState(fixture: string): FixtureState {
  const state = FIXTURE_MATRIX.find((s) => s.fixture === fixture);
  if (!state) {
    throw new Error(`[e2e:matrix] Unknown fixture "${fixture}"`);
  }
  return state;
}
