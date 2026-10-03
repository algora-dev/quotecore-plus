import type { SupabaseClient } from '@supabase/supabase-js';
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type Subscription = { id: string; company_id: string; user_id: string; endpoint: string; p256dh: string; auth_secret: string; vapid_public: string; categories: string[]; enabled: boolean; created_at: string; updated_at: string; consent_at: string; last_seen_at: string; revoked_at: string | null };
type Delivery = { id: string; company_id: string; user_id: string; subscription_id: string; alert_id: string; category: string; status: string; attempts: number; available_at: string; lease_token: string | null; leased_until: string | null; sent_at: string | null; last_http_status: number | null; created_at: string };
type Table<Row> = { Row: Row; Insert: never; Update: never; Relationships: [] };
/** Local additive migration contract; regenerate the main Database types on integration. */
type PushDatabase = { public: {
 Tables: { pwa_push_subscriptions: Table<Subscription>; pwa_push_deliveries: Table<Delivery> };
 Views: Record<string, never>; Enums: Record<string, never>; CompositeTypes: Record<string, never>;
 Functions: {
  pwa_push_subscribe: { Args: { p_endpoint: string; p_p256dh: string; p_auth: string; p_vapid_public: string; p_categories: string[] }; Returns: string };
  pwa_push_manage: { Args: { p_operation: string; p_subscription_id?: string | null; p_endpoint?: string | null; p_categories?: string[] | null }; Returns: boolean };
  pwa_push_claim: { Args: { p_limit: number }; Returns: Json };
  pwa_push_current: { Args: { p_delivery_id: string; p_lease_token: string }; Returns: Json };
  pwa_push_finish: { Args: { p_delivery_id: string; p_lease_token: string; p_outcome: string; p_http_status?: number | null; p_delay_seconds?: number; p_revoke?: boolean }; Returns: boolean };
  pwa_push_cleanup: { Args: Record<string, never>; Returns: undefined };
 };
} };
export const pushDatabase = (client: unknown) => client as SupabaseClient<PushDatabase>;
