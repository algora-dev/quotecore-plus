/**
 * One-off script: create admin-visible Stripe coupons.
 *
 * Run: node scripts/create-admin-coupons.mjs
 *
 * Creates 5 coupons in the current Stripe mode (test or live, based on
 * STRIPE_SECRET_KEY). Each coupon has metadata.quotecore_admin_visible = 'true'
 * so the admin UI can filter them from the full coupon list.
 *
 * Safe to re-run: checks for existing coupons by name before creating.
 */

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const COUPONS = [
  { name: '25% off forever', percent_off: 25, duration: 'forever' },
  { name: '50% off forever', percent_off: 50, duration: 'forever' },
  { name: '75% off forever', percent_off: 75, duration: 'forever' },
  { name: '100% off forever', percent_off: 100, duration: 'forever' },
  { name: '50% off once',    percent_off: 50, duration: 'once' },
];

async function main() {
  const existing = await stripe.coupons.list({ limit: 100 });
  const existingNames = new Set(existing.data.map((c) => c.name));

  for (const spec of COUPONS) {
    if (existingNames.has(spec.name)) {
      console.log(`  SKIP  "${spec.name}" already exists`);
      continue;
    }
    const coupon = await stripe.coupons.create({
      name: spec.name,
      percent_off: spec.percent_off,
      duration: spec.duration,
      metadata: { quotecore_admin_visible: 'true' },
    });
    console.log(`  CREATED  "${spec.name}" → ${coupon.id}`);
  }

  console.log('\nDone. Coupons are now visible in the admin user profile coupon dropdown.');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
