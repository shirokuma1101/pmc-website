#!/usr/bin/env bash
set -Eeuo pipefail

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
source "$script_directory/generator/map-storage.sh"
test_directory="$(mktemp -d)"
trap 'rm -rf -- "$test_directory"' EXIT
output="$test_directory/NAS output"
renderer="$test_directory/work/renderer"
mkdir -p "$output"

check_map_storage "$output" false
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
unset -f stat

next="$(prepare_map_snapshot "$output" world snapshot)"
link_dynmap_output "$renderer" "$next"
mkdir -p "$renderer/plugins/dynmap/web/tiles/world"
printf 'tile\n' > "$renderer/plugins/dynmap/web/tiles/world/tile.png"
[[ -f "$next/tiles/world/tile.png" ]]
[[ "$(stat -c '%a' "$next")" == '755' ]]
[[ -z "$(find "$test_directory/work" -type f -name '*.png' -print)" ]]
retry="$(prepare_map_snapshot "$output" world snapshot)"
[[ "$retry" != "$next" && ! -e "$retry/tiles" ]]
mkdir -p "$output/worlds/world/snapshots"
mv -T "$next" "$output/worlds/world/snapshots/snapshot"
[[ -f "$output/worlds/world/snapshots/snapshot/tiles/world/tile.png" ]]
if prepare_map_snapshot "$output" world snapshot 2>/dev/null; then
  echo 'FAIL: existing snapshot accepted' >&2; exit 1
fi
if prepare_map_snapshot "$output" '../escape' snapshot 2>/dev/null; then
  echo 'FAIL: unsafe world ID accepted' >&2; exit 1
fi
if prepare_map_snapshot "$output" world '../escape' 2>/dev/null; then
  echo 'FAIL: unsafe snapshot ID accepted' >&2; exit 1
fi
echo 'PASS: direct tile storage, publication, permissions, retries and NFS guards'
