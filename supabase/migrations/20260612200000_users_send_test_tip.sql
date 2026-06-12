-- "Test it on yourself first" send tip. Fires ONCE per user, on the first time
-- they send ANY of quote / order / invoice. Additive + nullable = safe.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS send_test_tip_seen_at timestamptz;

COMMENT ON COLUMN public.users.send_test_tip_seen_at IS
  'When the user dismissed the one-time "test-send to yourself first" tip (shown on their first quote/order/invoice send). NULL = not yet shown.';
