-- テストモード用の招待トークンとアクセスログテーブル

-- appsテーブルにテストトークンを追加
ALTER TABLE apps
ADD COLUMN IF NOT EXISTS test_token UUID,
ADD COLUMN IF NOT EXISTS test_mode BOOLEAN DEFAULT false;

-- テストモード招待アクセスログテーブル
CREATE TABLE IF NOT EXISTS invite_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID REFERENCES apps(id) ON DELETE CASCADE NOT NULL,
  test_token UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- インデックス作成（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_invite_access_logs_token ON invite_access_logs(test_token);
CREATE INDEX IF NOT EXISTS idx_invite_access_logs_app_id ON invite_access_logs(app_id);
CREATE INDEX IF NOT EXISTS idx_invite_access_logs_user_id ON invite_access_logs(user_id);

-- RLS有効化
ALTER TABLE invite_access_logs ENABLE ROW LEVEL SECURITY;

-- ポリシー: ユーザーは自分のアクセスログを閲覧可能
CREATE POLICY "Users can view their own access logs"
  ON invite_access_logs FOR SELECT
  USING (auth.uid() = user_id);

-- ポリシー: アプリ作成者は自分のアプリのアクセスログを閲覧可能
CREATE POLICY "Creators can view their app's access logs"
  ON invite_access_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM apps
      WHERE apps.id = invite_access_logs.app_id
      AND apps.user_id = auth.uid()
    )
  );

-- システムがログを挿入可能（サービスロール）
-- 注意: サービスロールはRLSをバイパスするため、明示的なポリシーは不要
