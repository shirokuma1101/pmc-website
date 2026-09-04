# Minecraft map: Docker 実行ガイド

この構成では、WebサイトとDynmapの画像を1つの入口から配信します。地図画像はWebサイトComposeの`map-static`（Nginx）が直接返すため、Next.jsの処理負荷にはなりません。`minecraft-map/docker-compose.map.yml`は必要時だけ起動する生成ジョブ専用です。

## ローカルで起動する

1. 初回のみ環境ファイルを作成します。

   ```powershell
   npm run env:setup
   ```

2. 全サービスを起動します。地図配信用Nginxも同時に起動します。

   ```powershell
   npm run docker:up
   ```

3. `http://localhost:3001/map` を開きます。

Webサイトの停止は `npm run docker:down`、ログ確認は `npm run docker:logs` です。`minecraft-map/output`は`map-static`へ読み取り専用でマウントされ、Nginx自体のポートは外部へ公開されません。

## 地図を更新する

ジェネレーターは一時ディレクトリでレンダリングした後、完成したスナップショットを`minecraft-map/output`へ反映します。配信用Nginxの再起動は不要です。Bedrockワールドのスナップショット、Chunker変換、Paper/Dynmapレンダリングはデータ破損を避けるため、配信用Nginxとは別の一時コンテナで実行します。

## Bedrockサーバーのtar.gzから生成する

地図生成はWebサイト用のComposeとは分離されており、ゲームサーバーを起動しません。アーカイブ内の `server.properties` から `level-name` を読み取り、対応する `worlds/<level-name>` を自動検出します。

1. 初回のみ設定ファイルを作成します。

   ```sh
   cp minecraft-map/.env.map.example minecraft-map/.env.map
   ```

   `.env.map`はGit管理外です。サーバーのメモリ量やバックアップ配置に合わせて編集します。

   ```env
   MAP_ARCHIVE_DIRECTORY=./input
   CHUNKER_HEAP=4G
   PAPER_HEAP=4G
   MAP_MEMORY_LIMIT=8g
   ```

   `Killed`または終了コード137でChunkerが終了する場合は、ホストの空きメモリを確認し、まず`CHUNKER_HEAP`を3～4GBへ下げてください。`MAP_MEMORY_LIMIT`はJavaヒープ以外のメモリを含め、`CHUNKER_HEAP`より十分大きく設定します。

2. Bedrock Dedicated Server全体を含む `.tar.gz` を `minecraft-map/input` に1つ配置します。
3. 初回のみ生成イメージを作ります。npmを使わない場合は、下段のDocker Composeコマンドを直接実行できます。

   ```powershell
   npm run map:build
   ```

   ```sh
   docker compose --env-file minecraft-map/.env.map \
     -f minecraft-map/docker-compose.map.yml \
     build map-generator
   ```

4. 変換とレンダーを実行します。

   ```powershell
   npm run map:generate
   ```

   ```sh
   docker compose --env-file minecraft-map/.env.map \
     -f minecraft-map/docker-compose.map.yml \
     run --rm map-generator
   ```

生成物は `minecraft-map/output/worlds/<ワールドID>/snapshots/<撮影日時>` に追加されます。平面表示は `flat`、3D表示は `surface` として生成され、洞窟表示は除外されます。既存の履歴は上書きされず、`catalog.json`の最新スナップショットだけが更新されます。

生成した出力は、WebサイトComposeで常時起動している`map-static`からそのまま配信されます。再作成やディレクトリのコピーは不要です。

アーカイブ名やメモリ量を指定する場合は、`minecraft-map/.env.map.example` を参考に環境変数を設定できます。複数ワールドでは `MAP_WORLD_ID` と `MAP_WORLD_LABEL`を変えて実行します。`MAP_SNAPSHOT_ID`が空欄なら実行日時が自動採番されます。通常は全領域を生成し、動作確認などで範囲を限定するときだけ `MAP_RENDER_MODE=radius` と中心座標・半径を指定してください。

### Ubuntuで履歴を一括生成する

UbuntuではPowerShell版ではなく、`generate-history.sh`を使用します。バックアップの更新日時は既定で`Asia/Tokyo`としてIDと表示日時へ変換されます。`minecraft-map/.env.map`が存在する場合は、自動的にDocker Composeの環境ファイルとして読み込みます。事前の`source`は不要です。

処理するバックアップの日付は`--archive-schedule daily`（既定・全日）、
`--archive-schedule weekly:0`（日曜）、`--archive-schedule monthly:1`（毎月1日）で選別できます。
判定対象はアーカイブの更新日時です。`--dry-run`を付けるとDockerを起動せず対象だけ確認できます。
ワールド別に設定した定期実行例は[README](README.md)を参照してください。

```bash
bash minecraft-map/generate-history.sh \
  --archive-directory .tmp/6c1044f4-a2d8-48e1-8839-d1aec89ebe8d \
  --world-id 6c1044f4 \
  --world-label 'PMC6.0'
```

小範囲で確認する場合は、末尾へ次を追加します。

```bash
  --render-mode radius \
  --radius 64 \
  --center-x 272 \
  --center-z 153
```

サーバーの時刻をUTCなど別のタイムゾーンとして解釈する場合は、`--timezone UTC`のように指定できます。途中から再実行すると完成済みのスナップショットは自動的にスキップされます。

Windows/PowerShell版も`minecraft-map/.env.map`を自動的に読み込みます。不整合なバックアップをスキップして残りを処理する場合は、`-ContinueOnError`を追加します。失敗したファイルは最後に一覧表示され、終了コードは失敗として返ります。

## 本番

本番の公開入口は `gateway:8080` です。gatewayは同じWebサイトCompose内の`map-static`へ接続します。Cloudflare Tunnelの接続先を `http://gateway:8080` に設定すると、サイトと `/minecraft-map/` が同一ドメインになります。ホスト上で直接確認する場合は、既定で `http://127.0.0.1:8080` です。

ホストへNode.jsやnpmをインストールせず、Docker Composeだけで起動できます。

```sh
docker compose --env-file .env up -d --build --wait
```

この1コマンドで`gateway`、`frontend`、`map-static`、Directusなどの常駐サービスが起動します。`map-static`は`restart: unless-stopped`のため、Dockerデーモン再起動後も自動起動します。
