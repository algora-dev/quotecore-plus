/**
 * Quotes Page Object
 */
import type { Page } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-testing.vercel.app';

export class QuotesPage {
  constructor(private page: Page) {}

  async goto(slug: string) {
    await this.page.goto(`${BASE_URL}/${slug}/quotes`);
  }

  /** Click "Create" or "New" quote button */
  async clickCreate() {
    // Look for create/new link or button
    const createBtn = this.page.getByRole('link', { name: /create|new/i }).first();
    await createBtn.click();
  }

  /** Get all visible quote rows */
  getQuoteRows() {
    return this.page.locator('a[href*="/quotes/"], [data-quote-id]');
  }

  /** Find a quote by its visible text (customer name or job name) */
  findQuote(text: string) {
    return this.page.getByText(text).first();
  }

  /** Get the quote count from the page */
  async getQuoteCount(): Promise<number> {
    return await this.getQuoteRows().count();
  }
}
