#!/usr/bin/env bash
set -Eeuo pipefail

world_dir="$1"
webroot="$2"
[[ -f "$world_dir/level.dat" ]] || { echo "BlueMap world is missing: $world_dir" >&2; exit 1; }
[[ "${BLUEMAP_ACCEPT_DOWNLOAD:-false}" == "true" ]] || {
  echo "Set BLUEMAP_ACCEPT_DOWNLOAD=true after accepting Mojang's EULA and confirming a Java Edition license." >&2
  exit 1
}
threads="${BLUEMAP_RENDER_THREADS:-2}"
[[ "$threads" =~ ^[1-9][0-9]*$ ]] || { echo "BLUEMAP_RENDER_THREADS must be a positive integer." >&2; exit 1; }
mc_version="${MAP_OUTPUT_FORMAT:-JAVA_1_21_4}"
mc_version="${mc_version#JAVA_}"
mc_version="${mc_version//_/.}"
[[ "$mc_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
  echo "MAP_OUTPUT_FORMAT must be a Java version such as JAVA_1_21_4." >&2
  exit 1
}

run_dir="$(dirname "$webroot")"
config="$run_dir/config"
mkdir -p "$config/maps" "$config/storages" "$webroot"
cd "$run_dir"
# BlueMap creates example configs and exits with status 1 when invoked without an action.
/opt/java25/bin/java -jar /opt/bluemap.jar -c "$config" >/dev/null 2>&1 || true
[[ -f "$config/core.conf" && -f "$config/webapp.conf" && -f "$config/webserver.conf" ]] || {
  echo "BlueMap did not initialize its configuration." >&2
  exit 1
}
rm -f "$config/maps/"*.conf
cat > "$config/core.conf" <<EOF
accept-download: true
data: "$run_dir/data"
render-thread-count: $threads
EOF
cat > "$config/webapp.conf" <<EOF
enabled: true
webroot: "$webroot"
use-cookies: false
EOF
cat > "$config/webserver.conf" <<EOF
enabled: false
EOF
cat > "$config/storages/file.conf" <<EOF
storage-type: file
root: "$webroot/maps"
compression: gzip
EOF
cat > "$config/maps/world.conf" <<EOF
world: "$world_dir"
dimension: "minecraft:overworld"
storage: "file"
EOF

/opt/java25/bin/java "-Xmx${BLUEMAP_HEAP:-4G}" -jar /opt/bluemap.jar -c "$config" -v "$mc_version" -r -g -s
[[ -f "$webroot/index.html" && -f "$webroot/settings.json" ]] || {
  echo "BlueMap web output is incomplete." >&2
  exit 1
}
