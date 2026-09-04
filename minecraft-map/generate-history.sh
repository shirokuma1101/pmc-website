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
archive_schedule='daily'
dry_run='false'

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
  --archive-schedule RULE     daily | weekly:0-6 (Sun-Sat) | monthly:1-31
                             Select by archive modification date (default: daily)
  --dry-run                   List selected archives without starting Docker
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
    --archive-schedule) archive_schedule="${2:?missing value}"; shift 2 ;;
    --dry-run) dry_run='true'; shift ;;
    --force) force='true'; shift ;;
    --help|-h) usage; exit 0 ;;
    *) printf 'Unknown option: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

[[ -n "$archive_directory" ]] || { usage >&2; exit 2; }
[[ "$render_mode" == 'full' || "$render_mode" == 'radius' ]] || { printf 'Invalid render mode: %s\n' "$render_mode" >&2; exit 2; }
[[ "$archive_schedule" =~ ^(daily|weekly:[0-6]|monthly:([1-9]|[12][0-9]|3[01]))$ ]] || {
  printf 'Invalid archive schedule: %s (use daily, weekly:0-6, or monthly:1-31)\n' "$archive_schedule" >&2
  exit 2
}

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
archive_root="$(cd -- "$archive_directory" && pwd)"
compose_file="$script_directory/docker-compose.map.yml"
env_file="$script_directory/.env.map"
output_root="$script_directory/output"
compose_args=(-f "$compose_file")
if [[ -f "$env_file" ]]; then
  compose_args=(--env-file "$env_file" "${compose_args[@]}")
  printf '[map-history] Use environment file: %s\n' "$env_file"
fi
mapfile -t archives < <(find "$archive_root" -maxdepth 1 -type f -name '*.tar.gz' -printf '%T@ %p\n' | sort -n | cut -d' ' -f2-)
[[ ${#archives[@]} -gt 0 ]] || { printf 'No .tar.gz archives found in %s\n' "$archive_root" >&2; exit 1; }

for archive in "${archives[@]}"; do
  modified_epoch="$(stat -c '%Y' "$archive")"
  archive_weekday="$(TZ="$snapshot_timezone" date -d "@$modified_epoch" '+%w')"
  archive_day="$(TZ="$snapshot_timezone" date -d "@$modified_epoch" '+%-d')"
  if [[ "$archive_schedule" == weekly:* && "$archive_weekday" != "${archive_schedule#weekly:}" ]] ||
     [[ "$archive_schedule" == monthly:* && "$archive_day" != "${archive_schedule#monthly:}" ]]; then
    printf '[map-history] Skip date filter %s (%s)\n' "$archive_schedule" "$(basename "$archive")"
    continue
  fi
  snapshot_id="$(TZ="$snapshot_timezone" date -d "@$modified_epoch" '+%Y%m%dT%H%M%S')"
  snapshot_label="$(TZ="$snapshot_timezone" date -d "@$modified_epoch" '+%Y/%m/%d %H:%M')"
  snapshot_created_at="$(TZ="$snapshot_timezone" date -d "@$modified_epoch" '+%Y-%m-%dT%H:%M:%S%:z')"
  snapshot_path="$output_root/worlds/$world_id/snapshots/$snapshot_id"

  if [[ "$force" != 'true' && -d "$snapshot_path" ]]; then
    printf '[map-history] Skip existing snapshot %s (%s)\n' "$snapshot_id" "$(basename "$archive")"
    continue
  fi

  printf '[map-history] Generate %s / %s from %s\n' "$world_id" "$snapshot_label" "$(basename "$archive")"
  if [[ "$dry_run" == 'true' ]]; then
    printf '[map-history] Dry run: no conversion or rendering performed\n'
    continue
  fi
  MAP_GENERATOR_UID="$(id -u)" \
  MAP_GENERATOR_GID="$(id -g)" \
  MAP_ARCHIVE_DIRECTORY="$archive_root" \
  docker compose "${compose_args[@]}" run --rm \
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
