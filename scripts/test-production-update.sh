#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
test_root="$(mktemp -d)"
trap 'rm -rf -- "${test_root}"' EXIT

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

assert_contains() {
  grep -Fq -- "$2" "$1" || fail "Missing command: $2"
}

assert_absent() {
  if grep -Fq -- "$2" "$1"; then
    fail "Unexpected command: $2"
  fi
}

run_update() (
  scenario="$1"
  fixture="${test_root}/${scenario}"
  mkdir -p "${fixture}/scripts" "${fixture}/directus/extensions" "${fixture}/directus/schema"
  cp "${script_dir}/production-update.sh" "${fixture}/scripts/production-update.sh"
  touch "${fixture}/directus/bootstrap.mjs"
  printf 'NEXT_PUBLIC_APP_URL=https://app.example.com\nNEXT_PUBLIC_DIRECTUS_URL=https://cms.example.com\n' > "${fixture}/.env"
  calls="${fixture}/calls.log"
  : > "${calls}"

  # Exercise the real orchestration with mocked external commands, never Docker or production data.
  source "${fixture}/scripts/production-update.sh"

  git() {
    case "$*" in
      *'branch --show-current') printf 'main\n' ;;
      *'rev-parse HEAD') printf '%040d\n' 1 ;;
    esac
  }

  docker() {
    printf 'docker' >> "${calls}"
    printf ' <%s>' "$@" >> "${calls}"
    printf '\n' >> "${calls}"
    if [[ "$1" == info ]]; then
      return
    elif [[ "$1" == inspect ]]; then
      if [[ "$3" == '{{.State.Status}}' || "$4" == container-cloudflared ]]; then
        printf 'running\n'
      else
        printf 'healthy\n'
      fi
      return
    fi
    [[ "$1" == compose && "$2" == --env-file ]] || return 1
    shift 3
    case "$1" in
      ps)
        [[ "${2:-}" != -q ]] || printf 'container-%s\n' "$3"
        ;;
      pull)
        [[ "${scenario}" != pull-failure ]] || return 1
        ;;
      up)
        if [[ " $* " == *' cloudflared '* ]]; then
          [[ "${scenario}" != switch-failure ]] || return 1
          touch "${fixture}/tunnel-updated"
        fi
        ;;
      exec)
        case "$*" in
          *'du -sk'*) printf '1\n' ;;
          *'pg_dump'*) printf 'test-only-database-backup\n' ;;
          *'tar -czf'*) tar -czf - --files-from /dev/null ;;
          *'schema apply --dry-run'*)
            [[ "${scenario}" != schema-failure ]] || return 1
            printf 'No schema changes\n'
            ;;
          *'cloudflared --version')
            [[ -f "${fixture}/tunnel-updated" ]] || return 1
            printf 'cloudflared version test-updated\n'
            ;;
        esac
        ;;
    esac
  }

  curl() { printf 'curl-check\n' >> "${calls}"; }
  confirm_schema_apply() {
    printf 'schema-approval\n' >> "${calls}"
    [[ "${scenario}" != declined ]] || die 'Schema application was not approved.'
  }

  case "${scenario}" in
    preflight) main --preflight ;;
    backup) main --backup-only ;;
    dry-run) main --dry-run ;;
    *) main ;;
  esac
)

for scenario in update preflight backup dry-run declined pull-failure schema-failure switch-failure; do
  set +e
  run_update "${scenario}" > "${test_root}/${scenario}.log" 2>&1
  status=$?
  set -e
  calls="${test_root}/${scenario}/calls.log"
  case "${scenario}" in
    update|preflight|backup|dry-run)
      if (( status != 0 )); then
        cat "${test_root}/${scenario}.log" >&2
        fail "${scenario} failed with status ${status}"
      fi
      ;;
    *) (( status != 0 )) || fail "${scenario} unexpectedly succeeded" ;;
  esac

  if [[ "${scenario}" == preflight || "${scenario}" == backup ]]; then
    assert_absent "${calls}" '<pull>'
    assert_absent "${calls}" '<build>'
  else
    assert_contains "${calls}" '<pull> <gateway> <map-static> <cloudflared>'
  fi

  if [[ "${scenario}" == update ]]; then
    assert_contains "${calls}" '<up> <-d> <--no-deps> <--wait> <--wait-timeout> <180> <gateway> <map-static> <cloudflared>'
    assert_contains "${calls}" '<exec> <-T> <cloudflared> <cloudflared> <--version>'
    assert_contains "${calls}" 'curl-check'
    [[ -f "${test_root}/${scenario}/tunnel-updated" ]] || fail 'Old tunnel container was left running'
    approval_line="$(grep -n '^schema-approval$' "${calls}" | cut -d: -f1)"
    switch_line="$(grep -n '<up>.*<gateway> <map-static> <cloudflared>' "${calls}" | cut -d: -f1)"
    (( approval_line < switch_line )) || fail 'Tunnel switched before schema approval'
  elif [[ "${scenario}" == switch-failure ]]; then
    assert_absent "${calls}" 'curl-check'
  else
    assert_absent "${calls}" '<up>'
    assert_absent "${calls}" '<schema> <apply> <--yes>'
  fi
  [[ ! -d "${test_root}/${scenario}/.production-update.lock" ]] || fail 'Update lock was not released'
  printf 'Production update scenario passed: %s\n' "${scenario}"
done
