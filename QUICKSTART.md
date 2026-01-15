# 🚀 5分で始める - AllGo Apps

**アプリをアップロードして即公開できるプラットフォーム**

## ステップ1: GitHubにプッシュ

```bash
# リポジトリを初期化
git init
git add .
git commit -m "Initial commit"
git branch -M main

# GitHubで新しいリポジトリを作成後、以下を実行
git remote add origin https://github.com/your-username/allgo-apps.git
git push -u origin main
```

## ステップ2: Vercelでデプロイ

1. [vercel.com](https://vercel.com)にアクセス
2. GitHubでログイン
3. "New Project"をクリック
4. リポジトリを選択
5. 環境変数を設定（下記）
6. "Deploy"をクリック

**完了！** 数分で自動デプロイされます。

## ステップ3: 環境変数の設定

Vercelのプロジェクト設定で以下を追加：

| 変数名 | 説明 | 取得方法 |
|--------|------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | SupabaseプロジェクトURL | Supabase Dashboard > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase公開キー | Supabase Dashboard > Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabaseサービスロールキー | Supabase Dashboard > Settings > API |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe公開キー | Stripe Dashboard > Developers > API keys |
| `STRIPE_SECRET_KEY` | Stripe秘密キー | Stripe Dashboard > Developers > API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook署名 | Stripe Dashboard > Developers > Webhooks |
| `NEXT_PUBLIC_APP_URL` | アプリのURL | Vercelデプロイ後のURL |
| `VERCEL_TOKEN` | Vercel APIトークン | Vercel Settings > Tokens |
| `GITHUB_TOKEN` | GitHub APIトークン（オプション） | GitHub Settings > Developer settings > Personal access tokens |

## ステップ4: Supabaseのセットアップ

1. [Supabase](https://supabase.com)でプロジェクトを作成
2. SQL Editorを開く
3. `supabase/migrations/001_initial_schema.sql`の内容をコピー＆実行（招待コード用）
4. `supabase/migrations/002_app_platform_schema.sql`の内容をコピー＆実行（**重要**）
5. `supabase/functions/increment_invite_code_use.sql`の内容をコピー＆実行
6. Storage > Buckets で `app-uploads` バケットを作成（または `supabase/storage/create_bucket.sql` を実行）

## ステップ5: Stripeのセットアップ

1. [Stripe](https://stripe.com)でアカウントを作成
2. 商品と価格を作成（Price IDをメモ）
3. Webhookエンドポイントを追加：
   - URL: `https://your-app.vercel.app/api/webhook`
   - イベント: `checkout.session.completed`, `checkout.session.async_payment_failed`
   - Signing secretをコピーして環境変数に設定

## ステップ6: 管理者アカウントの作成

1. Supabase Dashboard > Authentication
2. "Add user"で管理者アカウントを作成
3. `/admin/login`でログイン

## ✅ 完了！

これでプラットフォームが稼働しています！

- ホーム: `https://your-app.vercel.app`
- アップロード: `https://your-app.vercel.app/creators/upload`
- 管理画面: `https://your-app.vercel.app/admin`

## 次のステップ

1. **招待コードを生成**（管理画面）
2. **アプリをアップロード**（GitHub URL or ZIP）
3. **公開して決済**（¥1,000）
4. **自動デプロイ完了**を確認
5. **ユーザーがブラウザ内でプレビュー**！

## 使い方

### クリエイター
1. `/creators/upload` でアプリをアップロード
2. アプリ詳細で「公開」をクリック
3. 決済完了後、自動でVercelにデプロイ

### ユーザー
1. ホームで招待コードを入力
2. アプリ一覧から選択
3. ブラウザ内で即時プレビュー

## 🆘 トラブルシューティング

### ビルドエラー
- 環境変数が正しく設定されているか確認
- Vercelのログを確認

### Webhookが動作しない
- StripeダッシュボードでWebhook URLが正しいか確認
- Webhookイベントを確認

### データベースエラー
- SupabaseのURLとキーが正しいか確認
- SQLマイグレーションが実行されているか確認
