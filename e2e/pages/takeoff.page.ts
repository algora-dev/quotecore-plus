/**
 * Takeoff Page Object
 */
import type { Page } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-testing.vercel.app';

export class TakeoffPage {
  constructor(private page: Page) {}

  async goto(slug: string, quoteId: string) {
    await this.page.goto(`${BASE_URL}/${slug}/quotes/${quoteId}/takeoff`);
  }

  /** Upload a plan file */
  async uploadPlan(filePath: string) {
    const fileInput = this.page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(filePath);
  }

  /** Click the calibration tool button if visible */
  async clickCalibrate() {
    const calBtn = this.page.getByRole('button', { name: /calibrat/i }).first();
    if (await calBtn.isVisible()) {
      await calBtn.click();
    }
  }
}
