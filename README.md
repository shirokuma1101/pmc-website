# pmc-website

PostMineClanの活動記録サイトです。Next.jsの画面とBFF、Directus・PostgreSQL、
Directusのデータモデルと専用API拡張をこのリポジトリで管理します。

短文投稿、記事、プロフィール、記事レビュー、画像、パスワード再設定、TOTP 2段階認証、
プライバシーポリシー・利用規約・Cookie同意設定に対応しています。

## 構成

ローカル開発では、Next.jsだけをホストで実行し、DirectusとPostgreSQLをDockerで分離します。

```text
Browser
  ├─ http://localhost:3001        Next.js
  └─ http://127.0.0.1:8056        Directusの画像・管理画面
                                      ├─ Docker内PostgreSQL
                                      └─ Mailpit（開発用メール受信箱）
```

本番ではFrontend、Directus、PostgreSQLを同じDocker Compose projectで実行します。

```text
Browser
  └─ HTTPS reverse proxy
       ├─ public site ── pmc-website Frontend container
       │                    └─ Compose内部のDirectus
       └─ CMS / assets ─ Directus container
                              └─ PostgreSQL container
```

本番とローカルは別のCompose projectとnamed volumeを使用し、DB、uploads、認証情報を共有しません。

## 必要環境

- Node.js 22以降
- Docker Desktop、またはDocker EngineとDocker Compose v2
- npm

## ローカル開発

初回は次を実行します。

```powershell
npm ci
npm run env:setup
npm run cms:init
npm run cms:smoke
npm run dev
```

- Frontend: <http://localhost:3001>
- Directus管理画面: <http://127.0.0.1:8056/admin/login>
- 開発用メール受信箱: <http://127.0.0.1:8026>

`npm run env:setup`はランダムなローカル専用パスワードと署名secretを`.env.local`へ生成します。
管理者と検証ユーザーのメールアドレス・パスワードも同ファイルで確認できます。既存の
`.env.local`は上書きしません。

日常的に使うコマンドは次のとおりです。

```powershell
npm run cms:up          # DirectusとPostgreSQLを起動
npm run cms:down        # 停止。DBとuploadsのvolumeは保持
npm run cms:logs        # ログを追跡
npm run cms:restart     # 拡張APIを含むDirectusを再起動
npm run cms:smoke       # 認証・投稿・記事承認・画像・権限を結合テスト
npm run dev             # Next.jsをポート3001で起動
```

`cms:bootstrap`と`cms:smoke`はloopback以外のDirectusを拒否します。誤って公開中の
Directusへテストデータや開発ユーザーを作らないための制限です。

`pmc_`付きcollectionを使用していた旧ローカル環境から切り替える場合は、先に旧projectを停止します。

```powershell
docker compose -p pmc-website-dev -f docker-compose.dev.yml --env-file .env.local down
npm run cms:init
```

開発Composeのproject名は`pmc-website-dev-standalone`へ変更されているため、`cms:init`は新しいDBと
uploads volumeを作成します。旧`pmc-website-dev_*` volumeは自動削除せず、必要なデータを確認・退避
できる状態で残します。

パスワード再設定メールはローカルではMailpitに配信され、外部へ送信されません。本番では
`.env.example`にSMTP設定を入力してください。

## Directusの管理対象

- `docker-compose.dev.yml`: ローカルDirectus 12.3.0とPostgreSQL 17.6
- `docker-compose.yml`: 本番Frontend、Directus 12.3.0、PostgreSQL 17.6
- `directus/schema/snapshot.yaml`: collections、fields、relationsのスキーマ
- `directus/bootstrap.mjs`: ローカル用folder、role、policy、ユーザー、初期設定
- `directus/extensions/directus-extension-pmc-website`: `/pmc-website`専用API

Directusはpmc-website専用instanceとし、Data Modelには`posts`、`articles`、`profiles`、
`site_pages`、`post_likes`、`article_likes`、`article_reviews`、`posts_files`を使用します。
専用APIパスは既存どおり`/pmc-website/posts`などを維持します。

一般ユーザーにはDirectusの標準collection/file API権限を付与していません。Frontendが使う
読み書き、所有者確認、記事レビュー、画像配信は専用APIが検証します。`cms:smoke`では、専用APIが
動作し、同じデータへ標準APIからアクセスすると403になることも確認します。

### スキーマまたは拡張を変更したとき

Directus管理画面でデータモデルを変更したらsnapshotを更新します。

```powershell
npm run cms:schema:snapshot
```

API拡張の`src/index.js`を変更したら、配布用ファイルを更新してDirectusを再起動します。

```powershell
npm run cms:extension:build
npm run cms:restart
npm run cms:smoke
```

