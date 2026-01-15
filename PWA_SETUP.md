# PWA設定ガイド

## 概要

AllGo AppsはPWA（Progressive Web App）対応です。スマートフォンやタブレットのホーム画面に追加すると、ネイティブアプリのように高速に起動できます。

## 実装内容

### 1. next-pwa導入
- `next-pwa`パッケージを使用
- Service Workerを自動生成・登録
- オフライン対応とキャッシュ戦略

### 2. manifest.json
- アプリ名、アイコン、テーマカラーを定義
- スタンドアロンモードで表示
- ショートカット機能

### 3. Service Worker
- NetworkFirst戦略でキャッシュ
- 24時間のキャッシュ有効期限
- 最大200エントリのキャッシュ

### 4. インストールボタン
- Android/Chrome: 自動インストールプロンプト
- iOS/Safari: 手動インストール手順を表示

## 使用方法

### 開発環境

```bash
npm install
npm run dev
```

開発環境ではPWA機能は無効化されています（`next.config.js`で設定）。

### 本番環境

```bash
npm run build
npm start
```

ビルド時にService Workerが自動生成されます。

## アイコンの作成

現在は仮のアイコンを使用しています。実際のアイコンを作成するには：

1. 192x192pxと512x512pxのPNG画像を用意
2. `/public/icon-192x192.png`と`/public/icon-512x512.png`に配置
3. マスカブルアイコン（Android 12+対応）を推奨

## インストール方法

### Android/Chrome
1. ブラウザでアプリを開く
2. 「ホーム画面に追加」ボタンをタップ
3. 確認ダイアログで「追加」をタップ

### iOS/Safari
1. Safariでアプリを開く
2. 共有ボタン（□↑）をタップ
3. 「ホーム画面に追加」を選択
4. 「追加」をタップ

## パフォーマンス

PWAとしてインストールすると：
- ネイティブアプリ並みの起動速度
- オフライン対応（キャッシュされたコンテンツ）
- フルスクリーン表示
- プッシュ通知対応（将来実装可能）

## トラブルシューティング

### Service Workerが登録されない
- HTTPSでアクセスしているか確認（localhostは除く）
- ブラウザの開発者ツールでService Workerを確認

### インストールボタンが表示されない
- HTTPSでアクセスしているか確認
- ブラウザがPWAをサポートしているか確認
- 既にインストール済みの場合は非表示

### キャッシュが更新されない
- Service Workerを手動で更新（開発者ツール > Application > Service Workers > Update）

## 参考リンク

- [next-pwa Documentation](https://github.com/shadowwalker/next-pwa)
- [Web App Manifest](https://developer.mozilla.org/ja/docs/Web/Manifest)
- [Service Worker API](https://developer.mozilla.org/ja/docs/Web/API/Service_Worker_API)
