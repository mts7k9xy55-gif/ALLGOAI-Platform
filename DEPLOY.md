# デプロイガイド

このプロジェクトは、GitHubにプッシュするだけで自動的にデプロイできます。

## 🚀 クイックスタート

### 1. GitHubリポジトリの作成

```bash
# 新しいリポジトリを作成（GitHub上で）
# または既存のリポジトリを使用
```

### 2. プロジェクトをGitHubにプッシュ

```bash
cd store
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/your-username/invite-store.git
git push -u origin main
```

## 📦 デプロイ方法

### オプション1: Vercel（推奨・最も簡単）

1. **Vercelにログイン**
   - [vercel.com](https://vercel.com)にアクセス
   - GitHubアカウントでログイン

2. **プロジェクトをインポート**
   - "New Project"をクリック
   - GitHubリポジトリを選択
   - ルートディレクトリが`store`の場合は、Root Directoryを`store`に設定

3. **環境変数を設定**
   - 以下の環境変数を追加：
     ```
     NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
     SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
     NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
     STRIPE_SECRET_KEY=your_stripe_secret_key
     STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
     NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
     ```

4. **デプロイ**
   - "Deploy"をクリック
   - 数分で完了！

5. **Webhook URLの更新**
   - StripeダッシュボードでWebhook URLを更新：
     `https://your-app.vercel.app/api/webhook`

### オプション2: Netlify

1. **Netlifyにログイン**
   - [netlify.com](https://netlify.com)にアクセス
   - GitHubアカウントでログイン

2. **プロジェクトをインポート**
   - "Add new site" > "Import an existing project"
   - GitHubリポジトリを選択
   - ビルド設定：
     - Build command: `npm run build`
     - Publish directory: `.next`

3. **環境変数を設定**
   - Site settings > Environment variables
   - 上記と同じ環境変数を追加

4. **デプロイ**
   - 自動的にデプロイが開始されます

### オプション3: GitHub Pages（静的エクスポートが必要）

Next.jsを静的エクスポートする必要があります（API Routesは使用不可）。

## 🔧 環境変数の設定

### Vercelの場合

1. プロジェクト設定 > Environment Variables
2. 各環境（Production, Preview, Development）に設定

### Netlifyの場合

1. Site settings > Environment variables
2. 環境変数を追加

### GitHub Secrets（CI/CD用）

リポジトリのSettings > Secrets and variables > Actionsで設定：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL`

## 📝 Supabaseマイグレーション

### 手動実行

1. Supabaseダッシュボードにログイン
2. SQL Editorを開く
3. `supabase/migrations/001_initial_schema.sql`を実行
4. `supabase/functions/increment_invite_code_use.sql`を実行

### GitHub Actionsで自動実行

1. GitHub Secretsに以下を追加：
   - `SUPABASE_ACCESS_TOKEN`
   - `SUPABASE_DB_URL`
   - `SUPABASE_DB_PASSWORD`

2. `.github/workflows/supabase-migration.yml`が自動実行されます

## 🔄 継続的デプロイ

- **Vercel/Netlify**: `main`ブランチへのプッシュで自動デプロイ
- **GitHub Actions**: ビルドテストを実行

## 🌐 カスタムドメイン

### Vercel

1. Project Settings > Domains
2. ドメインを追加
3. DNS設定を更新

### Netlify

1. Site settings > Domain management
2. カスタムドメインを追加
3. DNS設定を更新

## 🐛 トラブルシューティング

### ビルドエラー

- 環境変数が正しく設定されているか確認
- ログを確認してエラーを特定

### Webhookが動作しない

- Webhook URLが正しいか確認
- Stripeダッシュボードでイベントを確認

### データベース接続エラー

- SupabaseのURLとキーが正しいか確認
- RLSポリシーを確認

## 📚 参考リンク

- [Vercel Documentation](https://vercel.com/docs)
- [Netlify Documentation](https://docs.netlify.com)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
