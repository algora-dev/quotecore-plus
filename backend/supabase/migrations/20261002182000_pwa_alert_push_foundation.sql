-- Opt-in, alert-backed Web Push. No AI payloads or new business events.
-- Apply on staging first. This file has not been executed against a live DB.
BEGIN;
CREATE TABLE public.pwa_push_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, endpoint text NOT NULL UNIQUE CHECK (octet_length(endpoint)<=2048),
 p256dh text NOT NULL CHECK(p256dh ~ '^[A-Za-z0-9_-]{87}$'), auth_secret text NOT NULL CHECK(auth_secret ~ '^[A-Za-z0-9_-]{22}$'),
 vapid_public text NOT NULL CHECK(vapid_public ~ '^[A-Za-z0-9_-]{87}$'),
 categories text[] NOT NULL DEFAULT ARRAY['quotes','orders','invoices','suppliers']::text[] CHECK(categories <@ ARRAY['quotes','orders','invoices','suppliers']::text[] AND cardinality(categories)<=4),
 enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 consent_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
 UNIQUE(id,company_id,user_id),
 CHECK(endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com)/[^[:space:]#]+$')
);
CREATE INDEX pwa_push_active_owner ON public.pwa_push_subscriptions(company_id,user_id) WHERE enabled;
CREATE TABLE public.pwa_push_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subscription_id uuid NOT NULL, company_id uuid NOT NULL, user_id uuid NOT NULL,
 alert_id uuid NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
 category text NOT NULL CHECK(category IN ('quotes','orders','invoices','suppliers')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','leased','sent','dead')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5), available_at timestamptz NOT NULL DEFAULT now(),
 lease_token uuid, leased_until timestamptz, sent_at timestamptz, last_http_status integer,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(subscription_id,company_id,user_id) REFERENCES public.pwa_push_subscriptions(id,company_id,user_id) ON DELETE CASCADE,
 UNIQUE(alert_id,subscription_id)
);
CREATE INDEX pwa_push_due ON public.pwa_push_deliveries(available_at,created_at) WHERE status IN ('pending','leased');
CREATE INDEX pwa_push_retention ON public.pwa_push_deliveries(created_at);
ALTER TABLE public.pwa_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pwa_push_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY pwa_push_owner_read ON public.pwa_push_subscriptions FOR SELECT TO authenticated
 USING(user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.users u WHERE u.id=auth.uid() AND u.company_id=pwa_push_subscriptions.company_id));
CREATE POLICY pwa_push_delivery_owner_read ON public.pwa_push_deliveries FOR SELECT TO authenticated
 USING(user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.users u WHERE u.id=auth.uid() AND u.company_id=pwa_push_deliveries.company_id));
REVOKE ALL ON public.pwa_push_subscriptions,public.pwa_push_deliveries FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.pwa_push_subscriptions,public.pwa_push_deliveries TO authenticated;
GRANT ALL ON public.pwa_push_subscriptions,public.pwa_push_deliveries TO service_role;

