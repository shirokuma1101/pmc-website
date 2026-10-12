#!/usr/bin/env bash

# Both the host history job and the renderer must check before mutating storage.
check_map_storage() {
  local output="$1" require_nfs="${2:-false}" filesystem
  [[ "$require_nfs" == 'true' || "$require_nfs" == 'false' ]] || {
    printf 'MAP_REQUIRE_NFS must be true or false.\n' >&2
    return 1
  }
  if [[ "$require_nfs" == 'true' ]]; then
    [[ -d "$output" ]] || { printf 'NFS output directory is missing: %s\n' "$output" >&2; return 1; }
    filesystem="$(stat -f -c '%T' -- "$output")" || return 1
    [[ "$filesystem" == 'nfs' || "$filesystem" == 'nfs4' ]] || {
      printf 'MAP_REQUIRE_NFS=true but output is not on NFS: %s (%s)\n' "$output" "$filesystem" >&2
      return 1
    }
  fi
}

check_local_map_work_storage() {
  local work="$1" filesystem
  [[ -d "$work" ]] || { printf 'Local work directory is missing: %s\n' "$work" >&2; return 1; }
  filesystem="$(stat -f -c '%T' -- "$work")" || return 1
  case "$filesystem" in
    nfs|nfs4|cifs|smb2)
      printf 'Map work directory must be local: %s (%s)\n' "$work" "$filesystem" >&2
      return 1
      ;;
  esac
}

prepare_map_snapshot() {
  local output="$1" world_id="$2" snapshot_id="$3"
  [[ "$world_id" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || { printf 'Invalid world ID\n' >&2; return 1; }
  [[ "$snapshot_id" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || { printf 'Invalid snapshot ID\n' >&2; return 1; }
  [[ ! -e "$output/worlds/$world_id/snapshots/$snapshot_id" ]] || {
    printf 'Snapshot already exists: %s/%s\n' "$world_id" "$snapshot_id" >&2
    return 1
  }
  # Never reuse a failed render's partial tiles.
  local staging
  staging="$(mktemp -d "$output/.snapshot-$world_id-$snapshot_id-XXXXXXXX")" || return 1
  # Nginx uses a different UID; completed snapshots must be traversable.
  chmod 755 "$staging" || return 1
  printf '%s\n' "$staging"
}

link_dynmap_output() {
  local renderer="$1" webroot="$2"
  mkdir -p "$renderer/plugins/dynmap"
  ln -s "$webroot" "$renderer/plugins/dynmap/web"
}

publish_map_snapshot() {
  local local_snapshot="$1" output="$2" world_id="$3" snapshot_id="$4" staging target
  [[ -f "$local_snapshot/health.txt" ]] || {
    printf 'Completed local snapshot is missing: %s\n' "$local_snapshot" >&2
    return 1
  }
  staging="$(prepare_map_snapshot "$output" "$world_id" "$snapshot_id")" || return 1
  # Copy into a hidden directory on the destination filesystem. A failed copy
  # must never expose an incomplete snapshot at its public path.
  cp -R -- "$local_snapshot/." "$staging/" || return 1
  chmod 755 "$staging" || return 1
  target="$output/worlds/$world_id/snapshots/$snapshot_id"
  mkdir -p "$(dirname "$target")" || return 1
  [[ ! -e "$target" ]] || { printf 'Snapshot already exists: %s/%s\n' "$world_id" "$snapshot_id" >&2; return 1; }
  mv -T -- "$staging" "$target"
}
