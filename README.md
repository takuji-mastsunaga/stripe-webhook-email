# Stripe Webhook Email System

Stripeの決済完了や顧客情報更新時に自動でメール送信するシステム

## セットアップ手順

### 1. 依存関係のインストール
```bash
npm install
```

### 2. 環境変数の設定
Vercelダッシュボードで以下の環境変数を設定:

- `STRIPE_SECRET_KEY` - Stripeの秘密鍵
- `STRIPE_WEBHOOK_SECRET` - Webhookの署名シークレット
- `SMTP_HOST` - メールサーバーのホスト
- `SMTP_PORT` - メールサーバーのポート
- `SMTP_SECURE` - SSL/TLS設定
- `SMTP_USER` - メール送信用ユーザー
- `SMTP_PASS` - メール送信用パスワード
- `FROM_EMAIL` - 送信者メールアドレス

### 3. Stripe Webhookの設定

1. Stripeダッシュボード → 開発者 → Webhook
2. エンドポイントを追加: `https://your-domain.vercel.app/api/webhook/stripe`
3. 監視イベント:
   - `payment_intent.succeeded` - 決済完了時
   - `customer.updated` - 顧客情報更新時

## 機能

- **決済完了時のメール送信**
- **日本語メールテンプレート**
- **決済金額に応じたGoogleフォームURL自動切替**
- **Gmail SMTP対応**

## 更新: 2025-07-31

環境変数の設定を確実にするため、再デプロイが必要です。