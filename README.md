# AllGo Apps - アプリプラットフォーム

**全員エンジニア社会へ** - アプリをアップロードして即公開できるプラットフォーム

Next.js + Supabase + Stripe + WebContainerを使用した、招待コード制限付きのアプリ公開プラットフォームです。

## 🚀 機能

- ✅ **アプリアップロード**: GitHubリポジトリURL or ZIPファイル
- ✅ **課金即公開**: Stripe決済で即座にデプロイ
- ✅ **自動デプロイ**: Vercel API連携で自動デプロイ
- ✅ **ブラウザ内プレビュー**: WebContainerで即時実行
- ✅ **招待コードシステム**: 5件限定、期限付きで初期公開
- ✅ **クリエイター管理**: 自分のアプリを一元管理
- ✅ **PWA対応**: ホーム画面に追加してネイティブアプリ並みの速度で起動

## セットアップ

### 1. 依存関係のインストール

```bash
cd store
npm install
```

### 2. 環境変数の設定

`.env.local`ファイルを作成し、以下の環境変数を設定してください：

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Groq (セキュリティレビュー用)
GROQ_API_KEY=your_groq_api_key

# GitHub (オプション、リポジトリ取得用)
GITHUB_TOKEN=your_github_token

# Figma (Figma連携用)
FIGMA_ACCESS_TOKEN=your_figma_access_token

# Builder.io (FigmaからReactコード生成用)
BUILDER_API_KEY=your_builder_api_key
BUILDER_SPACE_ID=your_builder_space_id

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Supabaseのセットアップ

1. [Supabase](https://supabase.com)でプロジェクトを作成
2. SQL Editorで`supabase/migrations/001_initial_schema.sql`を実行
3. SQL Editorで`supabase/functions/increment_invite_code_use.sql`を実行

### 4. Stripeのセットアップ

1. [Stripe](https://stripe.com)でアカウントを作成
2. 商品と価格を作成し、Price IDを取得
3. Webhookエンドポイントを設定：
   - URL: `https://your-domain.com/api/webhook`
   - イベント: `checkout.session.completed`, `checkout.session.async_payment_failed`

### 5. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

### PWA機能

本番環境では、スマートフォンのホーム画面に追加するとネイティブアプリのように高速に起動できます。

詳細は [PWA_SETUP.md](./PWA_SETUP.md) を参照してください。

## 使い方

### クリエイター（アプリ開発者）

1. **アプリをアップロード**
   - `/creators/upload`にアクセス
   - GitHubリポジトリURLを入力 or ZIPファイルをアップロード
   - 基本情報（名前、説明）を入力

2. **公開と決済**
   - アプリ詳細ページで「公開」をクリック
   - Stripe Checkoutで決済（¥1,000）
   - 決済成功後、自動でVercelにデプロイ

3. **管理**
   - `/creators/apps`で自分のアプリ一覧を確認

### ユーザー（アプリ利用者）

1. **招待コード入力**
   - ホームページで招待コードを入力
   - コードが有効な場合、アプリ一覧が表示

2. **アプリを試す**
   - アプリ一覧から選択
   - ブラウザ内で即時プレビュー
   - 公開サイトにアクセス可能

## データベーススキーマ

### apps
- アプリ情報
- GitHubリポジトリURL or ZIPファイルURL
- デプロイURL、ステータス管理

### publish_requests
- 公開リクエストログ
- Stripe決済情報、デプロイステータス

### invite_codes
- 招待コード情報（初期公開制限用）

### app_views
- アプリ閲覧履歴

### app_reviews
- アプリ評価・レビュー

## セキュリティ

- Row Level Security (RLS) を有効化
- ユーザーは自分の注文のみ閲覧可能
- 管理者のみが招待コードと商品を管理可能

## 🚀 デプロイ（GitHub経由）

### クイックデプロイ

1. **GitHubリポジトリを作成**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/your-username/invite-store.git
   git push -u origin main
   ```

2. **Vercelでデプロイ（推奨）**
   - [vercel.com](https://vercel.com)にアクセス
   - GitHubアカウントでログイン
   - "New Project" > リポジトリを選択
   - 環境変数を設定（下記参照）
   - "Deploy"をクリック
   - **完了！** 数分で自動デプロイされます

3. **Netlifyでデプロイ**
   - [netlify.com](https://netlify.com)にアクセス
   - GitHubアカウントでログイン
   - "Add new site" > リポジトリを選択
   - 環境変数を設定
   - 自動デプロイ開始

詳細は [DEPLOY.md](./DEPLOY.md) を参照してください。

### 環境変数（デプロイ時に設定）

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

## ライセンス

MIT
