-- Internal provider guard, separate from customer-facing Assistant Tasks.
-- No policy is enabled by this migration. The ACTIVE provider adapter must
-- be instrumented and tested before the agent enables a reviewed policy.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.qcp_assistant_budget_policies (
 stripe_account_id text NOT NULL,
 stripe_mode text NOT NULL CHECK(stripe_mode IN ('test','live')),
 enabled boolean NOT NULL DEFAULT false,
 max_calls_per_task integer NOT NULL CHECK(max_calls_per_task BETWEEN 1 AND 32),
 max_tokens_per_call bigint NOT NULL CHECK(max_tokens_per_call BETWEEN 1 AND 1000000),
 max_tokens_per_task bigint NOT NULL CHECK(max_tokens_per_task BETWEEN 1 AND 10000000),
 max_output_tokens integer NOT NULL CHECK(max_output_tokens BETWEEN 1 AND 100000),
 daily_user_tokens bigint NOT NULL CHECK(daily_user_tokens>0),
 daily_company_tokens bigint NOT NULL CHECK(daily_company_tokens>0),
 period_company_tokens bigint NOT NULL CHECK(period_company_tokens>0),
 reviewed_by text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(stripe_account_id,stripe_mode)
);
CREATE TABLE public.qcp_assistant_provider_calls (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
 task_event_id uuid NOT NULL REFERENCES public.qcp_usage_ledger(id) ON DELETE CASCADE,
 user_id uuid NOT NULL,
 call_key text NOT NULL CHECK(length(call_key) BETWEEN 1 AND 160),
 payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'),
 reserved_tokens bigint NOT NULL CHECK(reserved_tokens>0),
 charged_tokens bigint NOT NULL CHECK(charged_tokens>=0),
 output_limit integer NOT NULL CHECK(output_limit>0),
 state text NOT NULL CHECK(state IN ('reserved','settled','uncertain')),
 overrun boolean NOT NULL DEFAULT false,
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 completed_at timestamptz,
 UNIQUE(task_event_id,call_key)
);
CREATE INDEX qcp_provider_company_day_idx ON public.qcp_assistant_provider_calls(company_id,created_at);
ALTER TABLE public.qcp_assistant_budget_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qcp_assistant_provider_calls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qcp_assistant_budget_policies,public.qcp_assistant_provider_calls FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.qcp_assistant_budget_policies,public.qcp_assistant_provider_calls TO service_role;

-- This trigger runs BEFORE the task-meter trigger. Failed admission creates
-- neither a task debit nor a run/message. Previously accepted duplicates still
-- return through sa_admit_run's existing duplicate-first branch.
CREATE FUNCTION public.qcp_assistant_budget_ready()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE c jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.companies WHERE id=NEW.company_id AND billing_model='custom_setup') THEN RETURN NEW; END IF;
 PERFORM 1 FROM public.companies WHERE id=NEW.company_id FOR NO KEY UPDATE;
 c:=public.qcp_usage_context(NEW.company_id);
 IF NOT EXISTS(SELECT 1 FROM public.qcp_assistant_budget_policies
  WHERE stripe_account_id=c->>'accountId' AND stripe_mode=c->>'mode' AND enabled) THEN
  RAISE EXCEPTION 'custom_assistant_provider_not_ready' USING ERRCODE='QCP08';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.qcp_assistant_budget_ready() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER qcp_assistant_budget_ready BEFORE INSERT ON public.assistant_turn_reservations
 FOR EACH ROW EXECUTE FUNCTION public.qcp_assistant_budget_ready();

