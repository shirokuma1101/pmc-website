# サポーター機能の反映・再送手順

対象: Issue #28。料金は単発300円、月額Basic 400円・Standard 800円・Premium 1,500円。
公開情報や返金・解約の未決定事項は、ローカルの `SUPPORTER_RELEASE_CHECKLIST.md` の判断待ちTODOで管理する。

## DBとアプリの反映順序

1. DB・アップロード・環境設定のバックアップを取得する。
2. 通常のDirectus schema dry-runで、意図しない削除がないことを確認する。`profiles.supporter_badge_visible` はsnapshotにも定義している。
3. `organization_members` が存在することを確認する。内部テーブル `profile_entitlements` / `supporter_payments` と通知記録列は、追加専用の `directus/schema/supporter-storage.sql` で準備する。このSQLは繰り返し適用できる。
4. SQLのdry-runを確認してから適用する。以下は本番での実行例であり、今回の開発作業では本番に実行していない。

```sh
# DDLもトランザクションでロールバックするdry-run（PostgreSQL）
docker compose --env-file .env exec -T database sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 --single-transaction --file=- --command=ROLLBACK' < directus/schema/supporter-storage.sql

# バックアップとdry-runの確認後に適用
docker compose --env-file .env exec -T database sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 --single-transaction --file=-' < directus/schema/supporter-storage.sql
```

5. Directus拡張をbuildし、配布用distとFrontendを同じリビジョンで反映する。今回のWebhookは通知台帳の応答を必要とするため、古い拡張との組み合わせでは503を返す。拡張を先に更新してからFrontendを更新する。
6. ローカルsmokeとテスト決済を確認する。開発用smokeを本番に向けない。本番反映・バックアップ復元・実決済は別の実施工程。

## 二重契約の防止

- サイトは利用者に紐付くすべての記録済みStripe Customerを調べ、継続中・支払い待ち・支払失敗中などの契約があれば月額Checkoutの新規作成を拒否する。単発支援は利用可能。
- 契約照会に失敗した場合も新規月額Checkoutを作らない。画面で契約状態を確認できなかった場合は再読み込みを案内する。
- 同じ送信の再試行は同じStripe idempotency keyを使う。
- **公開前にStripe Checkoutの「1顧客につき1契約」の設定も有効化・検証する。** サイトの事前照会だけでは、別タブで同時に作ったCheckoutやWebhook記録前の契約を完全には防げない。これは料金プラン変更ではなく、公開前に必要なプロバイダー側設定。

## 支払い通知の再送

- 署名検証済みWebhookの支払い記録と特典更新をトランザクションで保存する。同一イベントの同時再送では支払い記録・特典更新を重複させない。
- 月額特典はイベント発生時刻を使って契約単位で復元する。解約済みの古い契約IDへのイベントで、別の有効契約を取り消したり、終了済み契約を再有効化したりしない。
- 通知が必要なイベントには `notification_key` を記録し、Resend受付後に `email_id` と `email_sent_at` を記録する。送信済み通知はWebhook再送でも送らない。`email_sent_at` は受信箱への到達ではなく、Resendが受け付けた記録。
- `checkout.session.completed` と `checkout.session.async_payment_succeeded` は同じCheckoutの成功通知キーを使う。初回請求書はCheckoutの通知と重複させない。
- Stripeの顧客照会失敗、宛先未取得、Resend失敗はエラーとして返し、Webhookの再送対象とする。宛先未取得を正常終了として隠さない。
- 回復済みの同じ請求書・Checkoutに対して、後から届いた支払失敗通知は送らない。

障害時はStripe WorkbenchでイベントIDと失敗コードを確認し、Resendの配信ログとDBの通知記録を照合する。障害を解消してからStripeの再送機能を使う。カード情報やAPIキーを問い合わせ・ログへ貼らない。

### 自動で再送しないケース

- `NOTIFICATION_HISTORY_UNKNOWN`: 通知台帳導入前の支払い記録。過去の送信有無を推測できないため、Resendログを確認してから個別対応する。
- `NOTIFICATION_RETRY_WINDOW_EXPIRED`: 未確定の送信が23時間以上経過した。Resendのidempotency keyの保持期間（24時間）を越えた二重送信を避けるため、自動再送を止める。配信済みなら確認したResend IDを記録し、未送信なら運営が再送を判断する。

運営者への障害通知先・通知経路は未決定。無断で個人宛メールや外部通知を追加しない。

## 残る確認

- 同じ秒に複数のSubscription更新が発生した場合の最終状態はStripe実データでも照合する。時刻だけで区別できない更新に備えた定期照合は別途必要。
- 税表示、解約日時、日割り、プラン変更の許可範囲は未確定のため、ライブCustomer Portalを推測で設定しない。
- Sandboxとライブはキー・Webhook・DBを分離する。既存Sandboxを切り替えた場合の過去Customerはresource_missingとして無視するが、他のAPI障害は無視しない。

参考: [Stripeの二重契約制限](https://docs.stripe.com/payments/checkout/limit-subscriptions)、[Webhookの再送・順序](https://docs.stripe.com/webhooks)、[Resendのidempotency key](https://resend.com/docs/dashboard/emails/idempotency-keys)

## 保存処理の回帰テスト

Dockerが利用できるPOSIXシェルで `sh scripts/test-supporter-storage.sh` を実行する。CIでも同じコマンドを使う。専用の一時Postgresをtmpfs上に作成し、終了時に停止する。既存ComposeのDBやvolumeは使用しない。
