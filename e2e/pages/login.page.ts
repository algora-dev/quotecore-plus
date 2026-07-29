/**
 * Login Page Object
 */
import type { Page } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-testing.vercel.app';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto(`${BASE_URL}/login`);
  }

  async fillEmail(email: string) {
    await this.page.locator('input[name="email"]').fill(email);
  }

  async fillPassword(password: string) {
    await this.page.locator('input[name="password"]').fill(password);
  }

  async submit() {
    await this.page.getByRole('button', { name: /log in/i }).click();
  }

  async login(email: string, password: string) {
    await this.goto();
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
    // Wait for navigation away from /login
    await this.page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 30_000,
    });
  }

  getErrorMessage() {
    return this.page.locator('[role="alert"], .text-red-600, .text-red-700').first();
  }
}
