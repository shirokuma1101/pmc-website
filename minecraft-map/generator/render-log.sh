#!/usr/bin/env bash

render_log_next_line() {
  local log_file="$1" line_count=0
  if [[ -f "$log_file" ]]; then
    line_count="$(wc -l < "$log_file")"
  fi
  printf '%s\n' "$((line_count + 1))"
}

wait_for_log() {
  local pattern="$1" timeout="${2:-600}" start_line="${3:-1}" start
  start="$(date +%s)"
  until tail -n "+$start_line" "$renderer/generator.log" 2>/dev/null | grep -Fq "$pattern"; do
    kill -0 "$paper_pid" 2>/dev/null || fail "Paper stopped before: $pattern"
    (( $(date +%s) - start < timeout )) || fail "Timed out waiting for: $pattern"
    sleep "${MAP_RENDER_LOG_POLL_SECONDS:-2}"
  done
}
