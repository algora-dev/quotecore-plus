-- Migration: 20260714180000_fix_quote_usage_trigger_on_company_delete.sql
-- Purpose: When a company is deleted, ON DELETE CASCADE removes its quotes.
--   The trg_quote_status_usage AFTER DELETE trigger fires on each quote and
--   tries to INSERT into company_quote_usage (company_id, ...) — but the
--   company row is already gone, so the FK check fails with:
--   "insert or update on table company_quote_usage violates foreign key
--    constraint company_quote_usage_company_id_fkey"
-- Fix: Guard the trigger body — skip the usage update if the company no
--   longer exists. This is safe because we're deleting the company anyway;
--   the usage counter is meaningless without the company.

CREATE OR REPLACE FUNCTION public.fn_quote_status_usage_delta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period date := date_trunc('month', (now() AT TIME ZONE 'UTC'))::date;
  v_company_exists boolean;
BEGIN
  -- Only fire on status changes where OLD was 'draft' and NEW is not 'draft'.
  -- This is the "first real save" — draft becomes confirmed/sent/etc.
  IF (TG_OP = 'UPDATE') THEN
    IF OLD.status = 'draft' AND NEW.status <> 'draft' THEN
      INSERT INTO public.company_quote_usage (company_id, period_start, quotes_created)
      VALUES (NEW.company_id, v_period, 1)
      ON CONFLICT (company_id, period_start)
        DO UPDATE SET quotes_created = company_quote_usage.quotes_created + 1;
    ELSIF OLD.status <> 'draft' AND NEW.status = 'draft' THEN
      -- Reverting back to draft: refund the slot.
      INSERT INTO public.company_quote_usage (company_id, period_start, quotes_created)
      VALUES (NEW.company_id, v_period, 0)
      ON CONFLICT (company_id, period_start)
        DO UPDATE SET quotes_created = GREATEST(company_quote_usage.quotes_created - 1, 0);
    END IF;
    RETURN NEW;
  END IF;

  -- On hard delete of a non-draft quote: refund the slot.
  -- BUT skip if the company is being deleted (cascade) — the company row
  -- is already gone, so the FK insert would fail and there's no point
  -- maintaining a usage counter for a deleted company.
  IF (TG_OP = 'DELETE') THEN
    IF OLD.status <> 'draft' THEN
      SELECT EXISTS(SELECT 1 FROM public.companies WHERE id = OLD.company_id)
        INTO v_company_exists;
      IF v_company_exists THEN
        INSERT INTO public.company_quote_usage (company_id, period_start, quotes_created)
        VALUES (OLD.company_id, v_period, 0)
        ON CONFLICT (company_id, period_start)
          DO UPDATE SET quotes_created = GREATEST(company_quote_usage.quotes_created - 1, 0);
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.fn_quote_status_usage_delta() IS
  'Updated 2026-07-14: guards DELETE path against company being mid-cascade-delete. '
  'Prevents FK violation on company_quote_usage when companies row is deleted (cascade removes quotes, trigger fires, company already gone).';
