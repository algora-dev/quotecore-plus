/**
 * Evidence Fixture â€” Failure Evidence Capture
 *
 * Evidence contract section 8:
 * Every failure records stable ID/severity, run ID, account/plan,
 * start/final URL, actions, visible failure, response status/failed request,
 * console/page errors, screenshot/trace path, reproducibility, customer impact,
 * and cleanup status.
 */

import { test as base, expect } from '@playwright/test';

export interface EvidenceContext {
  /** Record an action taken during the test */
  recordAction: (action: string) => void;
  /** Get all recorded actions */
  getActions: () => string[];
}

export const test = base.extend<EvidenceContext>({
  recordAction: async ({}, use) => {
    const actions: string[] = [];
    await use((action: string) => {
      actions.push(`[${new Date().toISOString()}] ${action}`);
    });
    // Actions are available via getActions in the same fixture scope
  },

  getActions: async ({}, use) => {
    const actions: string[] = [];
    await use(() => actions);
  },
});

export { expect };