CREATE FUNCTION public.pwa_push_category(p_type text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN p_type IN('quote_accepted','quote_declined','revision_requested','quote_viewed','quote_expired') THEN 'quotes'
 WHEN p_type IN('order_accepted','order_declined','order_info_requested','order_viewed') THEN 'orders'
 WHEN p_type IN('invoice_payment_reported','invoice_disputed','invoice_viewed') THEN 'invoices'
 WHEN p_type='supplier_update' THEN 'suppliers' ELSE NULL END
$$;
CREATE FUNCTION public.pwa_push_actor() RETURNS public.users LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u public.users;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT * INTO u FROM public.users WHERE id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR u.company_id IS NULL OR (u.mfa_required AND coalesce(auth.jwt()->>'aal','')<>'aal2') THEN
  RAISE EXCEPTION 'Current workspace membership and authentication required' USING ERRCODE='42501';
 END IF;
 RETURN u;
END $$;
CREATE FUNCTION public.pwa_push_subscribe(p_endpoint text,p_p256dh text,p_auth text,p_vapid_public text,p_categories text[]) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u public.users; s public.pwa_push_subscriptions; result uuid;
BEGIN
 u:=public.pwa_push_actor();
 IF p_endpoint IS NULL OR octet_length(p_endpoint)>2048 OR p_endpoint !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com)/[^[:space:]#]+$'
 OR p_p256dh IS NULL OR p_p256dh !~ '^[A-Za-z0-9_-]{87}$' OR p_auth IS NULL OR p_auth !~ '^[A-Za-z0-9_-]{22}$'
 OR p_vapid_public IS NULL OR p_vapid_public !~ '^[A-Za-z0-9_-]{87}$' OR p_categories IS NULL OR NOT(p_categories <@ ARRAY['quotes','orders','invoices','suppliers']::text[]) OR cardinality(p_categories)>4
 THEN RAISE EXCEPTION 'Invalid subscription' USING ERRCODE='22023'; END IF;
 SELECT * INTO s FROM public.pwa_push_subscriptions WHERE endpoint=p_endpoint FOR UPDATE;
 IF FOUND AND (s.company_id<>u.company_id OR s.user_id<>u.id) THEN
  RAISE EXCEPTION 'Recreate this browser subscription before enabling it for this account' USING ERRCODE='42501';
 END IF;
 IF (s.id IS NULL OR NOT s.enabled) AND (SELECT count(*) FROM public.pwa_push_subscriptions WHERE user_id=u.id AND company_id=u.company_id AND enabled)>=10 THEN
  RAISE EXCEPTION 'At most ten devices may be enabled per user' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.pwa_push_subscriptions(company_id,user_id,endpoint,p256dh,auth_secret,vapid_public,categories)
 VALUES(u.company_id,u.id,p_endpoint,p_p256dh,p_auth,p_vapid_public,p_categories)
 ON CONFLICT(endpoint) DO UPDATE SET p256dh=EXCLUDED.p256dh,auth_secret=EXCLUDED.auth_secret,vapid_public=EXCLUDED.vapid_public,categories=EXCLUDED.categories,
  enabled=true,consent_at=now(),last_seen_at=now(),revoked_at=NULL,updated_at=now()
 WHERE pwa_push_subscriptions.company_id=u.company_id AND pwa_push_subscriptions.user_id=u.id RETURNING id INTO result;
 IF result IS NULL THEN RAISE EXCEPTION 'Subscription ownership changed' USING ERRCODE='40001'; END IF;
 RETURN result;
END $$;
CREATE FUNCTION public.pwa_push_manage(p_operation text,p_subscription_id uuid DEFAULT NULL,p_endpoint text DEFAULT NULL,p_categories text[] DEFAULT NULL) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u public.users; s public.pwa_push_subscriptions;
BEGIN
 u:=public.pwa_push_actor();
 IF p_operation IS NULL OR p_operation NOT IN('disable','touch','preferences') OR (p_subscription_id IS NULL AND p_endpoint IS NULL) THEN RAISE EXCEPTION 'Invalid operation' USING ERRCODE='22023'; END IF;
 SELECT * INTO s FROM public.pwa_push_subscriptions WHERE company_id=u.company_id AND user_id=u.id
  AND (p_subscription_id IS NULL OR id=p_subscription_id) AND (p_endpoint IS NULL OR endpoint=p_endpoint) FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF p_operation='disable' THEN
  UPDATE public.pwa_push_subscriptions SET enabled=false,revoked_at=now(),updated_at=now() WHERE id=s.id;
  UPDATE public.pwa_push_deliveries SET status='dead',lease_token=NULL,leased_until=NULL WHERE subscription_id=s.id AND status IN('pending','leased');
 ELSIF p_operation='touch' THEN
  -- A heartbeat NEVER grants/re-grants consent, including after logout/revocation.
  IF NOT s.enabled THEN RETURN false; END IF;
  IF s.last_seen_at<now()-interval '10 minutes' THEN UPDATE public.pwa_push_subscriptions SET last_seen_at=now() WHERE id=s.id; END IF;
 ELSE
  IF p_categories IS NULL OR NOT(p_categories <@ ARRAY['quotes','orders','invoices','suppliers']::text[]) OR cardinality(p_categories)>4 THEN RAISE EXCEPTION 'Invalid categories' USING ERRCODE='22023'; END IF;
  UPDATE public.pwa_push_subscriptions SET categories=p_categories,updated_at=now() WHERE id=s.id;
  UPDATE public.pwa_push_deliveries SET status='dead',lease_token=NULL,leased_until=NULL WHERE subscription_id=s.id AND status IN('pending','leased') AND NOT(category=ANY(p_categories));
 END IF;
 RETURN true;
END $$;

CREATE FUNCTION public.pwa_push_enqueue_alert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE category text:=public.pwa_push_category(NEW.alert_type);
BEGIN
 IF category IS NULL OR NEW.status<>'active' OR coalesce(NEW.is_read,false) THEN RETURN NEW; END IF;
 INSERT INTO public.pwa_push_deliveries(subscription_id,company_id,user_id,alert_id,category)
 SELECT s.id,s.company_id,s.user_id,NEW.id,category FROM public.pwa_push_subscriptions s
 JOIN public.users u ON u.id=s.user_id AND u.company_id=s.company_id
 WHERE s.company_id=NEW.company_id AND s.enabled AND category=ANY(s.categories)
  AND s.last_seen_at>now()-interval '90 days' AND coalesce(NEW.created_at,now())>=s.consent_at
 ON CONFLICT(alert_id,subscription_id) DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER pwa_push_from_alert AFTER INSERT ON public.alerts FOR EACH ROW EXECUTE FUNCTION public.pwa_push_enqueue_alert();

-- One authoritative eligibility read is reused at claim and immediately before send.
CREATE FUNCTION public.pwa_push_eligible(p_delivery_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.pwa_push_deliveries d
 JOIN public.pwa_push_subscriptions s ON s.id=d.subscription_id AND s.company_id=d.company_id AND s.user_id=d.user_id
 JOIN public.users u ON u.id=s.user_id AND u.company_id=s.company_id
 JOIN public.alerts a ON a.id=d.alert_id AND a.company_id=d.company_id
 JOIN public.companies c ON c.id=d.company_id
 WHERE d.id=p_delivery_id AND d.created_at>now()-interval '24 hours' AND s.enabled AND d.category=ANY(s.categories)
 AND s.last_seen_at>now()-interval '90 days' AND coalesce(a.created_at,d.created_at)>=s.consent_at
 AND a.status='active' AND NOT coalesce(a.is_read,false)
 AND c.notification_prefs->a.alert_type IS DISTINCT FROM 'false'::jsonb
 AND (c.notification_prefs->a.alert_type)->'app' IS DISTINCT FROM 'false'::jsonb)
$$;
CREATE FUNCTION public.pwa_push_claim(p_limit integer DEFAULT 4) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service only' USING ERRCODE='42501'; END IF;
 WITH due AS(SELECT d.id FROM public.pwa_push_deliveries d
  WHERE (d.status='pending' OR (d.status='leased' AND d.leased_until<now())) AND d.available_at<=now() AND d.attempts<5
   AND public.pwa_push_eligible(d.id) ORDER BY d.created_at,d.id FOR UPDATE SKIP LOCKED LIMIT greatest(1,least(coalesce(p_limit,4),20))),
 claimed AS(UPDATE public.pwa_push_deliveries d SET status='leased',attempts=d.attempts+1,lease_token=gen_random_uuid(),leased_until=now()+interval '3 minutes'
  FROM due WHERE d.id=due.id RETURNING d.id,d.lease_token,d.attempts)
 SELECT coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) INTO result FROM claimed;
 RETURN result;
