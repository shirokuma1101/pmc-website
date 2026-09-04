# 本番環境アップデート手順

この手順書は、稼働中のpmc-websiteをDocker Compose構成のまま更新するためのものです。
PostgreSQL、Directus uploads、`.env`をバックアップしてから、Directusのスキーマと拡張、Frontendを更新します。

ホスト側で`npm`は実行しません。アプリケーションのビルド、Directusスキーマ操作、bootstrapは、すべて`docker compose`経由で実行します。

## 前提

- 本番ホストへSSH接続できること
- Docker EngineとDocker Compose v2が利用できること
- 本番環境がリポジトリの`docker-compose.yml`で稼働していること
- 本番用`.env`がプロジェクト直下にあること
- GitHubのPull Requestが承認され、CIとCode scanningが成功して`main`へマージ済みであること
- 以下のコマンドは、本番ホストのpmc-websiteプロジェクト直下で実行すること

例:

```sh
cd /opt/pmc-website
```

実際の配置先が異なる場合は、そのディレクトリへ移動してください。

## 1. 更新前確認

現在のGitとコンテナの状態を確認します。

```sh
git status --short --branch
git branch --show-current
git log -1 --oneline
docker compose --env-file .env config --quiet
docker compose --env-file .env ps
df -h
```

次の状態であることを確認してください。

- 現在のブランチが`main`
- Gitの作業ツリーに本番ホスト固有の未コミット変更がない
- `database`、`directus`、`frontend`、`cloudflared`が稼働している
- Docker Composeの設定検証が成功する
- バックアップとDockerイメージを保存できる空き容量がある

未コミット変更がある場合は、その内容を確認するまで更新しないでください。

### ビルド時に容量不足になる場合

`load build context` の転送量が数十GBになる場合は、まず不要なデータの混入を確認します。
更新スクリプトはビルド前に `backups/` を作成するため、`.dockerignore` での除外が必要です。
`.gitignore` の設定だけでは Docker の転送対象から除外されません。
このリポジトリでは `backups/`、`.local-backups/`、`.codex-worktrees/`、`.pnpm-store/` などを `.dockerignore` で除外しています。
除外はファイルを削除せず、ビルドへの転送を防ぎます。

本番ホストで容量の内訳を確認します。

```sh
df -h
du -sh backups .local-backups .codex-worktrees .pnpm-store minecraft-map/output 2>/dev/null
docker system df
```

修正済みの `.dockerignore` を本番へ反映してから再ビルドしてください。
既存のビルドキャッシュで空き容量が不足する場合は、他のビルドが動いていないことを確認して、不要なビルドキャッシュを削除できます。
次のコマンドは確認プロンプトを表示します。キャッシュ削除後は再ビルドに時間がかかる場合があります。

```sh
docker builder prune
docker compose --env-file .env --progress plain build frontend
```

`transferring context` の転送量が減ったことを確認します。
DB・uploads を保持するボリュームは削除しないでください。容量確保に `docker compose down -v` は使いません。
バックアップ自体の容量は除外後も残るため、古い世代は外部ストレージへの退避と復元可能性の確認後に整理してください。
更新スクリプトの空き容量チェックはプロジェクト配置先を対象とし、ビルド用の既定余裕は1GiBです。
Docker の保存先が別ディスクなら、その空き容量も確認してください。

## 2. バックアップ先の準備

バックアップは、プロジェクト直下の`backups`へ保存します。

```sh
mkdir -p backups
chmod 700 backups
release_timestamp=$(date +%Y%m%d-%H%M%S)
printf '%s\n' "$release_timestamp"
```

プロジェクトが`/opt/pmc-website`にある場合、保存先は次のようになります。

```text
/opt/pmc-website/backups/
├── database-YYYYMMDD-HHMMSS.dump
├── uploads-YYYYMMDD-HHMMSS.tar.gz
├── env-YYYYMMDD-HHMMSS
└── release-YYYYMMDD-HHMMSS.txt
```

このリポジトリでは`/backups`を`.gitignore`へ登録しています。ただし、バックアップに秘密情報が含まれることは変わらないため、Gitへ強制追加しないでください。

## 3. PostgreSQLのバックアップ

稼働中のPostgreSQLからcustom formatのdumpを取得します。

```sh
docker compose --env-file .env exec -T database \
  pg_dump -U pmc_website -d pmc_website -Fc \
  > "backups/database-${release_timestamp}.dump"
```

ファイルが作成され、空でないことを確認します。

```sh
test -s "backups/database-${release_timestamp}.dump"
ls -lh "backups/database-${release_timestamp}.dump"
```

