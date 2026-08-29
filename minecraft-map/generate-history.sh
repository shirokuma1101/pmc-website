#!/usr/bin/env bash
set -Eeuo pipefail

archive_directory=''
world_id='world'
world_label='Minecraft World'
render_mode='full'
radius='512'
center_x='0'
center_z='0'
snapshot_timezone='Asia/Tokyo'
force='false'

usage() {
  cat <<'EOF'
Usage: generate-history.sh --archive-directory PATH [options]

Options:
  --world-id ID               Stable world identifier (default: world)
  --world-label LABEL         Display name (default: Minecraft World)
  --render-mode full|radius   Render mode (default: full)
  --radius BLOCKS             Radius for radius mode (default: 512)
  --center-x X                Radius center X (default: 0)
  --center-z Z                Radius center Z (default: 0)
  --timezone ZONE             Archive timestamp timezone (default: Asia/Tokyo)
  --force                     Regenerate existing snapshot IDs
EOF
}

while (($#)); do
  case "$1" in
    --archive-directory) archive_directory="${2:?missing value}"; shift 2 ;;
    --world-id) world_id="${2:?missing value}"; shift 2 ;;
    --world-label) world_label="${2:?missing value}"; shift 2 ;;
    --render-mode) render_mode="${2:?missing value}"; shift 2 ;;
    --radius) radius="${2:?missing value}"; shift 2 ;;
    --center-x) center_x="${2:?missing value}"; shift 2 ;;
    --center-z) center_z="${2:?missing value}"; shift 2 ;;
    --timezone) snapshot_timezone="${2:?missing value}"; shift 2 ;;
    --force) force='true'; shift ;;
    --help|-h) usage; exit 0 ;;
    *) printf 'Unknown option: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

[[ -n "$archive_directory" ]] || { usage >&2; exit 2; }
[[ "$render_mode" == 'full' || "$render_mode" == 'radius' ]] || { printf 'Invalid render mode: %s\n' "$render_mode" >&2; exit 2; }

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
archive_root="$(cd -- "$archive_directory" && pwd)"
compose_file="$script_directory/docker-compose.map.yml"
output_root="$script_directory/output"
mapfile -t archives < <(find "$archive_root" -maxdepth 1 -type f -name '*.tar.gz' -printf '%T@ %p\n' | sort -n | cut -d' ' -f2-)
[[ ${#archives[@]} -gt 0 ]] || { printf 'No .tar.gz archives found in %s\n' "$archive_root" >&2; exit 1; }

for archive in "${archives[@]}"; do
  modified_epoch="$(stat -c '%Y' "$archive")"
  snapshot_id="$(TZ="$snapshot_timezone" date -d "@$modified_epoch" '+%Y%m%dT%H%M%S')"
  snapshot_label="$(TZ="$snapshot_timezone" date -d "@$modified_epoch" '+%Y/%m/%d %H:%M')"
  snapshot_created_at="$(TZ="$snapshot_timezone" date -d "@$modified_epoch" '+%Y-%m-%dT%H:%M:%S%:z')"
  snapshot_path="$output_root/worlds/$world_id/snapshots/$snapshot_id"

  if [[ "$force" != 'true' && -d "$snapshot_path" ]]; then
    printf '[map-history] Skip existing snapshot %s (%s)\n' "$snapshot_id" "$(basename "$archive")"
    continue
  fi

  printf '[map-history] Generate %s / %s from %s\n' "$world_id" "$snapshot_label" "$(basename "$archive")"
  MAP_GENERATOR_UID="$(id -u)" \
  MAP_GENERATOR_GID="$(id -g)" \
  MAP_ARCHIVE_DIRECTORY="$archive_root" \
  docker compose -f "$compose_file" run --rm \
    -e "MAP_ARCHIVE=$(basename "$archive")" \
    -e "MAP_WORLD_ID=$world_id" \
    -e "MAP_WORLD_LABEL=$world_label" \
    -e "MAP_SNAPSHOT_ID=$snapshot_id" \
    -e "MAP_SNAPSHOT_LABEL=$snapshot_label" \
    -e "MAP_SNAPSHOT_CREATED_AT=$snapshot_created_at" \
    -e "MAP_RENDER_MODE=$render_mode" \
    -e "MAP_RENDER_RADIUS=$radius" \
    -e "MAP_RENDER_CENTER_X=$center_x" \
    -e "MAP_RENDER_CENTER_Z=$center_z" \
    map-generator
done

printf '[map-history] Complete. Catalog: %s/catalog.json\n' "$output_root"
