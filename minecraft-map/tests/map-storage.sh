#!/usr/bin/env bash
set -Eeuo pipefail

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
source "$script_directory/generator/map-storage.sh"
test_directory="$(mktemp -d)"
trap 'rm -rf -- "$test_directory"' EXIT
output="$test_directory/NAS output"
renderer="$test_directory/work/renderer"
mkdir -p "$output" "$test_directory/work"

check_map_storage "$output" false
check_local_map_work_storage "$test_directory/work"
if check_map_storage "$output" true 2>/dev/null; then
  echo 'FAIL: local storage accepted as NFS' >&2; exit 1
fi
if check_map_storage "$output" invalid 2>/dev/null; then
  echo 'FAIL: invalid NFS setting accepted' >&2; exit 1
fi
if check_map_storage "$test_directory/missing" true 2>/dev/null; then
  echo 'FAIL: missing NFS directory accepted' >&2; exit 1
fi
# Simulate the filesystem report; actual NFS integration needs a NAS.
stat() { printf 'nfs\n'; }
check_map_storage "$output" true
if check_local_map_work_storage "$test_directory/work" 2>/dev/null; then
  echo 'FAIL: NFS work directory accepted as local' >&2; exit 1
fi
unset -f stat

next="$(prepare_map_snapshot "$test_directory/work" world snapshot)"
link_dynmap_output "$renderer" "$next"
mkdir -p "$renderer/plugins/dynmap/web/tiles/world"
printf 'tile\n' > "$renderer/plugins/dynmap/web/tiles/world/tile.png"
mkdir -p "$next/bluemap/maps/world"
printf 'model\n' > "$next/bluemap/maps/world/model.json.gz"
[[ -f "$next/tiles/world/tile.png" ]]
[[ "$(stat -c '%a' "$next")" == '755' ]]
[[ -z "$(find "$output" -type f -name '*.png' -print)" ]]
if publish_map_snapshot "$next" "$output" world snapshot 2>/dev/null; then
  echo 'FAIL: unfinished snapshot was published' >&2; exit 1
fi
printf 'ok\n' > "$next/health.txt"
cp() { printf 'partial\n' > "$4/incomplete.txt"; return 1; }
if publish_map_snapshot "$next" "$output" world snapshot 2>/dev/null; then
  echo 'FAIL: failed copy was published' >&2; exit 1
fi
unset -f cp
[[ ! -e "$output/worlds/world/snapshots/snapshot" ]]
[[ -n "$(find "$output" -name incomplete.txt -print)" ]]
publish_map_snapshot "$next" "$output" world snapshot
[[ -f "$output/worlds/world/snapshots/snapshot/tiles/world/tile.png" ]]
[[ -f "$output/worlds/world/snapshots/snapshot/bluemap/maps/world/model.json.gz" ]]
[[ -f "$output/worlds/world/snapshots/snapshot/health.txt" ]]
[[ "$(stat -c '%a' "$output/worlds/world/snapshots/snapshot")" == '755' ]]
if prepare_map_snapshot "$output" world snapshot 2>/dev/null; then
  echo 'FAIL: existing snapshot accepted' >&2; exit 1
fi
if publish_map_snapshot "$next" "$output" world snapshot 2>/dev/null; then
  echo 'FAIL: existing snapshot was replaced' >&2; exit 1
fi
if prepare_map_snapshot "$output" '../escape' snapshot 2>/dev/null; then
  echo 'FAIL: unsafe world ID accepted' >&2; exit 1
fi
if prepare_map_snapshot "$output" world '../escape' 2>/dev/null; then
  echo 'FAIL: unsafe snapshot ID accepted' >&2; exit 1
fi
echo 'PASS: local rendering, complete publication, copy failure, permissions and NFS guards'
