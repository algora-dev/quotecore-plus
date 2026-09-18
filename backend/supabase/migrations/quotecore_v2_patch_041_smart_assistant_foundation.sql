-- Smart Assistant for QuoteCore+ - Phase 1 foundation (REV 2 plan, 2026-09-17)
-- Additive only. Private-transcript policy LOCKED (owner-only conversation access;
-- not even company admins read members' conversations). Config + knowledge shared
-- per company. Reuses assistant_token_usage for metering (no parallel ledger).

-- 1. Shared per-company assistant configuration (one per company in V1)
CREATE TABLE IF NOT EXISTS public.assistant_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Assistant',
  greeting text NOT NULL DEFAULT '',
  rule_toggles jsonb NOT NULL DEFAULT '{}'::jsonb,
  custom_rules text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT false,
  config_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Knowledge documents (upload lifecycle; atomic publish via status)
CREATE TABLE IF NOT EXISTS public.assistant_knowledge_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  size_bytes bigint,
  status text NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded','processing','ready','failed','withdrawn')),
  error text,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  withdrawn_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_sa_knowledge_docs_company
  ON public.assistant_knowledge_docs(company_id, status);

-- 3. Knowledge chunks (pgvector, tenant-scoped)
CREATE TABLE IF NOT EXISTS public.assistant_knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id uuid NOT NULL REFERENCES public.assistant_knowledge_docs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  token_count integer,
  content_hash text,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doc_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS idx_sa_knowledge_chunks_company
  ON public.assistant_knowledge_chunks(company_id);
CREATE INDEX IF NOT EXISTS idx_sa_knowledge_chunks_embedding
  ON public.assistant_knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 4. Private conversations (OWNER-ONLY access - locked policy)
CREATE TABLE IF NOT EXISTS public.smart_assistant_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  config_snapshot_at timestamptz,
  title text,
  active_run_id uuid,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sa_conversations_user
  ON public.smart_assistant_conversations(user_id, last_active_at DESC);

-- 5. Messages within conversations
CREATE TABLE IF NOT EXISTS public.smart_assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.smart_assistant_conversations(id) ON DELETE CASCADE,
  run_id uuid,
  role text NOT NULL CHECK (role IN ('user','assistant','tool')),
  content text NOT NULL,
  tool_calls jsonb,
  sources jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sa_messages_conversation
  ON public.smart_assistant_messages(conversation_id, created_at);

-- 6. Runs (turn admission / idempotency / one active turn per conversation)
CREATE TABLE IF NOT EXISTS public.smart_assistant_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.smart_assistant_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  client_request_id text NOT NULL,
  payload_hash text NOT NULL,
  status text NOT NULL DEFAULT 'accepted'
    CHECK (status IN ('accepted','running','completed','failed','cancelled','interrupted')),
  error_code text,
  tokens_in bigint DEFAULT 0,
  tokens_out bigint DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (conversation_id, client_request_id)
);
CREATE INDEX IF NOT EXISTS idx_sa_runs_conversation
  ON public.smart_assistant_runs(conversation_id, started_at DESC);

-- RLS ------------------------------------------------------------------

ALTER TABLE public.assistant_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_knowledge_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_assistant_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_assistant_runs ENABLE ROW LEVEL SECURITY;

-- Helper: company membership (mirrors existing patterns; users table keyed by auth.uid())
CREATE OR REPLACE FUNCTION public.sa_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.sa_user_company_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sa_user_company_id() TO authenticated;

-- Configs: members read; writes server-side only (service role)
DROP POLICY IF EXISTS sa_configs_select ON public.assistant_configs;
CREATE POLICY sa_configs_select ON public.assistant_configs
  FOR SELECT TO authenticated
  USING (company_id = public.sa_user_company_id());

-- Knowledge docs/chunks: members read (only ready docs served by RPC;
-- raw select allows all statuses for the admin portal)
DROP POLICY IF EXISTS sa_knowledge_docs_select ON public.assistant_knowledge_docs;
CREATE POLICY sa_knowledge_docs_select ON public.assistant_knowledge_docs
  FOR SELECT TO authenticated
  USING (company_id = public.sa_user_company_id());

DROP POLICY IF EXISTS sa_knowledge_chunks_select ON public.assistant_knowledge_chunks;
CREATE POLICY sa_knowledge_chunks_select ON public.assistant_knowledge_chunks
  FOR SELECT TO authenticated
  USING (company_id = public.sa_user_company_id());

-- Conversations: OWNER ONLY (private transcripts - locked 2026-09-17)
DROP POLICY IF EXISTS sa_conversations_all ON public.smart_assistant_conversations;
CREATE POLICY sa_conversations_all ON public.smart_assistant_conversations
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND company_id = public.sa_user_company_id());

-- Messages: via owning conversation
DROP POLICY IF EXISTS sa_messages_all ON public.smart_assistant_messages;
CREATE POLICY sa_messages_all ON public.smart_assistant_messages
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.smart_assistant_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.smart_assistant_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));

-- Runs: owner read-only (writes server-side)
DROP POLICY IF EXISTS sa_runs_select ON public.smart_assistant_runs;
CREATE POLICY sa_runs_select ON public.smart_assistant_runs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Tenant-scoped semantic retrieval: authorization applied INSIDE the query
-- (never fetch-global-then-filter). Only 'ready' docs in scope.
CREATE OR REPLACE FUNCTION public.match_sa_chunks(
  p_query_embedding vector(1536),
  p_match_count integer DEFAULT 5,
  p_company uuid DEFAULT NULL
)
RETURNS TABLE (
  chunk_id uuid,
  doc_id uuid,
  company_id uuid,
  content text,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.doc_id, c.company_id, c.content,
         1 - (c.embedding <=> p_query_embedding) AS similarity
  FROM public.assistant_knowledge_chunks c
  JOIN public.assistant_knowledge_docs d ON d.id = c.doc_id
  WHERE d.status = 'ready'
    AND c.company_id = COALESCE(p_company, c.company_id)
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT LEAST(GREATEST(p_match_count, 1), 20)
$$;
REVOKE ALL ON FUNCTION public.match_sa_chunks(vector, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_sa_chunks(vector, integer, uuid) TO authenticated;

-- Enable pgvector extension if not present (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;
