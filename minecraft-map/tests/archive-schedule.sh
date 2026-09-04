#!/usr/bin/env bash
set -Eeuo pipefail

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
test_directory="$(mktemp -d)"
trap 'rm -f -- "$test_directory"/*.tar.gz; rmdir -- "$test_directory"' EXIT

for day in 2026-08-01 2026-08-02 2026-08-03 2026-08-09 2026-09-01; do
  touch -d "$day 00:30:00 UTC" "$test_directory/$day.tar.gz"
done

check_count() {
  local schedule="$1" expected="$2" timezone="${3:-UTC}" output count
  output="$(bash "$script_directory/generate-history.sh" \
    --archive-directory "$test_directory" --world-id schedule-test \
    --archive-schedule "$schedule" --timezone "$timezone" --dry-run --force)"
  count="$(printf '%s\n' "$output" | grep -c '\[map-history\] Generate ' || true)"
  [[ "$count" == "$expected" ]] || {
    printf 'FAIL: %s (%s): expected %s, got %s\n%s\n' "$schedule" "$timezone" "$expected" "$count" "$output" >&2
    exit 1
  }
  printf 'PASS: %s (%s) selects %s archives\n' "$schedule" "$timezone" "$count"
}

check_count daily 5
check_count weekly:0 2
check_count monthly:1 2
check_count monthly:31 0
# At 00:30 UTC the date is still the previous day in this timezone.
check_count monthly:31 2 America/Los_Angeles

for invalid in weekly:7 monthly:0 monthly:32 unknown; do
  if bash "$script_directory/generate-history.sh" --archive-directory "$test_directory" \
    --archive-schedule "$invalid" --dry-run >/dev/null 2>&1; then
    printf 'FAIL: accepted invalid schedule %s\n' "$invalid" >&2
    exit 1
  fi
done
printf 'PASS: invalid schedules rejected\n'
