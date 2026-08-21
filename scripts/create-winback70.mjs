/**
 * One-off: create the "70% off first month" win-back promo code.
 * Uses whichever Stripe mode STRIPE_SECRET_KEY points at (test or live).
 *
 * Run: node scripts/create-winback70.mjs
 */

import Stripe from 'stripe';
import { randomBytes } from 'node:crypto';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const CODE = 'WELCOME70'; // copy-pasteable, fits checkout box
const MAX_REDEMPTIONS = 20;

async function main() {
  // Coupon: 70% off, first billing cycle only
  const coupon = await stripe.coupons.create({
    name: '70% off 1st month (winback aug26)',
    percent_off: 70,
    duration: 'once',
    metadata: { quotecore_admin_visible: 'true', campaign: 'winback_aug_2026' },
  });

  // Promotion code: the string users type at checkout
  const promo = await stripe.promotionCodes.create({
    coupon: coupon.id,
    code: CODE,
    max_redemptions: MAX_REDEMPTIONS,
    // one redemption per customer across ALL Stripe promotion codes
    restrictions: { first_time_transaction: false },
  });

  console.log('mode key prefix:', (process.env.STRIPE_SECRET_KEY || '').slice(0, 12));
  console.log('coupon:', coupon.id, coupon.name);
  console.log('promo code:', promo.code, promo.id);
  console.log('max_redemptions:', promo.max_redemptions);
  console.log('restrictions:', JSON.stringify(promo.restrictions));
}

main().catch((e) => { console.error(e.message); process.exit(1); });
