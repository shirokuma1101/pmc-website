#!/usr/bin/env bash
set -Eeuo pipefail

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
test_directory="$(mktemp -d)"
trap 'rm -rf -- "$test_directory"' EXIT

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

orphan_world_id='schedule-orphan-test'
orphan_snapshot_id='20260901T003000'
orphan_path="$script_directory/output/worlds/$orphan_world_id/snapshots/$orphan_snapshot_id"
mock_bin="$test_directory/bin"
docker_log="$test_directory/docker.log"
mkdir -p -- "$orphan_path" "$mock_bin"
printf 'partial\n' > "$orphan_path/partial.txt"
cat > "$mock_bin/docker" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$DOCKER_LOG"
EOF
chmod +x "$mock_bin/docker"
DOCKER_LOG="$docker_log" PATH="$mock_bin:$PATH" bash "$script_directory/generate-history.sh" \
  --archive-directory "$test_directory" --world-id "$orphan_world_id" \
  --archive-schedule monthly:1 --timezone UTC
[[ ! -d "$orphan_path" ]] || {
  printf 'FAIL: unregistered snapshot directory was not replaced\n' >&2
  exit 1
}
grep -q 'MAP_SNAPSHOT_ID=20260901T003000' "$docker_log" || {
  printf 'FAIL: unregistered snapshot was not sent for regeneration\n' >&2
  exit 1
}
rm -rf -- "$script_directory/output/worlds/$orphan_world_id"
printf 'PASS: unregistered snapshot directory is regenerated\n'

# At 00:30 UTC the date is still the previous day in this timezone.
check_count monthly:31 2 America/Los_Angeles

retention_output="$(bash "$script_directory/generate-history.sh" \
  --archive-directory "$test_directory" --world-id schedule-test \
  --archive-schedule daily --history-retention mondays --timezone UTC --dry-run --force)"
retention_count="$(printf '%s\n' "$retention_output" | grep -c '\[map-history\] Generate ' || true)"
[[ "$retention_count" == '2' ]] || {
  printf 'FAIL: Monday retention expected 2, got %s\n%s\n' "$retention_count" "$retention_output" >&2
  exit 1
}
printf 'PASS: Monday retention selects Mondays and latest archive\n'

for invalid in weekly:7 monthly:0 monthly:32 unknown; do
  if bash "$script_directory/generate-history.sh" --archive-directory "$test_directory" \
    --archive-schedule "$invalid" --dry-run >/dev/null 2>&1; then
    printf 'FAIL: accepted invalid schedule %s\n' "$invalid" >&2
    exit 1
  fi
done
if bash "$script_directory/generate-history.sh" --archive-directory "$test_directory" \
  --history-retention tuesdays --dry-run >/dev/null 2>&1; then
  printf 'FAIL: accepted invalid history retention\n' >&2
  exit 1
fi
printf 'PASS: invalid schedules rejected\n'
