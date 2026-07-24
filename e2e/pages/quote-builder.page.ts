/**
 * Quote Builder Page Object
 */
import type { Page } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-dev.vercel.app';

export class QuoteBuilderPage {
  constructor(private page: Page) {}

  async goto(slug: string, quoteId: string) {
    await this.page.goto(`${BASE_URL}/${slug}/quotes/${quoteId}/build`);
  }

  /** Fill quote name/label */
  async fillQuoteName(name: string) {
    const nameInput = this.page.getByLabel(/quote name|job name/i).first();
    if (await nameInput.isVisible()) {
      await nameInput.fill(name);
    }
  }

  /** Fill customer name */
  async fillCustomerName(name: string) {
    const customerInput = this.page.getByLabel(/customer/i).first();
    if (await customerInput.isVisible()) {
      await customerInput.fill(name);
    }
  }

  /** Save the quote */
  async save() {
    const saveBtn = this.page.getByRole('button', { name: /save/i }).first();
    await saveBtn.click();
  }
}
