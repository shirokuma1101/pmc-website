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

3. `http://localhost:10100/map` を開きます。

Webサイトの停止は `npm run docker:down`、ログ確認は `npm run docker:logs` です。`minecraft-map/output`は`map-static`へ読み取り専用でマウントされ、Nginx自体のポートは外部へ公開されません。

## 地図を更新する

ジェネレーターは保存先内の一時ディレクトリへ直接レンダリングし、完成後にスナップショットの公開パスへ移動します。既定の保存先は`minecraft-map/output`です。配信用Nginxの再起動は不要です。Bedrockワールドの展開、Chunker変換、Paper実行用ファイルはローカルの`minecraft-map/work`に置き、配信用Nginxとは別の一時コンテナで処理します。

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

生成した出力は、WebサイトComposeで常時起動している`map-static`からそのまま配信されます。保存先を変更しない通常の更新では、再作成やディレクトリのコピーは不要です。

### Ubuntu＋TrueNAS SCALEのNFSへ保存する

`MAP_OUTPUT_DIRECTORY`で完成データと生成中のDynmap・BlueMapタイルの保存先を変更できます。未設定・空欄の場合は`./output`です。相対パスは`minecraft-map/docker-compose.map.yml`のあるディレクトリ基準です。NASには絶対パスを指定してください。保存先ディレクトリは実行前に用意します。Composeのbind mountには`create_host_path: false`を指定しています。[Docker Composeのbind mount仕様](https://docs.docker.com/reference/compose-file/services/#volumes)も参照してください。

1. TrueNASでマップ専用のデータセットとNFS共有を用意し、Ubuntuホストからのアクセスを許可します。実行ユーザーにファイル作成・削除・rename・chmodを許可し、配信用Nginxにはファイルの読み取りとディレクトリの通過を許可してください。UID/GIDを揃えるか、共有のMapall User/Groupを専用ユーザーに設定します。Ubuntu履歴スクリプトは実行ユーザーのUID/GIDを生成コンテナにも適用します。直接`docker compose run`する場合は`MAP_GENERATOR_UID`/`MAP_GENERATOR_GID`を合わせてください。[TrueNAS公式NFS共有ガイド](https://cdn.truenas.com/docs/scale/scaletutorials/shares/addingnfsshares/)を参照してください。

2. Ubuntu側へNFS共有をマウントします。以下のIP・共有パスは例で、実際の値に置き換えます。

   ```bash
   sudo apt-get install nfs-common
   sudo mkdir -p /mnt/pmc-map
   sudo mount -t nfs 192.0.2.10:/mnt/tank/pmc-map /mnt/pmc-map
   findmnt -T /mnt/pmc-map
   ```

3. `minecraft-map/.env.map`を設定します。

   ```env
   MAP_OUTPUT_DIRECTORY=/mnt/pmc-map
   MAP_REQUIRE_NFS=true
   ```

   `MAP_REQUIRE_NFS=true`ではUbuntu履歴スクリプトが生成・履歴削除前に、生成コンテナがレンダリング開始前に、保存先のファイルシステム種別がNFSであることを確認します。未マウント時に残るローカルディレクトリでは停止します。ローカルディスクやSMBを使う場合は`false`にします。NASの接続断を監視する機能ではなく、NFS通信障害時の待機・復旧動作はホストのマウント設定に従います。

4. 設定を明示して生成イメージを再ビルドします。単発生成でも同じ環境ファイルを渡してください。`npm run map:build`/`npm run map:generate`は`.env.map`を自動で指定しないため、NAS設定には以下のコマンドを使用します。

   ```bash
   docker compose --env-file minecraft-map/.env.map \
     -f minecraft-map/docker-compose.map.yml build map-generator
   docker compose --env-file minecraft-map/.env.map \
     -f minecraft-map/docker-compose.map.yml run --rm map-generator
   ```

   履歴の一括生成は下記の`generate-history.sh`を使います。`.env.map`は自動で読み込まれます。出力先の解決に`docker compose config --format json`を使用するため、`--dry-run`でもDocker ComposeとPython 3が必要です。シェルでexportした同名変数はComposeの規則に従って`.env.map`より優先されます。

5. 配信用の`.env`（開発では`.env.local`）にも同じ保存先を設定し、NASをマウントした状態で`map-static`を再作成します。

   ```env
   MINECRAFT_MAP_DATA_PATH=/mnt/pmc-map
   ```

   ```bash
   docker compose --env-file .env up -d --no-deps --force-recreate map-static
   ```

   開発環境は`docker compose --env-file .env.local -f docker-compose.dev.yml up -d --no-deps --force-recreate map-static`です。ホスト起動時も、NFSのマウントを完了してから配信用コンテナを起動する運用にしてください。

指定先には`catalog.json`と`worlds/`が生成されます。タイルは指定先の`.snapshot-<world>-<snapshot>-<ランダム値>/`へ直接書き込み、成功時に同じ保存先内の`worlds/<world>/snapshots/<snapshot>/`へ移動するため、ローカルにタイルを生成・コピーしません。配信用Nginxは`.snapshot-*`へのアクセスを404で拒否します。このNginx設定の適用にも`map-static`の再作成が必要です。BlueMapの設定・キャッシュは引き続きローカルの`work`を使用します。ワールド展開・変換に必要なローカル容量とinodeは別途必要です。

保存先を変更しても既存履歴は自動移行されません。既存履歴を残す場合は生成ジョブを停止し、`catalog.json`と`worlds/`を含む従来の`output`の内容を新しい保存先へコピーしてから切り替えてください。生成ジョブは従来どおり同時実行を避けます。失敗したジョブの`.snapshot-*`はカタログに登録されず、再試行では別の一時ディレクトリを作ります。残った一時ディレクトリは、生成ジョブが停止していることを確認したうえで管理者が整理してください。TrueNAS実機での権限・NFS性能は環境ごとに確認が必要です。

### BlueMap 3Dも生成する

BlueMapは変換済みJavaワールドから事前生成します。閲覧時にMinecraftサーバーやBlueMapの内蔵Webサーバーは不要です。初回は[Mojang EULA](https://www.minecraft.net/en-us/eula)を確認し、Minecraft Java Editionのライセンスを所有している場合に限り、`minecraft-map/.env.map`に次を設定します。BlueMapが描画に必要なMinecraftクライアント資源を取得します。

```env
BLUEMAP_ENABLED=true
BLUEMAP_ACCEPT_DOWNLOAD=true
BLUEMAP_RENDER_THREADS=2
BLUEMAP_HEAP=4G
```

`npm run map:build`の後に`npm run map:generate`を実行します。BlueMap 5.28とJava 25を含む生成イメージを使用し、Dynmapの描画終了後に同じJavaワールドをBlueMap CLIへ渡します。生成が完了したスナップショットだけが公開され、`catalog.json`に`blueMapUrl`が追加されます。`/map`の「表示」から「BlueMap 3D」を選ぶと、同じワールド・スナップショットの3D地図を表示します。未生成のスナップショットでは選択できません。生成物は`minecraft-map/output/worlds/<ワールドID>/snapshots/<スナップショットID>/bluemap/`に保存され、既存のNginxから配信されます。

BlueMap描画は時間・CPU・メモリ・ディスク容量を追加で使用します。必要に応じて`MAP_MEMORY_LIMIT`を`BLUEMAP_HEAP`より十分大きく設定してください。既存のスナップショットにBlueMapを後付けする処理はありません。履歴生成スクリプトは生成済みIDをスキップするため、過去分が必要なら元のバックアップから新しいスナップショットとして生成してください。静的ファイルは公開URLで閲覧可能であり、履歴の閲覧権限をサーバー側で制限する仕組みはありません。

配信設定を初めて適用するときは、WebサイトComposeの`map-static`を再起動してNginx設定を読み直してください。生成ジョブだけを実行した後は再起動不要です。BlueMapのバージョンを更新する際は、生成イメージのCLI jarとJavaランタイムをセットで検証し、古いスナップショットのWebアプリとの互換性も確認します。

アーカイブ名やメモリ量を指定する場合は、`minecraft-map/.env.map.example` を参考に環境変数を設定できます。複数ワールドでは `MAP_WORLD_ID` と `MAP_WORLD_LABEL`を変えて実行します。`MAP_SNAPSHOT_ID`が空欄なら実行日時が自動採番されます。通常は全領域を生成し、動作確認などで範囲を限定するときだけ `MAP_RENDER_MODE=radius` と中心座標・半径を指定してください。

### Ubuntuで履歴を一括生成する

UbuntuではPowerShell版ではなく、`generate-history.sh`を使用します。バックアップの更新日時は既定で`Asia/Tokyo`としてIDと表示日時へ変換されます。`minecraft-map/.env.map`が存在する場合は、自動的にDocker Composeの環境ファイルとして読み込みます。事前の`source`は不要です。

処理するバックアップの日付は`--archive-schedule daily`（既定・全日）、
`--archive-schedule weekly:0`（日曜）、`--archive-schedule monthly:1`（毎月1日）で選別できます。
判定対象はアーカイブの更新日時です。`--dry-run`を付けるとDockerを起動せず対象だけ確認できます。
`--history-retention mondays`を指定すると、月曜日分と最新分だけを履歴に保持します。
通常実行では保持条件外の生成済みスナップショットをカタログと出力から削除しますが、
元の`.tar.gz`バックアップは削除しません。`--dry-run`では削除予定も変更せずに確認できます。
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

サーバーの時刻をUTCなど別のタイムゾーンとして解釈する場合は、`--timezone UTC`のように指定できます。途中から再実行すると、出力ディレクトリとカタログの両方に存在する完成済みスナップショットは自動的にスキップされます。カタログに未登録の出力ディレクトリは中断処理の残骸とみなし、通常実行時に置き換えて再生成します。

Windows/PowerShell版も`minecraft-map/.env.map`を自動的に読み込み、Composeで解決された保存先のカタログを参照します。`MAP_REQUIRE_NFS=true`はホストのNFS確認ができるUbuntuのBash版で使用してください。PowerShell版では停止します。不整合なバックアップをスキップして残りを処理する場合は、`-ContinueOnError`を追加します。失敗したファイルは最後に一覧表示され、終了コードは失敗として返ります。

## 本番

本番の公開入口は `gateway:8080` です。gatewayは同じWebサイトCompose内の`map-static`へ接続します。Cloudflare Tunnelの接続先を `http://gateway:8080` に設定すると、サイトと `/minecraft-map/` が同一ドメインになります。ホスト上で直接確認する場合は、既定で `http://127.0.0.1:8080` です。

ホストへNode.jsやnpmをインストールせず、Docker Composeだけで起動できます。

```sh
docker compose --env-file .env up -d --build --wait
```

この1コマンドで`gateway`、`frontend`、`map-static`、Directusなどの常駐サービスが起動します。`map-static`は`restart: unless-stopped`のため、Dockerデーモン再起動後も自動起動します。
