-- TEST ONLY. Smaller allowances make boundary tests fast, not catalogue changes.
INSERT INTO public.subscription_plans(code,monthly_quote_limit,ai_assist_points_limit,feat_digital_takeoff,feat_email_send)
 VALUES('starter',999999999,NULL,false,true),('professional',999999999,50,true,true),
 ('pro_plus',999999999,100,true,true),('free',0,NULL,false,false);
CREATE FUNCTION qcp_test.add_company(custom boolean, limits jsonb DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE co uuid:=gen_random_uuid(); a timestamptz:=clock_timestamp()-interval '10 days'; z timestamptz:=a+interval '30 days';
 sub text:='sub_'||replace(co::text,'-',''); cus text:='cus_'||replace(co::text,'-','');
BEGIN
 INSERT INTO public.companies(id,name,plan_code,subscription_status,billing_model,stripe_mode,stripe_customer_id,stripe_subscription_id)
 VALUES(co,'P2 disposable fixture','professional','active',CASE WHEN custom THEN 'custom_setup' ELSE 'legacy' END,'test',cus,sub);
 INSERT INTO public.users(id,company_id) VALUES(co,co);
 INSERT INTO public.assistant_feature_flags(company_id,enabled,quota_monthly_turns) VALUES(co,true,500);
 IF custom THEN
 INSERT INTO public.company_custom_billing(company_id,stripe_account_id,stripe_mode,stripe_customer_id,stripe_subscription_id,
  catalog_id,catalog_revision,component_codes,purchased_entitlements,provider_status,currency,monthly_cents,period_start,period_end,last_paid_invoice_id)
 VALUES(co,'acct_P2fixture','test',cus,sub,'fixture','fixture','[]',limits,'active','usd',14900,a,z,'in_fixture');
 INSERT INTO public.custom_billing_period_grants(company_id,stripe_mode,subscription_id,period_start,period_end,invoice_id,granted_limits)
 VALUES(co,'test',sub,a,z,'in_fixture',limits);
 END IF;
 RETURN co;
END $$;
CREATE FUNCTION qcp_test.default_limits() RETURNS jsonb LANGUAGE sql AS $$
 SELECT '{"capacity":"low","quotes":5,"storageBytes":100,"digitalTakeoff":true,"scanTokens":50,"offcuts":true,"assistantTasks":2}'::jsonb $$;
CREATE FUNCTION qcp_test.new_conversation(co uuid) RETURNS uuid LANGUAGE plpgsql AS $$ DECLARE id_n uuid;
BEGIN INSERT INTO smart_assistant_conversations(company_id,user_id) VALUES(co,co) RETURNING id INTO id_n; RETURN id_n; END $$;
CREATE FUNCTION qcp_test.enable_policy() RETURNS void LANGUAGE sql AS $$
 INSERT INTO qcp_assistant_budget_policies(stripe_account_id,stripe_mode,enabled,max_calls_per_task,max_tokens_per_call,
 max_tokens_per_task,max_output_tokens,daily_user_tokens,daily_company_tokens,period_company_tokens,reviewed_by)
 VALUES('acct_P2fixture','test',true,4,500,1000,100,5000,8000,10000,'DISPOSABLE TEST ONLY')
 ON CONFLICT(stripe_account_id,stripe_mode) DO UPDATE SET enabled=true $$;
CREATE FUNCTION qcp_test.renew(co uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE b company_custom_billing%ROWTYPE; a timestamptz:=clock_timestamp()-interval '1 minute'; z timestamptz:=a+interval '30 days';
BEGIN
 SELECT * INTO b FROM company_custom_billing WHERE company_id=co;
 -- Test clock simulation only. Production never edits an old grant like this.
 UPDATE custom_billing_period_grants SET period_end=a WHERE company_id=co AND period_start=b.period_start;
 UPDATE qcp_usage_ledger SET period_end=a WHERE company_id=co AND period_start=b.period_start;
 UPDATE company_custom_billing SET period_start=a,period_end=z,last_paid_invoice_id='in_next' WHERE company_id=co;
 INSERT INTO custom_billing_period_grants(company_id,stripe_mode,subscription_id,period_start,period_end,invoice_id,granted_limits)
 VALUES(co,b.stripe_mode,b.stripe_subscription_id,a,z,'in_next',b.purchased_entitlements);
END $$;