`test`が失敗した場合は更新を中止してください。

## 4. Directus uploadsのバックアップ

Directusコンテナからuploadsをtar.gzとしてホストへ書き出します。Composeのvolume名を直接指定しないため、プロジェクト名が変更されていても利用できます。

```sh
docker compose --env-file .env exec -T directus \
  tar -czf - -C /directus/uploads . \
  > "backups/uploads-${release_timestamp}.tar.gz"
```

ファイルを確認します。

```sh
test -s "backups/uploads-${release_timestamp}.tar.gz"
tar -tzf "backups/uploads-${release_timestamp}.tar.gz" | head
ls -lh "backups/uploads-${release_timestamp}.tar.gz"
```

uploadsが完全に空の場合は小さなarchiveになることがあります。`tar -tzf`自体が失敗する場合は更新を中止してください。

## 5. 本番`.env`のバックアップ

`.env`にはDBパスワード、Directus secret、管理者資格情報、Cloudflare Tunnel token、SMTP資格情報などが含まれます。

```sh
cp .env "backups/env-${release_timestamp}"
chmod 600 "backups/env-${release_timestamp}"
```

現在のデプロイコミットも記録します。

```sh
git rev-parse HEAD > "backups/release-${release_timestamp}.txt"
chmod 600 "backups/release-${release_timestamp}.txt"
```

バックアップ一式を確認します。

```sh
ls -lh "backups/database-${release_timestamp}.dump" \
  "backups/uploads-${release_timestamp}.tar.gz" \
  "backups/env-${release_timestamp}" \
  "backups/release-${release_timestamp}.txt"
```

## 6. バックアップの外部保管

プロジェクト直下のバックアップだけでは、ホストやディスクの故障時に本番データと同時に失われます。更新前に、少なくともDB dumpとuploads archiveをアクセス制限された別ディスクまたは暗号化済み外部ストレージへ複製してください。

`.env`のコピーには秘密情報が含まれるため、次を守ってください。

- 公開ストレージへ保存しない
- GitHubへ追加しない
- Webサーバーの公開ディレクトリへ置かない
- 転送時と保存時に暗号化する
- 必要な管理者だけがアクセスできるようにする

外部保管が完了するまでアップデートへ進まない運用を推奨します。

## 7. 最新の`main`を取得

```sh
git fetch origin
git pull --ff-only origin main
git log -1 --oneline
```

`--ff-only`が失敗した場合は、本番ホストの履歴がGitHubと分岐しています。`reset --hard`やforce操作は行わず、差分を確認して更新を中止してください。

更新後のコミットも記録します。

```sh
git rev-parse HEAD > "backups/target-${release_timestamp}.txt"
chmod 600 "backups/target-${release_timestamp}.txt"
```

## 8. Compose設定とFrontendイメージの事前検証

最新コードのCompose設定を検証します。

```sh
docker compose --env-file .env config --quiet
```

稼働中のFrontendを残したまま、新しいFrontendイメージをビルドします。Dockerfile内で`npm ci`と`npm run build`が実行されるため、ホスト側にNode.jsやnpmは不要です。

```sh
docker compose --env-file .env build frontend
```

ビルドに失敗した場合は、稼働中コンテナを変更せずに更新を中止してください。

Directus拡張の配布用JavaScriptも、DirectusコンテナのNode.jsで構文確認します。

```sh
docker compose --env-file .env exec directus \
  node --check /directus/extensions/directus-extension-pmc-website/dist/index.js
```

## 9. Directusスキーマのdry-run

databaseとDirectusが正常であることを確認します。

```sh
docker compose --env-file .env up -d --wait database directus
```

スキーマ差分をdry-runで確認します。

```sh
docker compose --env-file .env exec directus \
  node cli.js schema apply --dry-run /directus/schema/snapshot.yaml
```

確認事項:

- 今回のリリースで予定したfield、collection、relationだけが変更される
- 意図しないcollection削除がない
- 意図しないfield削除がない
- 既存データを失う型変更がない

今回のXboxゲーマータグ対応を含むリリースでは、少なくともnullableな`profiles.xbox_gamertag`の追加が想定されます。

想定外の差分が1つでもある場合は、schemaを適用せず更新を中止してください。

## 10. Directusスキーマの適用

dry-runが想定どおりであることを確認してから適用します。

```sh
docker compose --env-file .env exec directus \
  node cli.js schema apply --yes /directus/schema/snapshot.yaml
```

適用完了後、Directusを再起動して拡張を再読み込みします。