CREATE FUNCTION public.qcp_begin_assistant_call(p_company_id uuid,p_run_id uuid,p_account_id text,p_mode text,p_call_key text,
 p_payload_hash text,p_reserved_tokens bigint,p_output_limit integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE c jsonb; t public.qcp_usage_ledger%ROWTYPE; policy public.qcp_assistant_budget_policies%ROWTYPE;
 old_call public.qcp_assistant_provider_calls%ROWTYPE; n bigint; calls_n bigint; id_n uuid;
 day_start timestamptz := date_trunc('day',clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
BEGIN
 PERFORM 1 FROM public.companies WHERE id=p_company_id FOR NO KEY UPDATE;
 c:=public.qcp_usage_context(p_company_id);
 IF c IS NULL OR c->>'accountId' IS DISTINCT FROM p_account_id OR c->>'mode' IS DISTINCT FROM p_mode THEN RAISE EXCEPTION 'custom_provider_guard_only' USING ERRCODE='QCP08'; END IF;
 SELECT * INTO t FROM public.qcp_usage_ledger WHERE company_id=p_company_id AND resource='assistant'
  AND metadata->>'runId'=p_run_id::text AND state='consumed';
 IF NOT FOUND OR t.stripe_account_id<>c->>'accountId' OR t.stripe_mode<>c->>'mode'
  OR t.subscription_id<>c->>'subscriptionId' OR t.created_at<clock_timestamp()-interval '30 minutes' THEN
  RAISE EXCEPTION 'accepted_assistant_task_required' USING ERRCODE='QCP08';
 END IF;
 SELECT * INTO old_call FROM public.qcp_assistant_provider_calls WHERE task_event_id=t.id AND call_key=p_call_key;
 IF FOUND THEN
  IF old_call.payload_hash IS DISTINCT FROM p_payload_hash THEN RAISE EXCEPTION 'provider_call_conflict' USING ERRCODE='QCP03'; END IF;
  -- A transport retry must NOT cause another billable provider request.
  RAISE EXCEPTION 'provider_call_already_attempted' USING ERRCODE='QCP03';
 END IF;
 SELECT * INTO policy FROM public.qcp_assistant_budget_policies
  WHERE stripe_account_id=t.stripe_account_id AND stripe_mode=t.stripe_mode AND enabled;
 IF NOT FOUND THEN RAISE EXCEPTION 'custom_provider_guard_not_ready' USING ERRCODE='QCP08'; END IF;
 IF p_reserved_tokens IS NULL OR p_reserved_tokens<1 OR p_reserved_tokens>policy.max_tokens_per_call
   OR p_output_limit IS NULL OR p_output_limit<1 OR p_output_limit>policy.max_output_tokens
   OR p_reserved_tokens<p_output_limit THEN
  RAISE EXCEPTION 'provider_request_outside_budget' USING ERRCODE='QCP08';
 END IF;
 IF EXISTS(SELECT 1 FROM public.qcp_assistant_provider_calls WHERE company_id=p_company_id AND overrun AND reviewed_at IS NULL) THEN
  RAISE EXCEPTION 'provider_budget_review_required' USING ERRCODE='QCP08';
 END IF;
 SELECT count(*),COALESCE(sum(charged_tokens),0) INTO calls_n,n FROM public.qcp_assistant_provider_calls WHERE task_event_id=t.id;
 IF calls_n>=policy.max_calls_per_task OR n+p_reserved_tokens>policy.max_tokens_per_task THEN
  RAISE EXCEPTION 'assistant_task_processing_limit' USING ERRCODE='QCP08';
 END IF;
 SELECT COALESCE(sum(charged_tokens),0) INTO n FROM public.qcp_assistant_provider_calls
   WHERE company_id=p_company_id AND user_id=(t.metadata->>'userId')::uuid AND created_at>=day_start;
 IF n+p_reserved_tokens>policy.daily_user_tokens THEN RAISE EXCEPTION 'assistant_safety_limit' USING ERRCODE='QCP08'; END IF;
 SELECT COALESCE(sum(charged_tokens),0) INTO n FROM public.qcp_assistant_provider_calls WHERE company_id=p_company_id AND created_at>=day_start;
 IF n+p_reserved_tokens>policy.daily_company_tokens THEN RAISE EXCEPTION 'assistant_safety_limit' USING ERRCODE='QCP08'; END IF;
 SELECT COALESCE(sum(pc.charged_tokens),0) INTO n FROM public.qcp_assistant_provider_calls pc
 JOIN public.qcp_usage_ledger e ON e.id=pc.task_event_id WHERE e.company_id=p_company_id
  AND e.stripe_account_id=t.stripe_account_id AND e.stripe_mode=t.stripe_mode
  AND e.subscription_id=t.subscription_id AND e.period_start=t.period_start;
 IF n+p_reserved_tokens>policy.period_company_tokens THEN RAISE EXCEPTION 'assistant_safety_limit' USING ERRCODE='QCP08'; END IF;
 INSERT INTO public.qcp_assistant_provider_calls(company_id,task_event_id,user_id,call_key,payload_hash,
  reserved_tokens,charged_tokens,output_limit,state)
 VALUES(p_company_id,t.id,(t.metadata->>'userId')::uuid,p_call_key,p_payload_hash,
  p_reserved_tokens,p_reserved_tokens,p_output_limit,'reserved') RETURNING id INTO id_n;
 RETURN jsonb_build_object('id',id_n,'maxOutputTokens',p_output_limit);
END $$;
REVOKE ALL ON FUNCTION public.qcp_begin_assistant_call(uuid,uuid,text,text,text,text,bigint,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.qcp_begin_assistant_call(uuid,uuid,text,text,text,text,bigint,integer) TO service_role;

CREATE FUNCTION public.qcp_finish_assistant_call(p_company_id uuid,p_call_id uuid,p_actual_tokens bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r public.qcp_assistant_provider_calls%ROWTYPE; breach boolean;
BEGIN
 PERFORM 1 FROM public.companies WHERE id=p_company_id FOR NO KEY UPDATE;
 SELECT * INTO r FROM public.qcp_assistant_provider_calls WHERE id=p_call_id AND company_id=p_company_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'provider_call_missing' USING ERRCODE='QCP03'; END IF;
 IF r.state='settled' THEN RETURN jsonb_build_object('settled',true,'overrun',r.overrun); END IF;
 IF p_actual_tokens IS NOT NULL AND p_actual_tokens<0 THEN RAISE EXCEPTION 'invalid_provider_usage' USING ERRCODE='22023'; END IF;
 breach:=p_actual_tokens IS NOT NULL AND p_actual_tokens>r.reserved_tokens;
 UPDATE public.qcp_assistant_provider_calls SET charged_tokens=COALESCE(p_actual_tokens,reserved_tokens),
   state=CASE WHEN p_actual_tokens IS NULL THEN 'uncertain' ELSE 'settled' END,
   overrun=breach,completed_at=clock_timestamp() WHERE id=r.id;
 RETURN jsonb_build_object('settled',p_actual_tokens IS NOT NULL,'overrun',breach);
END $$;
REVOKE ALL ON FUNCTION public.qcp_finish_assistant_call(uuid,uuid,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.qcp_finish_assistant_call(uuid,uuid,bigint) TO service_role;
COMMIT;
