-- Order public page actions reworked to: Accept / Decline / Request Info.
--
-- Maps to stored response.action values + order status timestamps:
--   Accept       -> action 'confirm'        -> material_orders.confirmed_at
--   Decline      -> action 'decline'        -> material_orders.declined_at  (NEW)
--   Request Info -> action 'request_info'   -> material_orders.info_requested_at (NEW)
--
-- We extend the action check constraint to accept the new explicit values
-- ('decline', 'request_info') while keeping the legacy values so historical
-- rows ('request_changes','question','other') stay valid.

ALTER TABLE public.material_orders
  ADD COLUMN IF NOT EXISTS declined_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS info_requested_at timestamptz NULL;

ALTER TABLE public.material_order_responses
  DROP CONSTRAINT IF EXISTS material_order_responses_action_check;

ALTER TABLE public.material_order_responses
  ADD CONSTRAINT material_order_responses_action_check
  CHECK (action = ANY (ARRAY[
    'confirm'::text,
    'decline'::text,
    'request_info'::text,
    -- legacy values retained for historical rows:
    'request_changes'::text,
    'question'::text,
    'other'::text
  ]));