```sh
docker compose --env-file .env restart directus
docker compose --env-file .env up -d --wait directus
```

この再起動中は、CMS APIと認証・画像処理が短時間利用できなくなります。

## 11. role、policy、upload folderの更新

本番用bootstrap serviceを実行します。この処理は冪等であり、ローカル検証ユーザーは作成しません。
Directus管理者で2FAを有効にしている場合は、認証アプリに表示された現在の6桁OTPを実行時だけ渡します。
OTPは短時間で失効するため、`.env`やシェルスクリプトへ保存しないでください。

```sh
read -r -s -p "Directus OTP: " directus_admin_otp
printf '\n'
sudo docker compose --env-file .env --profile tools run --rm \
  -e DIRECTUS_ADMIN_OTP="$directus_admin_otp" bootstrap
unset directus_admin_otp
```

管理者で2FAを有効にしていない場合は、`-e DIRECTUS_ADMIN_OTP=...`を付けずに従来のbootstrapコマンドを
実行できます。

失敗した場合は、Frontendの切り替えへ進まずDirectusログを確認してください。

```sh
docker compose --env-file .env logs --tail=200 directus
```

## 12. Frontendの切り替え

事前にビルドした新しいFrontendイメージでコンテナを再作成します。

```sh
docker compose --env-file .env up -d --no-deps frontend
docker compose --env-file .env up -d cloudflared
docker compose --env-file .env ps
```

Frontendのhealth checkがhealthyになることを確認します。

```sh
docker compose --env-file .env ps frontend directus cloudflared
```

## 13. 更新後確認

### コンテナとログ

```sh
docker compose --env-file .env ps
docker compose --env-file .env logs --tail=200 frontend directus database cloudflared
```

`unhealthy`、再起動ループ、DB接続エラー、拡張読み込みエラーがないことを確認します。

### HTTP確認

実際の本番URLへ置き換えて実行します。

```sh
curl --fail --show-error --silent --output /dev/null \
  https://pmc.example.com/login

curl --fail --show-error --silent \
  https://cms.pmc.example.com/server/ping
```

### 画面確認

- 公開トップページが表示できる
- 通常ユーザーがメールアドレスとパスワードでログインできる
- 2FA設定済みユーザーだけ専用の6桁コード画面へ移動する
- 記事一覧と記事詳細が表示できる
- 記事編集画面の入力、分割表示、同期スクロールが動作する
- Markdown画像とリンクのプレビューが動作する
- 画像を複数アップロードできる
- プロフィールをXboxゲーマータグ未入力でも保存できる
- Xboxゲーマータグ設定時だけプロフィールへ表示される
- Directus管理画面へログインできる
- パスワード再設定メールを送信できる

本番環境では、ローカル検証用の`cms:smoke`相当処理を実行しないでください。テストデータや検証ユーザーを本番へ作成しないためです。

## 14. 問題発生時の判断

### schema適用前に失敗した場合

稼働中コンテナは原則として変更されていません。エラーを記録し、更新を中止します。

### Frontendだけに問題がある場合

`backups/release-*.txt`へ記録した以前の正常コミットを確認し、そのコミットからFrontendを再ビルドします。

```sh
previous_release=$(cat "backups/release-${release_timestamp}.txt")
git checkout "$previous_release"
docker compose --env-file .env build frontend
docker compose --env-file .env up -d --no-deps frontend
docker compose --env-file .env ps frontend
```

復旧確認後、Gitの参照を`main`へ戻します。

```sh
git switch main
```

この操作はデータベースを変更しません。今回のようなnullable field追加は、古いFrontendから参照されなくても通常は問題になりません。

### DirectusまたはDBに問題がある場合

古いschema snapshotを安易に適用しないでください。field削除やデータ損失につながる可能性があります。

DB dumpまたはuploadsの復元が必要な場合は、本番サービスを停止する計画停止と、復旧対象・復旧時点の確認が必要です。復元操作は既存データを上書きするため、この通常アップデート手順には含めません。復元前に、障害発生後のDBとuploadsも別名で退避してください。

## 15. 更新完了後

更新日時、旧コミット、新コミット、schema差分、実行者、確認結果を運用記録へ残します。

バックアップは保存期間のルールに従って管理します。少なくとも次の状態になるまで削除しないことを推奨します。

- 更新後の主要画面と認証が正常
- 記事投稿・画像アップロードが正常
- 次回の定期バックアップが正常終了
- 外部保管されたバックアップから復元可能であることを確認済み

バックアップを削除する場合は、対象日時と外部保管状況を確認し、誤って最新または唯一の復旧点を削除しないようにしてください。
