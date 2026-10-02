#!/usr/bin/env bash
set -Eeuo pipefail

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
test_directory="$(mktemp -d)"
trap 'rm -rf -- "$test_directory"' EXIT

mock_bin="$test_directory/bin"
mkdir -p "$mock_bin"
cat > "$mock_bin/docker" <<'EOF'
#!/usr/bin/env bash
if [[ " $* " == *' config --format json '* ]]; then
  [[ "${TEST_CONFIG_FAIL:-false}" != 'true' ]] || exit 1
  python3 -c 'import json, os; print(json.dumps({"services": {"map-generator": {"volumes": [{"source": os.environ["TEST_OUTPUT"], "target": "/output"}], "environment": {"MAP_REQUIRE_NFS": os.environ.get("TEST_REQUIRE_NFS", "false")}}}}))'
else
  printf '%s\n' "$*" >> "$DOCKER_LOG"
fi
EOF
chmod +x "$mock_bin/docker"
export PATH="$mock_bin:$PATH"
export TEST_OUTPUT="$test_directory/NAS output"
export DOCKER_LOG="$test_directory/docker.log"
mkdir -p "$TEST_OUTPUT"

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
orphan_path="$TEST_OUTPUT/worlds/$orphan_world_id/snapshots/$orphan_snapshot_id"
mock_bin="$test_directory/bin"
docker_log="$test_directory/docker.log"
mkdir -p -- "$orphan_path" "$mock_bin"
printf 'partial\n' > "$orphan_path/partial.txt"
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
rm -rf -- "$TEST_OUTPUT/worlds/$orphan_world_id"
printf 'PASS: unregistered snapshot directory is regenerated\n'

mkdir -p "$orphan_path"
printf 'ok\n' > "$orphan_path/health.txt"
python3 -c 'import json, os; from pathlib import Path; (Path(os.environ["TEST_OUTPUT"]) / "catalog.json").write_text(json.dumps({"version": 1, "worlds": [{"id": "schedule-orphan-test", "snapshots": [{"id": "20260901T003000", "createdAt": "2026-09-01T00:30:00Z"}]}]}))'
: > "$docker_log"
completed_archives="$test_directory/completed-archives"
mkdir -p "$completed_archives"
cp -p "$test_directory/2026-09-01.tar.gz" "$completed_archives/"
existing_output="$(bash "$script_directory/generate-history.sh" --archive-directory "$completed_archives" \
  --world-id "$orphan_world_id" --archive-schedule monthly:1 --timezone UTC)"
[[ "$existing_output" == *'Skip existing snapshot 20260901T003000'* && ! -s "$docker_log" ]]
[[ -f "$orphan_path/health.txt" ]]
printf 'PASS: completed snapshots are found in configured external output\n'

if TEST_REQUIRE_NFS=true bash "$script_directory/generate-history.sh" --archive-directory "$test_directory" \
  --world-id "$orphan_world_id" --force >/dev/null 2>&1; then
  printf 'FAIL: local output accepted with NFS required\n' >&2; exit 1
fi
[[ -f "$orphan_path/health.txt" && ! -s "$docker_log" ]]
if TEST_CONFIG_FAIL=true bash "$script_directory/generate-history.sh" --archive-directory "$test_directory" \
  --world-id "$orphan_world_id" --force >/dev/null 2>&1; then
  printf 'FAIL: failed Compose config accepted\n' >&2; exit 1
fi
[[ -f "$orphan_path/health.txt" && ! -s "$docker_log" ]]
printf 'PASS: NFS and configuration failures stop before snapshot deletion\n'

retention_output="$(bash "$script_directory/generate-history.sh" --archive-directory "$test_directory" \
  --world-id "$orphan_world_id" --history-retention mondays --timezone UTC --dry-run)"
[[ "$retention_output" != *'would remove non-Monday snapshot 20260901T003000'* ]]
[[ -f "$orphan_path/health.txt" ]]

python3 -c 'import json, os; from pathlib import Path; root = Path(os.environ["TEST_OUTPUT"]); snapshots = [{"id": "20260802T003000", "createdAt": "2026-08-02T00:30:00Z"}, {"id": "20260803T003000", "createdAt": "2026-08-03T00:30:00Z"}, {"id": "20260901T003000", "createdAt": "2026-09-01T00:30:00Z"}]; [(root / "worlds/schedule-orphan-test/snapshots" / item["id"]).mkdir(parents=True, exist_ok=True) for item in snapshots]; [(root / "worlds/schedule-orphan-test/snapshots" / item["id"] / "health.txt").write_text("ok") for item in snapshots]; (root / "catalog.json").write_text(json.dumps({"version": 1, "worlds": [{"id": "schedule-orphan-test", "snapshots": snapshots}]}))'
bash "$script_directory/generate-history.sh" --archive-directory "$test_directory" \
  --world-id "$orphan_world_id" --history-retention mondays --timezone UTC >/dev/null
[[ ! -d "$TEST_OUTPUT/worlds/$orphan_world_id/snapshots/20260802T003000" ]]
[[ -f "$TEST_OUTPUT/worlds/$orphan_world_id/snapshots/20260803T003000/health.txt" ]]
[[ -f "$orphan_path/health.txt" && ! -s "$docker_log" ]]
printf 'PASS: retention updates configured external output and preserves Mondays/latest\n'

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
