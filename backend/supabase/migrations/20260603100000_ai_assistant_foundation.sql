-- =============================================================================
-- AI Assistant — Foundation schema (Phase 0B)
-- =============================================================================
-- Plan: docs/ChatAssistant/AI-ASSISTANT-MVP-PLAN.md (Gerald-reviewed).
--
-- Additive, nullable-safe. One DB serves dev+main (standing permission); no
-- destructive changes. Creates:
--   1. pgvector extension
--   2. doc_chunks            — semantic doc index (service-role only, REVOKEd)
--   3. assistant_sessions    — chat sessions (RLS owner/company)
--   4. assistant_messages    — chat turns (RLS via session)
--   5. assistant_events      — tool/highlight audit (metadata only)
--   6. assistant_token_usage — token-budget accounting (service-role only)
--   7. assistant_workflow_progress — headless workflow progress (NOT copilot_progress)
--
-- Security notes:
--   * doc_chunks + assistant_token_usage are NEVER client-readable. Explicit
--     REVOKE from anon, authenticated, PUBLIC (Gerald M-05; Supabase grants
--     anon AND authenticated separately — revoke both + PUBLIC).
--   * No secrets / signed URLs / acceptance URLs are ever stored in message
--     or event content (enforced in app layer; Gerald M-04).
-- =============================================================================

-- 1. pgvector --------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. doc_chunks (semantic knowledge index) ---------------------------------
-- Non-tenant, public knowledge. Service-layer only — never queried directly
-- by clients. text-embedding-3-small => 1536 dims.
CREATE TABLE IF NOT EXISTS doc_chunks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL,
  section       TEXT NOT NULL DEFAULT '',
  heading       TEXT NOT NULL DEFAULT '',
  chunk_index   INTEGER NOT NULL DEFAULT 0,
  content       TEXT NOT NULL,
  token_count   INTEGER NOT NULL DEFAULT 0,
  content_hash  TEXT NOT NULL,
  embedding     vector(1536) NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (slug, chunk_index)
);

-- Cosine-distance ANN index. Lists sized for a small corpus (~95 docs).
CREATE INDEX IF NOT EXISTS idx_doc_chunks_embedding
  ON doc_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_slug ON doc_chunks (slug);

-- Lock down: service role only. Enable RLS with NO policies so even a leaked
-- anon/authenticated grant cannot read rows; then revoke table grants too.
ALTER TABLE doc_chunks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON doc_chunks FROM anon, authenticated, PUBLIC;

-- 3. assistant_sessions ----------------------------------------------------
CREATE TABLE IF NOT EXISTS assistant_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title          TEXT,
  -- 'user'    => private to creator; 'company' => visible to teammates.
  visibility     TEXT NOT NULL DEFAULT 'user'
                   CHECK (visibility IN ('user', 'company')),
  retention_until TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assistant_sessions_user ON assistant_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_assistant_sessions_company ON assistant_sessions (company_id);

ALTER TABLE assistant_sessions ENABLE ROW LEVEL SECURITY;

-- Read: owner always; teammates only when visibility='company' and same company.
CREATE POLICY "assistant_sessions_select" ON assistant_sessions
  FOR SELECT USING (
    user_id = auth.uid()
    OR (
      visibility = 'company'
      AND company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Write/update/delete: owner only.
CREATE POLICY "assistant_sessions_insert" ON assistant_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "assistant_sessions_update" ON assistant_sessions
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "assistant_sessions_delete" ON assistant_sessions
  FOR DELETE USING (user_id = auth.uid());

-- 4. assistant_messages ----------------------------------------------------
CREATE TABLE IF NOT EXISTS assistant_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES assistant_sessions(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content      TEXT NOT NULL DEFAULT '',
  tool_calls   JSONB,
  tool_results JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assistant_messages_session
  ON assistant_messages (session_id, created_at);

ALTER TABLE assistant_messages ENABLE ROW LEVEL SECURITY;

-- Visibility inherited from the parent session's SELECT policy.
CREATE POLICY "assistant_messages_select" ON assistant_messages
  FOR SELECT USING (
    session_id IN (SELECT id FROM assistant_sessions)
  );
-- Inserts: only into a session the caller owns.
CREATE POLICY "assistant_messages_insert" ON assistant_messages
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT id FROM assistant_sessions WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "assistant_messages_delete" ON assistant_messages
  FOR DELETE USING (
    session_id IN (
      SELECT id FROM assistant_sessions WHERE user_id = auth.uid()
    )
  );

-- 5. assistant_events (audit — metadata only) ------------------------------
-- Tool calls / highlight requests. NO raw prompts, chunks, or context
-- snapshots (Gerald M-04). Service-role written; not client-readable.
CREATE TABLE IF NOT EXISTS assistant_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID REFERENCES assistant_sessions(id) ON DELETE SET NULL,
  user_id     UUID,
  company_id  UUID,
  event_type  TEXT NOT NULL,
  tool_name   TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assistant_events_session ON assistant_events (session_id);
CREATE INDEX IF NOT EXISTS idx_assistant_events_company_time
  ON assistant_events (company_id, created_at);

ALTER TABLE assistant_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON assistant_events FROM anon, authenticated, PUBLIC;

-- 6. assistant_token_usage (cost accounting) -------------------------------
-- Per-user + per-company token counters, bucketed by day + month. Service
-- role only. usage_date is the UTC day; month_key is 'YYYY-MM'.
CREATE TABLE IF NOT EXISTS assistant_token_usage (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date   DATE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')::date,
  month_key    TEXT NOT NULL DEFAULT to_char(NOW() AT TIME ZONE 'utc', 'YYYY-MM'),
  total_tokens BIGINT NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_assistant_token_usage_company_day
  ON assistant_token_usage (company_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_assistant_token_usage_company_month
  ON assistant_token_usage (company_id, month_key);

ALTER TABLE assistant_token_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON assistant_token_usage FROM anon, authenticated, PUBLIC;

-- 7. assistant_workflow_progress -------------------------------------------
-- Headless workflow progress for the assistant. Deliberately SEPARATE from
-- copilot_progress (Gerald H-03) so retiring Copilot never touches it.
CREATE TABLE IF NOT EXISTS assistant_workflow_progress (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workflows_completed TEXT[] NOT NULL DEFAULT '{}',
  current_workflow  TEXT,
  current_step      TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_assistant_workflow_progress_user
  ON assistant_workflow_progress (user_id);

ALTER TABLE assistant_workflow_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assistant_workflow_progress_own" ON assistant_workflow_progress
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- Retrieval RPC: match_doc_chunks
-- =============================================================================
-- SECURITY DEFINER so the service layer can query the locked-down doc_chunks
-- table via RPC. We still REVOKE from client roles so only the service role
-- (or server-side callers) can execute it.
CREATE OR REPLACE FUNCTION match_doc_chunks(
  query_embedding vector(1536),
  match_count     INTEGER DEFAULT 5,
  filter_section  TEXT DEFAULT NULL
)
RETURNS TABLE (
  slug        TEXT,
  section     TEXT,
  heading     TEXT,
  chunk_index INTEGER,
  content     TEXT,
  similarity  REAL
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    dc.slug,
    dc.section,
    dc.heading,
    dc.chunk_index,
    dc.content,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM doc_chunks dc
  WHERE filter_section IS NULL OR dc.section = filter_section
  ORDER BY dc.embedding <=> query_embedding
  LIMIT GREATEST(1, LEAST(match_count, 20));
$$;

REVOKE ALL ON FUNCTION match_doc_chunks(vector, INTEGER, TEXT)
  FROM anon, authenticated, PUBLIC;
