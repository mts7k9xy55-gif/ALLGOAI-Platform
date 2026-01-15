# アーキテクチャ

## システム概要

AllGo Appsは、**アプリをアップロードして即公開できるプラットフォーム**です。

### コアフロー

```
1. クリエイターがアプリをアップロード（GitHub URL or ZIP）
   ↓
2. アプリ情報をSupabaseに保存（status: 'draft'）
   ↓
3. クリエイターが「公開」をクリック
   ↓
4. Stripe Checkoutで決済（¥1,000）
   ↓
5. 決済成功Webhookで自動デプロイ（Vercel API）
   ↓
6. デプロイ完了でstatus: 'published'に更新
   ↓
7. ユーザーがブラウザ内でプレビュー or 公開URLにアクセス
```

## 技術スタック

### フロントエンド
- **Next.js 14** (App Router)
- **React 18**
- **Tailwind CSS**
- **Sandpack** (コードプレビュー)

### バックエンド
- **Next.js API Routes** (サーバーレス)
- **Supabase** (PostgreSQL + Auth + Storage)
- **Stripe** (決済)

### デプロイ
- **Vercel** (自動デプロイ)
- **GitHub Actions** (CI/CD)

## データベース設計

### apps テーブル
アプリのメタデータを管理

```sql
- id: UUID (PK)
- user_id: UUID (FK → auth.users)
- name: VARCHAR(255)
- description: TEXT
- github_repo_url: TEXT
- github_repo_full_name: TEXT (owner/repo)
- zip_file_url: TEXT (Supabase Storage)
- deployed_url: TEXT (公開後URL)
- vercel_deployment_id: TEXT
- status: VARCHAR(50) (draft, pending, published, rejected, failed)
- invite_code_id: UUID (FK → invite_codes)
- publish_price: INTEGER
- created_at: TIMESTAMPTZ
- published_at: TIMESTAMPTZ
```

### publish_requests テーブル
公開リクエストと決済・デプロイの状態を管理

```sql
- id: UUID (PK)
- app_id: UUID (FK → apps)
- user_id: UUID (FK → auth.users)
- stripe_session_id: VARCHAR(255)
- stripe_payment_intent_id: VARCHAR(255)
- status: VARCHAR(50) (pending, paid, failed)
- deploy_status: VARCHAR(50) (deploying, deployed, failed)
- vercel_deployment_url: TEXT
- error_message: TEXT
```

## API設計

### `/api/publish/checkout`
公開リクエストのStripe Checkout Sessionを作成

**Request:**
```json
{
  "app_id": "uuid",
  "user_id": "uuid",
  "amount": 1000
}
```

**Response:**
```json
{
  "sessionId": "cs_xxx"
}
```

### `/api/deploy/vercel`
Vercel APIを使ってアプリをデプロイ

**Request:**
```json
{
  "app_id": "uuid",
  "github_repo_full_name": "owner/repo"
}
```

**Response:**
```json
{
  "success": true,
  "deployment_url": "https://app-xxx.vercel.app",
  "deployment_id": "dpl_xxx"
}
```

### `/api/webhook` (Stripe)
決済成功時に自動デプロイをトリガー

## セキュリティ

### Row Level Security (RLS)
- アプリは公開済みのみ全員閲覧可能
- 自分のアプリのみ編集可能
- 公開リクエストは自分のもののみ閲覧可能

### 認証
- Supabase Auth（匿名認証も可能）
- 招待コードで初期アクセス制限

### ファイルアップロード
- Supabase Storage
- ユーザーごとのディレクトリ分離
- 認証済みユーザーのみアップロード可能

## デプロイフロー

1. **GitHubリポジトリの場合**
   - GitHub APIでリポジトリ情報を取得
   - Vercel APIでプロジェクト作成
   - デプロイ実行

2. **ZIPファイルの場合**
   - Supabase Storageにアップロード
   - ZIPを展開して一時的にGitHubにプッシュ（または直接Vercelにデプロイ）
   - デプロイ実行

## 今後の拡張

- [ ] WebContainerを使った完全なブラウザ内実行
- [ ] カスタムドメイン設定
- [ ] アプリの更新機能
- [ ] クリエイター収益シェア（Stripe Connect）
- [ ] アプリのバージョン管理
- [ ] プレビュー環境（ステージング）
