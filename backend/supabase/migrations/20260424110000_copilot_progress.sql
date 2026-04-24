-- Copilot tutorial progress tracking
CREATE TABLE IF NOT EXISTS copilot_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  copilot_enabled BOOLEAN DEFAULT true,
  guides_completed TEXT[] DEFAULT '{}',
  current_guide TEXT DEFAULT NULL,
  current_step INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_copilot_progress_user ON copilot_progress(user_id);

ALTER TABLE copilot_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "copilot_own_progress" ON copilot_progress
  FOR ALL USING (user_id = auth.uid());