snapshotと拡張の`src`・`dist`はGitで管理します。snapshotにコンテンツ、パスワード、tokenは
含まれません。

## 本番Docker Composeの起動

本番ホストだけで環境ファイルを作ります。

```powershell
Copy-Item .env.example .env
```

Linux/macOSの場合：

```sh
cp .env.example .env
```

既存の本番環境を更新するときは、バックアップ、スキーマdry-run、コンテナ更新、health checkをまとめたスクリプトを利用できます。

```sh
./scripts/production-update.sh              # 通常更新（スキーマ適用前に手動承認）
./scripts/production-update.sh --preflight  # 更新前確認のみ
./scripts/production-update.sh --backup-only
./scripts/production-update.sh --dry-run
```

ホスト側でnpmは実行しません。詳細、手動確認項目、復旧時の注意は`PRODUCTION_UPDATE.md`を参照してください。

`.env`の公開URL、bind先、Directus・PostgreSQLのsecret、管理者資格情報、SMTP設定を変更します。
最初にDBとDirectusを起動し、schemaの差分を確認します。

```sh
docker compose --env-file .env config --quiet
docker compose --env-file .env up -d database directus
docker compose --env-file .env exec directus node cli.js schema apply --dry-run /directus/schema/snapshot.yaml
```

想定どおりの差分であることを確認してからschemaと初期role・policy・upload folderを適用し、
Frontendを起動します。

```sh
docker compose --env-file .env exec directus node cli.js schema apply --yes /directus/schema/snapshot.yaml
docker compose --env-file .env restart directus
docker compose --env-file .env --profile tools run --rm bootstrap
docker compose --env-file .env up -d --build
docker compose --env-file .env ps
```

Directus管理者で2FAを有効にしている場合は、bootstrap実行時だけ現在の6桁OTPを渡します。
OTPは短時間で失効するため、`.env`には保存しません。

```sh
read -r -s -p "Directus OTP: " directus_admin_otp
printf '\n'
docker compose --env-file .env --profile tools run --rm \
  -e DIRECTUS_ADMIN_OTP="$directus_admin_otp" bootstrap
unset directus_admin_otp
```

既定ではFrontendを`127.0.0.1:3000`、Directusを`127.0.0.1:8055`へbindします。同一ホストの
reverse proxyから、FrontendとDirectusをそれぞれHTTPSで公開してください。reverse proxyが別マシンに
ある場合は、`FRONTEND_BIND_IP`と`DIRECTUS_BIND_IP`へDockerホストのprivate IPを指定し、firewallで
reverse proxyからの接続だけを許可します。PostgreSQLはホストへ公開しません。

本番で永続化・バックアップする対象は次のとおりです。

- `pmc-website_directus_database` named volume
- `pmc-website_directus_uploads` named volume
- deployment host上の`.env`
- Gitで管理するschema snapshotとDirectus Extension

### Minecraftマップ生成の調整

マップ生成用の設定は`minecraft-map/.env.map.example`を
`minecraft-map/.env.map`へコピーして管理します。`generate-history.sh`と
`generate-history.ps1`は、このファイルが存在すると自動的に読み込みます。

Dynmapの`fullrender`または`radiusrender`で使用する並列レンダースレッド数は、
`MAP_RENDER_THREADS`で指定できます。空欄の場合はDynmapの既定動作を維持します。
例えば2 vCPUの専用レンダー環境では、次の設定から試してください。

```ini
MAP_RENDER_THREADS=2
```

値には1以上の整数を指定します。大きくするほどCPUとメモリの使用量が増えるため、
物理コア数を超えない範囲でホストの負荷を確認しながら調整してください。

Article公開時のDiscord通知を有効にする場合は、本番`.env`へ
`DISCORD_ARTICLE_WEBHOOK_URL`を設定します。Webhook URLはチャンネルへ
投稿できる秘密情報のため、Frontend環境、Browser、GitHub、ログへ保存しないでください。未設定時は
通知処理を安全にスキップします。新規記事の初回承認は通知されますが、既存公開記事の改訂承認は
既定では通知されません。改訂承認も通知する場合は`DISCORD_ARTICLE_WEBHOOK_NOTIFY_UPDATES=true`を
設定してDirectusコンテナを再作成してください。

`bootstrap` serviceはDirectusの管理者資格情報を使ってrole、policy、upload folderを冪等に作成します。
管理者で2FAが有効な場合は、実行時に`DIRECTUS_ADMIN_OTP`も必要です。本番ではローカル検証ユーザーを
作成しません。更新時もDBとuploadsをバックアップし、schema dry-runを確認してから適用してください。

