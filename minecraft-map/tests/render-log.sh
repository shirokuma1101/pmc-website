#!/usr/bin/env bash
set -Eeuo pipefail

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
source "$script_directory/generator/render-log.sh"

test_directory="$(mktemp -d)"
trap 'rm -rf "$test_directory"; [[ -z "${paper_pid:-}" ]] || kill "$paper_pid" 2>/dev/null || true' EXIT
renderer="$test_directory/renderer"
mkdir -p "$renderer"
printf "Full render of map 'surface' of 'world' completed\nFull render of 'world' finished.\n" > "$renderer/generator.log"

start_line="$(render_log_next_line "$renderer/generator.log")"
[[ "$start_line" == '3' ]] || { printf 'Expected next line 3, got %s\n' "$start_line" >&2; exit 1; }

sleep 10 &
paper_pid=$!
fail() { printf '%s\n' "$*" >&2; exit 1; }
MAP_RENDER_LOG_POLL_SECONDS=0.05

(
  sleep 0.2
  printf "Full render of map 'surface' of 'world' completed\n" >> "$renderer/generator.log"
  sleep 0.2
  printf "Full render of 'world' finished.\n" >> "$renderer/generator.log"
) &

wait_for_log "Full render of map 'surface' of 'world' completed" 2 "$start_line"
if tail -n "+$start_line" "$renderer/generator.log" | grep -Fq "Full render of 'world' finished"; then
  printf 'World completion was unexpectedly present before its simulated event\n' >&2
  exit 1
fi
wait_for_log "Full render of 'world' finished" 2 "$start_line"

printf 'Render log sequencing test passed\n'
