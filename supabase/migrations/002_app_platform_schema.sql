-- ============================================
-- アプリプラットフォーム用スキーマ
-- ============================================

-- アプリテーブル（商品テーブルを置き換え）
CREATE TABLE IF NOT EXISTS apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  github_repo_url TEXT, -- GitHubリポジトリURL
  github_repo_full_name TEXT, -- owner/repo形式
  zip_file_url TEXT, -- Supabase StorageのURL（zipアップロード時）
  deployed_url TEXT, -- 公開後のURL（Vercel/Netlify）
  vercel_deployment_id TEXT, -- VercelデプロイメントID
  status VARCHAR(50) NOT NULL DEFAULT 'draft', -- draft, pending, published, rejected, failed
  invite_code_id UUID REFERENCES invite_codes(id),
  publish_price INTEGER DEFAULT 1000, -- 公開料（円、最小単位）
  stripe_price_id VARCHAR(255), -- Stripe Price ID
  thumbnail_url TEXT, -- サムネイル画像
  tech_stack TEXT[], -- 使用技術スタック
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- 公開リクエストログ
CREATE TABLE IF NOT EXISTS publish_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID REFERENCES apps(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  stripe_session_id VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, paid, failed, cancelled
  deploy_status VARCHAR(50), -- deploying, deployed, failed
  vercel_deployment_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- アプリプレビュー履歴（誰がどのアプリを見たか）
CREATE TABLE IF NOT EXISTS app_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID REFERENCES apps(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- アプリ評価・レビュー
CREATE TABLE IF NOT EXISTS app_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID REFERENCES apps(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(app_id, user_id) -- 1ユーザー1レビュー
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_apps_user_id ON apps(user_id);
CREATE INDEX IF NOT EXISTS idx_apps_status ON apps(status);
CREATE INDEX IF NOT EXISTS idx_apps_published_at ON apps(published_at);
CREATE INDEX IF NOT EXISTS idx_apps_github_repo_full_name ON apps(github_repo_full_name);
CREATE INDEX IF NOT EXISTS idx_publish_requests_app_id ON publish_requests(app_id);
CREATE INDEX IF NOT EXISTS idx_publish_requests_stripe_session_id ON publish_requests(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_app_views_app_id ON app_views(app_id);
CREATE INDEX IF NOT EXISTS idx_app_reviews_app_id ON app_reviews(app_id);

-- RLS (Row Level Security) ポリシー
ALTER TABLE apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE publish_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_reviews ENABLE ROW LEVEL SECURITY;

-- アプリは公開済みのものは全員閲覧可能、自分のものは全操作可能
CREATE POLICY "Published apps are viewable by everyone"
  ON apps FOR SELECT
  USING (status = 'published');

CREATE POLICY "Users can view their own apps"
  ON apps FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own apps"
  ON apps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own apps"
  ON apps FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own apps"
  ON apps FOR DELETE
  USING (auth.uid() = user_id);

-- 公開リクエストは自分のもののみ閲覧可能
CREATE POLICY "Users can view their own publish requests"
  ON publish_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own publish requests"
  ON publish_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- アプリビューは全員が記録可能
CREATE POLICY "Anyone can record app views"
  ON app_views FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view their own app views"
  ON app_views FOR SELECT
  USING (auth.uid() = user_id);

-- レビューは全員が閲覧可能、自分のものは編集可能
CREATE POLICY "Reviews are viewable by everyone"
  ON app_reviews FOR SELECT
  USING (true);

CREATE POLICY "Users can create reviews"
  ON app_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
  ON app_reviews FOR UPDATE
  USING (auth.uid() = user_id);

-- 古い商品テーブルは削除（必要に応じて）
-- DROP TABLE IF EXISTS order_items CASCADE;
-- DROP TABLE IF EXISTS products CASCADE;
-- DROP TABLE IF EXISTS orders CASCADE;