過去ワールドは、bootstrapが作成するDirectusの`Past Minecraft worlds`フォルダーへ管理者が
手動で配置します。各ファイルの`Description`が詳細テキスト、アップロード日時が表示日時になります。
Frontendにはファイル管理機能を設けず、ログイン済み利用者だけが`/worlds`と認証付きダウンロードAPIを
利用できます。説明文は管理者が`/admin/worlds`から編集できます。`.mcworld`はZIP系、
`application/octet-stream`、またはWindowsブラウザでMIME typeなしとして判定されるため、
これらをDirectusで許可しています。
大容量ファイルはTUSによる8MB単位の分割アップロードを使用し、既定の上限は2GBです。上限とchunk sizeは
`DIRECTUS_FILES_MAX_UPLOAD_SIZE`、`DIRECTUS_TUS_CHUNK_SIZE`で変更できます。reverse proxyにもchunk size以上の
request bodyを許可し、設定変更後はDirectusコンテナを再作成してください。Frontendの画像投稿APIは
引き続き画像形式のみ、既定8MBに制限されます。

この本番Composeは空のpmc-website専用DBを新規作成します。旧共有Directusの記事、画像、ユーザーは
自動移行しません。必要なコンテンツは新instanceの初期化後に個別の移行手順で取り込み、共有
`directus_users`をそのまま接続または複製しないでください。

## 環境変数と秘密情報

- `.env.local`: ローカルDirectusの署名secret、DB・管理者・検証ユーザーのパスワード
- `.env`: 本番Frontend、Directus、PostgreSQL、SMTPの設定と秘密情報
- `NEXT_PUBLIC_*`: Browserへ公開されるURL。秘密情報を設定しない
- `REGISTRATION_ENABLED`: Web UIのセルフ登録受付。ローカルは`true`、本番既定は`false`
- `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID`: Google Analytics 4の測定ID（`G-`から始まる値）。未設定時は解析を無効化
- `AUTH_RATE_LIMIT_TRUST_PROXY`: 信頼するreverse proxyが`X-Forwarded-For`を上書きする本番構成でのみ`true`
- `DIRECTUS_RATE_LIMITER_*`: Directus API全体の補助的なIP制限。複数instance構成ではmemoryではなくRedisを使用
- `NEXT_PUBLIC_DIRECTUS_URL`: reverse proxy経由でBrowserから到達できるDirectus公開URL
- `DIRECTUS_FILES_MAX_UPLOAD_SIZE`: Directus管理画面で扱う1ファイルの上限。過去ワールド用の既定値は`2gb`
- `DIRECTUS_TUS_CHUNK_SIZE`: Directusの分割アップロードで送信する1chunkのサイズ。既定値は`8mb`
- `DISCORD_ARTICLE_WEBHOOK_URL`: Article承認時のDiscord Webhook URL。Directus側だけで秘密情報として管理し、未設定時は通知を無効化
- `DISCORD_ARTICLE_WEBHOOK_NOTIFY_UPDATES`: `true`の場合、既存公開記事の改訂承認時にもDiscordへ通知。既定値は`false`
- Directusの`SECRET`、DBパスワード、管理者資格情報、license key: deployment hostの`.env`だけで管理

`.env`と`.env.local`は`.gitignore`対象です。`.env.example`と`.env.local.example`には実際の
secretを記載しません。Frontendは固定APIキーをBrowserへ渡さず、ログインsessionをHttpOnly cookieで
保持します。

認証APIはFrontend側でlogin/TOTPをアカウント10回・IP 30回/15分、アカウント作成を
アカウント3回・IP 5回/1時間に制限します。超過時は`Retry-After`付きのHTTP 429を返します。
本番で`AUTH_RATE_LIMIT_TRUST_PROXY=true`にする前に、Nginx等が外部から届いた転送ヘッダーを
破棄して正しい接続元IPへ置き換えることを確認してください。Frontendを複数instanceへ増やす場合は、
rate limit storeをRedis等の共有storeへ移行してください。

## GitHubへ含めるもの

含めるもの：

- Frontendソースとテスト
- DockerfileとCompose定義
- 環境変数のexample
- Directus schema、bootstrap、専用拡張

含めないもの：

- `.env`、`.env.local`、cookie、token、秘密鍵
- PostgreSQLの実データとDirectus uploads
- `.next`、`node_modules`、coverage、ログ
- 本番またはローカルのユーザー生成コンテンツ

commit前に`git status --short`で秘密情報が含まれていないことを確認してください。

## 検証

```powershell
npm run cms:extension:check
npm run cms:smoke
npm run typecheck
npm run lint
npm test
npm run build
docker compose -f docker-compose.dev.yml --env-file .env.local.example config --quiet
docker compose --env-file .env.example config --quiet
```

## License

このリポジトリの`LICENSE`を参照してください。依存softwareにはそれぞれのlicenseが適用されます。
