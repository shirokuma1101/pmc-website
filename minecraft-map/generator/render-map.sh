#!/usr/bin/env bash
set -Eeuo pipefail

log() { printf '[map-generator] %s\n' "$*"; }
fail() { log "ERROR: $*" >&2; exit 1; }
source /usr/local/lib/render-log.sh
source /usr/local/lib/map-storage.sh
check_map_storage /output "${MAP_REQUIRE_NFS:-false}" || fail "Output storage check failed."

if [[ "${BLUEMAP_ENABLED:-false}" == "true" && "${BLUEMAP_ACCEPT_DOWNLOAD:-false}" != "true" ]]; then
  fail "Set BLUEMAP_ACCEPT_DOWNLOAD=true after accepting Mojang's EULA and confirming a Java Edition license."
fi

relight_timeout="${BLUEMAP_RELIGHT_TIMEOUT_SECONDS:-86400}"
[[ "$relight_timeout" =~ ^[1-9][0-9]*$ ]] || fail "BLUEMAP_RELIGHT_TIMEOUT_SECONDS must be a positive integer."

render_threads="${MAP_RENDER_THREADS:-}"
if [[ -n "$render_threads" ]]; then
  [[ "$render_threads" =~ ^[1-9][0-9]*$ ]] || fail "MAP_RENDER_THREADS must be a positive integer."
fi

archive="${MAP_ARCHIVE:-}"
if [[ -n "$archive" ]]; then
  [[ "$archive" == /* ]] || archive="/input/$archive"
else
  mapfile -t archives < <(find /input -maxdepth 1 -type f -name '*.tar.gz' -print | sort)
  [[ ${#archives[@]} -eq 1 ]] || fail "Place exactly one .tar.gz in minecraft-map/input, or set MAP_ARCHIVE."
  archive="${archives[0]}"
fi
[[ -f "$archive" ]] || fail "Archive not found: $archive"

created_at="${MAP_SNAPSHOT_CREATED_AT:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
snapshot_id="${MAP_SNAPSHOT_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"
world_name="${MAP_WORLD_NAME:-world}"
world_id="${MAP_WORLD_ID:-$world_name}"
world_label="${MAP_WORLD_LABEL:-$world_id}"
snapshot_label="${MAP_SNAPSHOT_LABEL:-$created_at}"
next="$(prepare_map_snapshot /output "$world_id" "$snapshot_id")" || fail "Cannot prepare snapshot output."
snapshot_root="/output/worlds/$world_id/snapshots"
target="$snapshot_root/$snapshot_id"

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
link_dynmap_output "$renderer" "$next"
mv "$run_root/java-world" "$renderer/$world_name"
cp /opt/paper.jar "$renderer/paper.jar"
cp /opt/dynmap.jar "$renderer/plugins/Dynmap.jar"
if [[ "${BLUEMAP_ENABLED:-false}" == "true" ]]; then
  cp /opt/chunky.jar "$renderer/plugins/Chunky.jar"
  mkdir -p "$renderer/plugins/Chunky"
  cat > "$renderer/plugins/Chunky/config.yml" <<'EOF'
version: 2
language: en
continue-on-restart: false
force-load-existing-chunks: true
silent: false
update-interval: 1
EOF
fi
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

log "Starting Paper once to initialize Dynmap"
: > "$renderer/generator.log"
start_paper
wait_for_log 'Done (' 900
if [[ "${BLUEMAP_ENABLED:-false}" == "true" ]]; then
  grep -Fq '[Chunky] Enabling Chunky v' "$renderer/generator.log" || fail "Chunky did not start."
  read -r min_x min_z max_x max_z < <(
    /usr/local/bin/chunky-region-bounds.py "$renderer/$world_name/region"
  ) || fail "Cannot determine existing Java chunk bounds."
  log "Relighting existing chunks for BlueMap ($min_x,$min_z to $max_x,$max_z)"
  printf 'chunky world %s\n' "$world_name" >&3
  printf 'chunky corners %s %s %s %s\n' "$min_x" "$min_z" "$max_x" "$max_z" >&3
  printf 'chunky pattern world\n' >&3
  render_log_start="$(render_log_next_line "$renderer/generator.log")"
  printf 'chunky start\n' >&3
  wait_for_log "Task started in $world_name" 120 "$render_log_start"
  wait_for_log "Task finished for $world_name." "$relight_timeout" "$render_log_start"
fi
printf 'stop\n' >&3
wait "$paper_pid"
paper_pid=''

dynmap_config="$renderer/plugins/dynmap/configuration.txt"
[[ -f "$dynmap_config" ]] || fail "Dynmap configuration was not generated."
sed -i 's/^disable-webserver:.*/disable-webserver: true/' "$dynmap_config"
sed -i 's/^deftemplatesuffix:.*/deftemplatesuffix: hires/' "$dynmap_config"
sed -i 's/class: org\.dynmap\.InternalClientUpdateComponent/class: org.dynmap.JsonFileClientUpdateComponent/' "$dynmap_config"

if [[ -n "$render_threads" ]]; then
  if grep -Eq '^[[:space:]]*#?[[:space:]]*parallelrendercnt:' "$dynmap_config"; then
    sed -i -E "s/^[[:space:]]*#?[[:space:]]*parallelrendercnt:.*/parallelrendercnt: $render_threads/" "$dynmap_config"
  else
    printf '\nparallelrendercnt: %s\n' "$render_threads" >> "$dynmap_config"
  fi
  log "Using $render_threads Dynmap full-render threads"
fi

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
    render_log_start="$(render_log_next_line "$renderer/generator.log")"
    log "Rendering $map_name"
    printf '%s\n' "$command" >&3
    wait_for_log "$completion" "${MAP_RENDER_TIMEOUT_SECONDS:-43200}" "$render_log_start"
    wait_for_log "Full render of '$world_name' finished" "${MAP_RENDER_TIMEOUT_SECONDS:-43200}" "$render_log_start"
  done
fi

printf 'dynmap pause all\n' >&3
printf 'stop\n' >&3
wait "$paper_pid"
paper_pid=''
[[ -f "$renderer/plugins/dynmap/web/standalone/dynmap_config.json" ]] || fail "Dynmap web output is incomplete."

check_map_storage /output "${MAP_REQUIRE_NFS:-false}" || fail "Output storage check failed."
if [[ "${BLUEMAP_ENABLED:-false}" == "true" ]]; then
  log "Rendering BlueMap from converted Java world"
  /usr/local/bin/render-bluemap "$renderer/$world_name" "$next/bluemap" "$run_root/bluemap"
fi
[[ ! -e "$target" ]] || fail "Snapshot already exists: $world_id/$snapshot_id"
bluemap_url=''
if [[ "${BLUEMAP_ENABLED:-false}" == "true" ]]; then
  bluemap_url="${MAP_PUBLIC_BASE_URL:-/minecraft-map}/worlds/$world_id/snapshots/$snapshot_id/bluemap/"
fi
printf 'ok\n' > "$next/health.txt"
mkdir -p "$snapshot_root"
mv -T "$next" "$target"
catalog_args=()
if [[ -n "$bluemap_url" ]]; then
  catalog_args=(--bluemap-url "$bluemap_url")
fi
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
  --dynmap-world "$world_name" \
  "${catalog_args[@]}"
log "Complete: $target"
