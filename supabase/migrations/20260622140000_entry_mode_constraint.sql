-- Extend the entry_mode CHECK constraint to include the new item types
-- introduced with the order modal redesign: 'linear' (formerly 'multiple'),
-- 'area', and 'volume'. 'single' and 'multiple' kept for back-compat.
ALTER TABLE public.material_order_lines
  DROP CONSTRAINT material_order_lines_entry_mode_check;

ALTER TABLE public.material_order_lines
  ADD CONSTRAINT material_order_lines_entry_mode_check
    CHECK (entry_mode = ANY (ARRAY[
      'single'::text,
      'multiple'::text,
      'linear'::text,
      'area'::text,
      'volume'::text
    ]));
