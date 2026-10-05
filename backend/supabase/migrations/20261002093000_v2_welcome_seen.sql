-- V2 rollout: one-time welcome modal per user (v2_welcome_seen_at).
-- Additive + nullable: users who have not dismissed the V2 welcome see it once.
alter table public.users add column if not exists v2_welcome_seen_at timestamptz;
