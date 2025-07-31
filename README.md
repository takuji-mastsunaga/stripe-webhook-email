# Stripe Webhook Email System

Stripeの決済完了や顧客情報更新時に自動でメール送信するシステム

## セットアップ手順

### 1. 依存関係のインストール
```bash
npm install
```

### 2. 環境変数の設定
`.env.example`を`.env.local`にコピーして設定:

```bash
cp .env.example .env.local
```

### 3. Vercelにデプロイ

#### Vercel アカウント: tackjioffice@gmail.com
#### Team: solvis

```bash
# Vercel CLIのインストール
npm i -g vercel

# ログイン
vercel login

# デプロイ
vercel

# 本番環境の環境変数を設定
vercel env add STRIPE_SECRET_KEY
vercel env add STRIPE_WEBHOOK_SECRET
vercel env add SMTP_HOST
vercel env add SMTP_PORT
vercel env add SMTP_SECURE
vercel env add SMTP_USER
vercel env add SMTP_PASS
vercel env add FROM_EMAIL
```

### 4. Stripe Webhookの設定

1. Stripeダッシュボード → 開発者 → Webhook
2. エンドポイントを追加: `https://your-domain.vercel.app/api/webhook/stripe`
3. 監視イベント:
   - `payment_intent.succeeded` - 決済完了時
   - `customer.updated` - 顧客情報更新時

## 監視対象イベント

- **payment_intent.succeeded**: 決済完了時にメール送信
- **customer.updated**: 顧客のアドレス追加時にメール送信

## メール送信条件

- 顧客にメールアドレスが設定されている
- 決済情報が存在する
- 決済金額に応じてGoogleフォームURLが動的に変更

## Gmail SMTP設定

1. Googleアカウントで2段階認証を有効化
2. アプリパスワードを生成
3. `SMTP_PASS`にアプリパスワードを設定