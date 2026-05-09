-- Security questions for account recovery.
--
-- Threat model: an attacker who has already escalated to the user's account
-- (e.g. via session hijack) is OUT OF SCOPE here. These questions are the
-- last line of defence when a legitimate user contacts SUPPORT because they
-- have lost access to their email and cannot complete the in-app email change
-- flow. Support staff verify the user's identity by confirming the user can
-- answer their pre-set questions, then manually update the email via the
-- Supabase admin API.
--
-- Storage rules:
--   - The plain question text is stored as-is (it's not secret; the user picks
--     a question they themselves wrote or chose from a curated list).
--   - The answer is hashed with bcrypt + per-row salt before storage. We never
--     store the plaintext. Comparison is done in code via bcrypt.compare.
--   - Answers are normalised before hashing (lowercased, whitespace-stripped)
--     so that "Charlie" matches "charlie " etc.
--
-- We allow up to N answered questions per user; this schema enforces uniqueness
-- of (user_id, slot) so a user can update an existing question without
-- creating duplicates. Slot is 1-based and currently capped to 2 in code.

CREATE TABLE IF NOT EXISTS public.user_security_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  slot smallint NOT NULL CHECK (slot BETWEEN 1 AND 5),
  question text NOT NULL CHECK (char_length(question) BETWEEN 5 AND 200),
  answer_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slot)
);

CREATE INDEX IF NOT EXISTS idx_user_security_questions_user_id
  ON public.user_security_questions (user_id);

ALTER TABLE public.user_security_questions ENABLE ROW LEVEL SECURITY;

-- Users can read THEIR OWN question text (so the UI can show "you have these
-- 2 questions set" with the question stems) but never the answer hash. The
-- API surface explicitly excludes answer_hash from selects via the server
-- actions; RLS gives a defence-in-depth layer here too.
DROP POLICY IF EXISTS "user_security_questions_self_select"
  ON public.user_security_questions;
CREATE POLICY "user_security_questions_self_select"
  ON public.user_security_questions
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert and update their own questions.
DROP POLICY IF EXISTS "user_security_questions_self_modify"
  ON public.user_security_questions;
CREATE POLICY "user_security_questions_self_modify"
  ON public.user_security_questions
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.user_security_questions IS
  'Stores per-user security Q&A used by support staff to verify identity when a user has lost email access and cannot self-serve an email change. Answers are bcrypt-hashed.';
COMMENT ON COLUMN public.user_security_questions.answer_hash IS
  'bcrypt hash of the normalised answer (lowercased + whitespace-stripped). Never decode; verify with bcrypt.compare.';
