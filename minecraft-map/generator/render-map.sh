#!/usr/bin/env bash
set -Eeuo pipefail

log() { printf '[map-generator] %s\n' "$*"; }
fail() { log "ERROR: $*" >&2; exit 1; }

archive="${MAP_ARCHIVE:-}"
if [[ -n "$archive" ]]; then
  [[ "$archive" == /* ]] || archive="/input/$archive"
else
  mapfile -t archives < <(find /input -maxdepth 1 -type f -name '*.tar.gz' -print | sort)
  [[ ${#archives[@]} -eq 1 ]] || fail "Place exactly one .tar.gz in minecraft-map/input, or set MAP_ARCHIVE."
  archive="${archives[0]}"
fi
[[ -f "$archive" ]] || fail "Archive not found: $archive"

run_root="/work/run"
rm -rf "$run_root"
mkdir -p "$run_root/extracted" "$run_root/renderer/plugins"
log "Extracting $(basename "$archive")"
/usr/local/bin/extract_archive.py "$archive" "$run_root/extracted"

properties="$(find "$run_root/extracted" -type f -name server.properties -print -quit)"
[[ -n "$properties" ]] || fail "server.properties was not found in the archive."
server_root="$(dirname "$properties")"
level_name="$(sed -n 's/^level-name=//p' "$properties" | tail -n 1 | tr -d '\r')"
level_name="${level_name:-Bedrock level}"
bedrock_world="$server_root/worlds/$level_name"
[[ -f "$bedrock_world/level.dat" && -d "$bedrock_world/db" ]] || fail "Bedrock world not found: worlds/$level_name"

log "Converting Bedrock world '$level_name' to ${MAP_OUTPUT_FORMAT:-JAVA_1_21_4}"
java "-Xmx${CHUNKER_HEAP:-8G}" -jar /opt/chunker.jar \
  --inputDirectory "$bedrock_world" \
  --outputDirectory "$run_root/java-world" \
  --outputFormat "${MAP_OUTPUT_FORMAT:-JAVA_1_21_4}"
[[ -f "$run_root/java-world/level.dat" ]] || fail "Chunker did not create a Java world."

# This site intentionally publishes only the Overworld. Remove converted
# dimensions from the disposable Java copy before Paper performs migrations.
rm -rf "$run_root/java-world/DIM-1" "$run_root/java-world/DIM1"

renderer="$run_root/renderer"
world_name="${MAP_WORLD_NAME:-world}"
mv "$run_root/java-world" "$renderer/$world_name"
cp /opt/paper.jar "$renderer/paper.jar"
cp /opt/dynmap.jar "$renderer/plugins/Dynmap.jar"
printf 'eula=true\n' > "$renderer/eula.txt"
cat > "$renderer/bukkit.yml" <<'EOF'
settings:
  allow-end: false
EOF
cat > "$renderer/server.properties" <<EOF
level-name=$world_name
server-ip=127.0.0.1
server-port=25575
online-mode=false
max-players=1
allow-flight=true
allow-nether=false
view-distance=2
simulation-distance=2
spawn-animals=false
spawn-monsters=false
spawn-npcs=false
generate-structures=false
max-tick-time=-1
enable-status=false
EOF

paper_pid=''
exec 3>/dev/null
stop_paper() {
  if [[ -n "$paper_pid" ]] && kill -0 "$paper_pid" 2>/dev/null; then
    printf 'stop\n' >&3 || true
    for _ in {1..60}; do kill -0 "$paper_pid" 2>/dev/null || break; sleep 1; done
    kill "$paper_pid" 2>/dev/null || true
    wait "$paper_pid" 2>/dev/null || true
  fi
}
trap stop_paper EXIT INT TERM

start_paper() {
  rm -f "$renderer/server-input"
  mkfifo "$renderer/server-input"
  exec 3<>"$renderer/server-input"
  (
    cd "$renderer"
    java "-Xms1G" "-Xmx${PAPER_HEAP:-6G}" -jar paper.jar --nogui < server-input 2>&1 | tee -a generator.log
  ) &
  paper_pid=$!
}

wait_for_log() {
  local pattern="$1" timeout="${2:-600}" start
  start=$(date +%s)
  until grep -Fq "$pattern" "$renderer/generator.log" 2>/dev/null; do
    kill -0 "$paper_pid" 2>/dev/null || fail "Paper stopped before: $pattern"
    (( $(date +%s) - start < timeout )) || fail "Timed out waiting for: $pattern"
    sleep 2
  done
}

log "Starting Paper once to initialize Dynmap"
: > "$renderer/generator.log"
start_paper
wait_for_log 'Done (' 900
printf 'stop\n' >&3
wait "$paper_pid"
paper_pid=''

dynmap_config="$renderer/plugins/dynmap/configuration.txt"
[[ -f "$dynmap_config" ]] || fail "Dynmap configuration was not generated."
sed -i 's/^disable-webserver:.*/disable-webserver: true/' "$dynmap_config"
sed -i 's/^deftemplatesuffix:.*/deftemplatesuffix: hires/' "$dynmap_config"
sed -i 's/class: org\.dynmap\.InternalClientUpdateComponent/class: org.dynmap.JsonFileClientUpdateComponent/' "$dynmap_config"

log "Starting render server"
: > "$renderer/generator.log"
start_paper
wait_for_log 'Done (' 900

# The site exposes only the top-down and 3D surface views.
printf 'dynmap pause all\n' >&3
sleep 2
printf 'dmap mapdelete %s:cave\n' "$world_name" >&3
sleep 2
printf 'dynmap pause none\n' >&3
sleep 2

if [[ "${MAP_RENDER_MODE:-full}" == 'radius' ]]; then
  log "Rendering all configured maps in radius ${MAP_RENDER_RADIUS:-512}"
  printf 'dynmap radiusrender %s %s %s %s\n' \
    "$world_name" "${MAP_RENDER_CENTER_X:-0}" "${MAP_RENDER_CENTER_Z:-0}" "${MAP_RENDER_RADIUS:-512}" >&3
  wait_for_log "Radius render of '$world_name' finished" "${MAP_RENDER_TIMEOUT_SECONDS:-43200}"
else
  IFS=',' read -ra render_maps <<< "${MAP_RENDER_MAPS:-flat,surface}"
  for map_name in "${render_maps[@]}"; do
    map_name="${map_name//[[:space:]]/}"
    [[ -n "$map_name" ]] || continue
    command="dynmap fullrender ${world_name}:${map_name}"
    completion="Full render of map '$map_name' of '$world_name' completed"
    log "Rendering $map_name"
    printf '%s\n' "$command" >&3
    wait_for_log "$completion" "${MAP_RENDER_TIMEOUT_SECONDS:-43200}"
  done
fi

printf 'dynmap pause all\n' >&3
printf 'stop\n' >&3
wait "$paper_pid"
paper_pid=''
[[ -f "$renderer/plugins/dynmap/web/standalone/dynmap_config.json" ]] || fail "Dynmap web output is incomplete."

created_at="${MAP_SNAPSHOT_CREATED_AT:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
snapshot_id="${MAP_SNAPSHOT_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"
world_id="${MAP_WORLD_ID:-$world_name}"
world_label="${MAP_WORLD_LABEL:-$world_id}"
snapshot_label="${MAP_SNAPSHOT_LABEL:-$created_at}"
[[ "$world_id" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || fail "MAP_WORLD_ID contains unsupported characters."
[[ "$snapshot_id" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || fail "MAP_SNAPSHOT_ID contains unsupported characters."
snapshot_root="/output/worlds/$world_id/snapshots"
target="$snapshot_root/$snapshot_id"
[[ ! -e "$target" ]] || fail "Snapshot already exists: $world_id/$snapshot_id"
next="/output/.snapshot-$world_id-$snapshot_id"
mkdir -p "$next"
cp -a "$renderer/plugins/dynmap/web/." "$next/"
printf 'ok\n' > "$next/health.txt"
mkdir -p "$snapshot_root"
mv "$next" "$target"
/usr/local/bin/update_catalog.py \
  --output /output \
  --world-id "$world_id" \
  --world-name "$world_label" \
  --snapshot-id "$snapshot_id" \
  --snapshot-label "$snapshot_label" \
  --created-at "$created_at" \
  --base-url "${MAP_PUBLIC_BASE_URL:-/minecraft-map}" \
  --metadata "$target/metadata.json" \
  --source "$(basename "$archive")" \
  --dynmap-world "$world_name"
log "Complete: $target"
