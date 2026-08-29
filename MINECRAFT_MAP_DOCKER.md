# Minecraft map: Docker 実行ガイド

この構成では、WebサイトとDynmapの画像を1つの入口から配信します。地図画像は`minecraft-map/docker-compose.map.yml`のNginxが直接返すため、Next.jsの処理負荷にはなりません。生成処理は必要時だけ起動し、配信用Nginxは常時起動します。

## ローカルで起動する

1. 初回のみ環境ファイルを作成します。

   ```powershell
   npm run env:setup
   ```

2. 地図配信用Nginxを起動します。

   ```powershell
   npm run map:up
   ```

   `minecraft-map/output`が読み取り専用でNginxへマウントされます。Nginxは外部へポート公開せず、専用Dockerネットワーク`pmc-map-delivery`からのみアクセスできます。`restart: unless-stopped`のため、Docker再起動後も自動的に起動します。

3. 全サービスを起動します。

   ```powershell
   npm run docker:up
   ```

4. `http://localhost:3001/map` を開きます。

Webサイトの停止は `npm run docker:down`、ログ確認は `npm run docker:logs` です。地図配信を個別に停止する場合は`npm run map:down`、ログは`npm run map:logs`で確認できます。

## 地図を更新する

ジェネレーターは一時ディレクトリでレンダリングした後、完成したスナップショットを`minecraft-map/output`へ反映します。配信用Nginxの再起動は不要です。Bedrockワールドのスナップショット、Chunker変換、Paper/Dynmapレンダリングはデータ破損を避けるため、配信用Nginxとは別の一時コンテナで実行します。

## Bedrockサーバーのtar.gzから生成する

地図生成はWebサイト用のComposeとは分離されており、ゲームサーバーを起動しません。アーカイブ内の `server.properties` から `level-name` を読み取り、対応する `worlds/<level-name>` を自動検出します。

1. Bedrock Dedicated Server全体を含む `.tar.gz` を `minecraft-map/input` に1つ配置します。
2. 初回のみ生成イメージを作ります。

   ```powershell
   npm run map:build
   ```

3. 変換とレンダーを実行します。

   ```powershell
   npm run map:generate
   ```

生成物は `minecraft-map/output/worlds/<ワールドID>/snapshots/<撮影日時>` に追加されます。平面表示は `flat`、3D表示は `surface` として生成され、洞窟表示は除外されます。既存の履歴は上書きされず、`catalog.json`の最新スナップショットだけが更新されます。

生成した出力は、同じCompose内で常時起動している`map-static`からそのまま配信されます。再作成やディレクトリのコピーは不要です。

アーカイブ名やメモリ量を指定する場合は、`minecraft-map/.env.map.example` を参考に環境変数を設定できます。複数ワールドでは `MAP_WORLD_ID` と `MAP_WORLD_LABEL`を変えて実行します。`MAP_SNAPSHOT_ID`が空欄なら実行日時が自動採番されます。通常は全領域を生成し、動作確認などで範囲を限定するときだけ `MAP_RENDER_MODE=radius` と中心座標・半径を指定してください。

### Ubuntuで履歴を一括生成する

UbuntuではPowerShell版ではなく、`generate-history.sh`を使用します。バックアップの更新日時は既定で`Asia/Tokyo`としてIDと表示日時へ変換されます。

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

Windows/PowerShell版で不整合なバックアップをスキップして残りを処理する場合は、`-ContinueOnError`を追加します。失敗したファイルは最後に一覧表示され、終了コードは失敗として返ります。

## 本番

本番の公開入口は `gateway:8080` です。gatewayは専用Dockerネットワーク`pmc-map-delivery`を経由して地図Nginxへ接続します。Cloudflare Tunnelの接続先を `http://gateway:8080` に設定すると、サイトと `/minecraft-map/` が同一ドメインになります。ホスト上で直接確認する場合は、既定で `http://127.0.0.1:8080` です。

地図配信を先に起動してから、Webサイトを起動します。

```sh
npm run map:up
docker compose --env-file .env up -d --build --wait
```
