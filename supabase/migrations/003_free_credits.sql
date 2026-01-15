-- 無料クレジット機能追加

-- アプリテーブルに無料クレジットフィールドを追加
ALTER TABLE apps ADD COLUMN IF NOT EXISTS free_credits INTEGER DEFAULT 100;
ALTER TABLE apps ADD COLUMN IF NOT EXISTS free_credits_used INTEGER DEFAULT 0;
ALTER TABLE apps ADD COLUMN IF NOT EXISTS category VARCHAR(50); -- 'trending', 'latest', 'ai-tool', 'other'

-- クレジット使用履歴テーブル
CREATE TABLE IF NOT EXISTS credit_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID REFERENCES apps(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  credits_used INTEGER NOT NULL DEFAULT 1,
  usage_type VARCHAR(50) NOT NULL, -- 'preview', 'api_call', 'execution'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_usage_app_id ON credit_usage(app_id);
CREATE INDEX IF NOT EXISTS idx_credit_usage_user_id ON credit_usage(user_id);

-- RLS
ALTER TABLE credit_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own credit usage"
  ON credit_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can record credit usage"
  ON credit_usage FOR INSERT
  WITH CHECK (true);