END $$;
CREATE FUNCTION public.pwa_push_current(p_delivery_id uuid,p_lease_token uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service only' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('endpoint',s.endpoint,'p256dh',s.p256dh,'auth',s.auth_secret,'vapid_public',s.vapid_public) INTO result
 FROM public.pwa_push_deliveries d JOIN public.pwa_push_subscriptions s ON s.id=d.subscription_id
 WHERE d.id=p_delivery_id AND d.status='leased' AND d.lease_token=p_lease_token AND d.leased_until>now() AND public.pwa_push_eligible(d.id);
 RETURN result;
END $$;
CREATE FUNCTION public.pwa_push_finish(p_delivery_id uuid,p_lease_token uuid,p_outcome text,p_http_status integer DEFAULT NULL,p_delay_seconds integer DEFAULT 0,p_revoke boolean DEFAULT false) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.pwa_push_deliveries;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service only' USING ERRCODE='42501'; END IF;
 IF p_outcome IS NULL OR p_outcome NOT IN('sent','dead','retry') OR p_delay_seconds NOT BETWEEN 0 AND 3600 THEN RAISE EXCEPTION 'Invalid result' USING ERRCODE='22023'; END IF;
 SELECT * INTO d FROM public.pwa_push_deliveries WHERE id=p_delivery_id AND status='leased' AND lease_token=p_lease_token FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.pwa_push_deliveries SET status=CASE WHEN p_outcome='retry' AND d.attempts<5 THEN 'pending' WHEN p_outcome='sent' THEN 'sent' ELSE 'dead' END,
  sent_at=CASE WHEN p_outcome='sent' THEN now() ELSE sent_at END,available_at=now()+make_interval(secs=>greatest(0,p_delay_seconds)),
  lease_token=NULL,leased_until=NULL,last_http_status=p_http_status WHERE id=d.id;
 IF p_revoke THEN
  UPDATE public.pwa_push_subscriptions SET enabled=false,revoked_at=now(),updated_at=now() WHERE id=d.subscription_id;
  UPDATE public.pwa_push_deliveries SET status='dead',lease_token=NULL,leased_until=NULL WHERE subscription_id=d.subscription_id AND status IN('pending','leased');
 END IF;
 RETURN true;
END $$;
CREATE FUNCTION public.pwa_push_cleanup() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service only' USING ERRCODE='42501'; END IF;
 UPDATE public.pwa_push_subscriptions SET enabled=false,revoked_at=now(),updated_at=now() WHERE enabled AND last_seen_at<now()-interval '90 days';
 UPDATE public.pwa_push_deliveries SET status='dead',lease_token=NULL,leased_until=NULL
 WHERE status IN('pending','leased') AND (created_at<now()-interval '24 hours' OR (attempts>=5 AND coalesce(leased_until,now())<=now()) OR NOT public.pwa_push_eligible(id));
 DELETE FROM public.pwa_push_deliveries WHERE created_at<now()-interval '30 days' AND status IN('sent','dead');
 DELETE FROM public.pwa_push_subscriptions WHERE NOT enabled AND revoked_at<now()-interval '30 days';
END $$;
REVOKE ALL ON FUNCTION public.pwa_push_category(text),public.pwa_push_actor(),public.pwa_push_enqueue_alert(),public.pwa_push_eligible(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.pwa_push_subscribe(text,text,text,text,text[]),public.pwa_push_manage(text,uuid,text,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pwa_push_subscribe(text,text,text,text,text[]),public.pwa_push_manage(text,uuid,text,text[]) TO authenticated;
REVOKE ALL ON FUNCTION public.pwa_push_claim(integer),public.pwa_push_current(uuid,uuid),public.pwa_push_finish(uuid,uuid,text,integer,integer,boolean),public.pwa_push_cleanup() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pwa_push_claim(integer),public.pwa_push_current(uuid,uuid),public.pwa_push_finish(uuid,uuid,text,integer,integer,boolean),public.pwa_push_cleanup() TO service_role;
COMMIT;
