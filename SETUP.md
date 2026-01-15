# セットアップガイド

## 1. Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com)にアクセスしてアカウントを作成
2. 新しいプロジェクトを作成
3. プロジェクトのURLとAPIキーを取得：
   - Settings > API > Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Settings > API > anon public → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Settings > API > service_role → `SUPABASE_SERVICE_ROLE_KEY`（秘密にしてください）

## 2. データベーススキーマの設定

1. Supabaseダッシュボードで「SQL Editor」を開く
2. `supabase/migrations/001_initial_schema.sql`の内容をコピー＆ペーストして実行
3. `supabase/functions/increment_invite_code_use.sql`の内容をコピー＆ペーストして実行

## 3. Stripeアカウントの設定

1. [Stripe](https://stripe.com)にアクセスしてアカウントを作成
2. ダッシュボードでAPIキーを取得：
   - Developers > API keys > Publishable key → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - Developers > API keys > Secret key → `STRIPE_SECRET_KEY`
3. 商品と価格を作成：
   - Products > Add product
   - 価格を作成後、Price IDをコピー（商品管理画面で使用）
4. Webhookエンドポイントを設定：
   - Developers > Webhooks > Add endpoint
   - Endpoint URL: `https://your-domain.com/api/webhook`
   - イベントを選択: `checkout.session.completed`, `checkout.session.async_payment_failed`
   - Signing secretをコピー → `STRIPE_WEBHOOK_SECRET`

## 4. 環境変数の設定

`.env.local`ファイルを作成：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 5. 依存関係のインストール

```bash
cd store
npm install
```

## 6. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## 7. 管理者アカウントの作成

1. Supabaseダッシュボードで「Authentication」を開く
2. 「Add user」で管理者アカウントを作成
3. `/admin/login`でログイン

## 8. 初期設定

1. `/admin`にアクセス
2. 招待コードを生成（最大使用回数: 5、有効期限: 7日など）
3. 商品を追加（Stripe Price IDを設定）

## トラブルシューティング

### 招待コードが機能しない

- SupabaseのRLSポリシーを確認
- `increment_invite_code_use`関数が正しく作成されているか確認

### Stripe決済が完了しない

- Webhookエンドポイントが正しく設定されているか確認
- StripeダッシュボードでWebhookイベントを確認

### 管理画面にアクセスできない

- 管理者アカウントがSupabaseで作成されているか確認
- 認証状態を確認
