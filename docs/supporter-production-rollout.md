# サポーター機能の本番移行（Issue #28）

対象URL: `https://postmineclan.com`。PRのマージと本番デプロイは別操作です。
この手順は本番ホストで実施し、SandboxのDB・顧客・契約・APIキーをコピーしません。
ローカルの `SUPPORTER_RELEASE_CHECKLIST.md` はGit管理対象外のままにします。

## 1. 受付開始前の確認

- CI成功・レビュー後にPRをmainへマージする。
- Stripe本番アカウントの本人確認・審査・入金先設定を完了し、決済受付可能な状態を確認する。
- セキュリティ申告は実装と本番運用の実態に合わせ、対策完了前に受付を始めない。
- 単発支援の取扱いをStripeへ確認する。バッジ付与だけで個人への寄付に関する制限を回避できるとは判断しない。
- 本番でカードの自動再試行を無効化する。Sandboxの設定は本番に引き継がれない。
- 失敗後の契約状態を確認する。Sandbox検証時は初回の更新失敗後に契約が自動解約、請求書はopenとなった。本番でも同じ扱いにするか運営者が確定する。
- Customer Portalの本番デフォルト設定で支払い方法変更・請求履歴・期間末解約を有効化する。Portal内のプラン変更は無効にし、サイトの新規契約方式の切替を利用する。コードで指定する戻り先は `/supporters`（管理ボタンは `/me`）。
- 本番の決済方法、メール差出人ドメイン、support窓口の受信、特商法表記・利用規約を確認する。

## 2. 本番ホストの `.env`

既存ファイルをバックアップして必要な行だけ追加・更新する。`.env.example`で上書きしない。
`.env.stripe-live.local` と `.env.stripe-live.prices.local` は登録作業用で、Composeには自動適用されない。

```dotenv
NEXT_PUBLIC_APP_URL=https://postmineclan.com
STRIPE_SECRET_KEY=sk_live_REPLACE_ON_HOST
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_WITH_LIVE_ENDPOINT_SECRET
STRIPE_INTERNAL_SECRET=REPLACE_WITH_PRODUCTION_RANDOM_SECRET
STRIPE_PRICE_SUPPORTER_ONE_TIME=price_REPLACE_WITH_LIVE_ONE_TIME
STRIPE_PRICE_BASIC_MONTHLY=price_REPLACE_WITH_LIVE_BASIC
STRIPE_PRICE_STANDARD_MONTHLY=price_REPLACE_WITH_LIVE_STANDARD
STRIPE_PRICE_PREMIUM_MONTHLY=price_REPLACE_WITH_LIVE_PREMIUM
RESEND_API_KEY=re_REPLACE_ON_HOST
RESEND_FROM_EMAIL="PostMineClan <no-reply@postmineclan.com>"
# 任意。未設定でも管理者宛 support@postmineclan.com は利用可能。
CONTACT_PERSONAL_RECIPIENTS=
```

- Priceは単発300円、月額Basic 400円・Standard 800円・Premium 1,500円。すべてJPY・`tax_behavior=inclusive`、月額は1か月間隔とする。
- `STRIPE_INTERNAL_SECRET` はStripe発行ではない共有秘密。十分長いランダム値を生成する（例: `openssl rand -hex 32`）。ComposeがFrontendとDirectusの両方へ同じ値を渡す。既に本番用の値があれば保持する。
- `STRIPE_WEBHOOK_SECRET` は本番の当該Webhook endpoint用。CLI listenの値やSandboxの値は利用しない。
- `PMC_INTERNAL_API_TOKEN`、Directus/DBのsecret、Turnstile本番キー、`AUTH_COOKIE_SECURE=true`、既存CMS URL等も保持・確認する。支払い通知と問い合わせはResendを使い、Directus SMTPは使わない（他の既存機能用SMTPは別扱い）。
- 初回コード配備と受付開始を分ける場合、4つのPrice環境変数は空欄のままにする。`stripeEnabled()`がfalseとなり新規Checkoutは無効になる。既存Stripe必須変数には正しい本番値を用意する。
- secretや完成したenvをコミット、PR、ログ、スクリーンショットへ掲載しない。`chmod 600 .env`で保護する。

## 3. Webhookの準備

Stripe本番で `https://postmineclan.com/api/supporters/webhook` を送信先として作成し、署名シークレットを `.env` へ設定する。配備前は送信先を無効のままにする。
受信するイベント:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
```

Cloudflare AccessのログインやTurnstile challengeでWebhookを遮断しない。サイト側のStripe署名検証は無効化しない。
本番ではCLI listenを常駐させず、公開HTTPS endpointへ直接配信する。

## 4. マージ後の更新

本番リポジトリのmainがクリーンであることを確認し、既存の更新スクリプトを利用する。

```sh
git status --short --branch
bash scripts/production-update.sh --preflight
bash scripts/production-update.sh --backup-only
# バックアップ後、上記の本番.envを安全なエディターで設定する。
docker compose --env-file .env config --quiet
bash scripts/production-update.sh
```

通常更新はDB・uploads・env・旧コミットをバックアップし、`origin/main`取得、Frontendビルド、schema dry-runを実施する。
差分を確認して想定どおりのときだけ `APPLY` を入力する。Directus再作成・bootstrap・Frontend更新・health checkまで実行される。
削除や意図しないschema変更が出たら中止する。管理者2FAでbootstrapが失敗した場合は [既存の更新手順](../PRODUCTION_UPDATE.md) に従い、OTPを一時的に渡す。OTPをenvに保存しない。

内部の支払い台帳・特典テーブルは通常のDirectus snapshotとは別に準備する。初回公開時はPrice IDを空欄にしておき、更新後・受付開始前に [反映手順](supporter-release-operations.md) の `supporter-storage.sql` のロールバック付きdry-runと適用を行う。通常更新スクリプトはこのSQLを明示的には実行しない。

## 5. 受付開始

1. `/login`、`/contact`、`/terms`、`/commercial-transactions`、`/supporters`、ログイン後の`/me`を確認する。
2. 本番Webhookを有効化し、上記の受付前条件を満たしていることを確認する。
3. 空欄にしていた場合は、本番Price IDの4行を設定しFrontendを再作成する。

```sh
docker compose --env-file .env up -d --no-deps --force-recreate --wait frontend
docker compose --env-file .env ps
```

4. 本番カードへのテスト請求を無断で行わない。承認済みの実取引で決済・署名Webhookの2xx応答・サイト反映・メール受信を確認する。Sandboxのカード番号を本番へ入力しない。
5. Stripeの配信履歴とFrontend/Directusログを確認する。health check成功だけでは決済機能の検証完了にはならない。

障害時は4つのPrice IDを空にしてFrontendを再作成すれば新規申込を停止できる。ただし既存サブスクの請求停止にはならない。既存請求のWebhook受信は維持し、契約対応は別途判断する。
復旧・ロールバックは [PRODUCTION_UPDATE.md](../PRODUCTION_UPDATE.md) を参照する。決済後のDBを古いバックアップへ無条件に戻さない。Stripe記録との照合・再送が必要になる。
