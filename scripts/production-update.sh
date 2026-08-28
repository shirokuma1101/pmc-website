#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly ENV_FILE="${PROJECT_DIR}/.env"
readonly BACKUP_DIR="${PROJECT_DIR}/backups"
readonly LOCK_DIR="${PROJECT_DIR}/.production-update.lock"
readonly TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
readonly STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
readonly LOG_FILE="${BACKUP_DIR}/update-${TIMESTAMP}.log"
readonly MIN_FREE_KB="${PRODUCTION_UPDATE_MIN_FREE_KB:-1048576}"
readonly REQUIRED_SERVICES=(database directus frontend cloudflared)
readonly COMPOSE=(docker compose --env-file "${ENV_FILE}")

MODE="update"
LOCK_ACQUIRED=false

usage() {
  cat <<'USAGE'
Usage: ./scripts/production-update.sh [MODE]

Modes:
  --preflight     Run production readiness checks only.
  --backup-only   Run readiness checks and create backups only.
  --dry-run       Back up, update main, build, and stop after the schema dry-run.
  --help          Show this help.

With no mode, the script performs the full interactive production update.
Schema application always requires entering APPLY at the prompt.
USAGE
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

log() {
  printf '[%s] %s\n' "$(date +%Y-%m-%dT%H:%M:%S%z)" "$*"
}

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  if [[ "${LOCK_ACQUIRED}" == true ]]; then
    rm -f -- "${LOCK_DIR}/pid"
    rmdir -- "${LOCK_DIR}" 2>/dev/null || true
  fi
  if (( status == 0 )); then
    log "Completed mode=${MODE}"
  else
    log "Failed mode=${MODE} exit=${status}"
  fi
  exit "${status}"
}

parse_arguments() {
  if (( $# > 1 )); then
    usage
    exit 2
  fi
  case "${1:-}" in
    "") MODE="update" ;;
    --preflight) MODE="preflight" ;;
    --backup-only) MODE="backup" ;;
    --dry-run) MODE="dry-run" ;;
    --help|-h) usage; exit 0 ;;
    *) usage; die "Unknown mode: $1" ;;
  esac
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command is not available: $1"
}

acquire_lock() {
  if ! mkdir -- "${LOCK_DIR}" 2>/dev/null; then
    local owner="unknown"
    if [[ -r "${LOCK_DIR}/pid" ]]; then
      owner="$(<"${LOCK_DIR}/pid")"
    fi
    die "Another production update may be running (pid=${owner})."
  fi
  LOCK_ACQUIRED=true
  printf '%s\n' "$$" > "${LOCK_DIR}/pid"
}

read_env_value() {
  local key="$1"
  local value
  value="$(sed -n "s/^${key}=//p" "${ENV_FILE}" | tail -n 1)"
  value="${value%$'\r'}"
  value="${value#\"}"
  value="${value%\"}"
  printf '%s' "${value}"
}

service_container_id() {
  "${COMPOSE[@]}" ps -q "$1"
}

service_state() {
  local container_id
  container_id="$(service_container_id "$1")"
  [[ -n "${container_id}" ]] || {
    printf 'missing'
    return
  }
  docker inspect --format '{{.State.Status}}' "${container_id}"
}

service_health() {
  local container_id
  container_id="$(service_container_id "$1")"
  [[ -n "${container_id}" ]] || {
    printf 'missing'
    return
  }
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}"
}

require_service_running() {
  local service="$1"
  local state
  state="$(service_state "${service}")"
  [[ "${state}" == "running" ]] || die "Service ${service} is not running (state=${state})."
}

directory_size_kb() {
  local service="$1"
  local path="$2"
  "${COMPOSE[@]}" exec -T "${service}" sh -c "du -sk '${path}' | cut -f1"
}

preflight() {
  log "Running preflight checks"
  require_command git
  require_command docker
  require_command curl
  require_command tar
  [[ -r "${ENV_FILE}" ]] || die "Production environment file is missing or unreadable: ${ENV_FILE}"
  [[ "$(git -C "${PROJECT_DIR}" branch --show-current)" == "main" ]] || die "Production updates must run from main."
  [[ -z "$(git -C "${PROJECT_DIR}" status --porcelain)" ]] || die "Git working tree is not clean."
  docker info >/dev/null
  "${COMPOSE[@]}" config --quiet

  local service
  for service in "${REQUIRED_SERVICES[@]}"; do
    require_service_running "${service}"
    log "Service ${service}: state=running health=$(service_health "${service}")"
  done

  local db_size_kb uploads_size_kb estimated_kb available_kb
  db_size_kb="$(directory_size_kb database /var/lib/postgresql/data)"
  uploads_size_kb="$(directory_size_kb directus /directus/uploads)"
  [[ "${db_size_kb}" =~ ^[0-9]+$ ]] || die "Could not determine PostgreSQL data size."
  [[ "${uploads_size_kb}" =~ ^[0-9]+$ ]] || die "Could not determine Directus uploads size."
  estimated_kb=$((db_size_kb + uploads_size_kb + MIN_FREE_KB))
  available_kb="$(df -Pk "${PROJECT_DIR}" | awk 'NR == 2 { print $4 }')"
  [[ "${available_kb}" =~ ^[0-9]+$ ]] || die "Could not determine available disk space."
  log "Disk space: database=${db_size_kb}KB uploads=${uploads_size_kb}KB available=${available_kb}KB required=${estimated_kb}KB"
  (( available_kb >= estimated_kb )) || die "Insufficient disk space for backups and image build."
  log "Preflight checks passed"
}

create_backups() {
  local database_backup="${BACKUP_DIR}/database-${TIMESTAMP}.dump"
  local uploads_backup="${BACKUP_DIR}/uploads-${TIMESTAMP}.tar.gz"
  local env_backup="${BACKUP_DIR}/env-${TIMESTAMP}"
  local release_file="${BACKUP_DIR}/release-${TIMESTAMP}.txt"

  log "Creating PostgreSQL backup: ${database_backup}"
  "${COMPOSE[@]}" exec -T database \
    pg_dump -U pmc_website -d pmc_website -Fc > "${database_backup}"
  [[ -s "${database_backup}" ]] || die "PostgreSQL backup is empty."

  log "Creating Directus uploads backup: ${uploads_backup}"
  "${COMPOSE[@]}" exec -T directus \
    tar -czf - -C /directus/uploads . > "${uploads_backup}"
  [[ -s "${uploads_backup}" ]] || die "Directus uploads backup is empty."
  tar -tzf "${uploads_backup}" >/dev/null

  log "Backing up production environment file"
  cp -- "${ENV_FILE}" "${env_backup}"
  chmod 600 "${env_backup}"
  [[ -s "${env_backup}" ]] || die "Environment backup is empty."

  git -C "${PROJECT_DIR}" rev-parse HEAD > "${release_file}"
  chmod 600 "${release_file}"
  [[ -s "${release_file}" ]] || die "Release record is empty."

  log "Backup complete"
  log "Database backup: ${database_backup}"
  log "Uploads backup: ${uploads_backup}"
  log "Environment backup: ${env_backup}"
  log "Previous release: $(<"${release_file}")"
}

update_source() {
  log "Fetching origin/main"
  git -C "${PROJECT_DIR}" fetch origin main
  git -C "${PROJECT_DIR}" pull --ff-only origin main
  # Files checked out while the script-wide umask is 077 may otherwise be
  # unreadable by the non-root Directus user through the read-only bind mount.
  chmod -R a+rX \
    "${PROJECT_DIR}/directus/extensions" \
    "${PROJECT_DIR}/directus/schema"
  chmod a+r "${PROJECT_DIR}/directus/bootstrap.mjs"
  local target_file="${BACKUP_DIR}/target-${TIMESTAMP}.txt"
  git -C "${PROJECT_DIR}" rev-parse HEAD > "${target_file}"
  chmod 600 "${target_file}"
  log "Target release: $(<"${target_file}")"
  "${COMPOSE[@]}" config --quiet
}

build_and_validate() {
  log "Building Frontend image"
  "${COMPOSE[@]}" build frontend
  log "Validating Directus extension"
  "${COMPOSE[@]}" exec -T directus \
    node --check /directus/extensions/directus-extension-pmc-website/dist/index.js
}

schema_dry_run() {
  local output_file="${BACKUP_DIR}/schema-dry-run-${TIMESTAMP}.log"
  log "Running Directus schema dry-run"
  if ! "${COMPOSE[@]}" exec -T directus \
    node cli.js schema apply --dry-run /directus/schema/snapshot.yaml \
    > "${output_file}" 2>&1; then
    cat -- "${output_file}"
    die "Directus schema dry-run failed."
  fi
  cat -- "${output_file}"
  log "Schema dry-run output: ${output_file}"
}

confirm_schema_apply() {
  [[ -r /dev/tty && -w /dev/tty ]] || die "Interactive terminal is required for schema approval."
  printf '\nReview the schema dry-run above. Type APPLY to continue: ' > /dev/tty
  local answer
  IFS= read -r answer < /dev/tty
  [[ "${answer}" == "APPLY" ]] || die "Schema application was not approved."
}

apply_schema_and_bootstrap() {
  log "Applying Directus schema"
  "${COMPOSE[@]}" exec -T directus \
    node cli.js schema apply --yes /directus/schema/snapshot.yaml

  log "Recreating Directus with the current Compose configuration"
  "${COMPOSE[@]}" up -d --no-deps --force-recreate --wait --wait-timeout 180 directus
  [[ "$(service_health directus)" == "healthy" ]] || die "Directus did not become healthy."

  log "Applying production roles, policies, and upload folders"
  "${COMPOSE[@]}" --profile tools run --rm --no-deps bootstrap
}

switch_frontend() {
  log "Switching Frontend to the prebuilt image"
  "${COMPOSE[@]}" up -d --no-deps --wait --wait-timeout 180 frontend
  [[ "$(service_health frontend)" == "healthy" ]] || die "Frontend did not become healthy."
}

check_url() {
  local name="$1"
  local url="$2"
  local attempt
  for attempt in {1..12}; do
    if curl --fail --silent --show-error --max-time 15 --output /dev/null "${url}"; then
      log "HTTP check passed: ${name} ${url}"
      return
    fi
    sleep 5
  done
  die "HTTP check failed: ${name} ${url}"
}

post_update_checks() {
  log "Running post-update checks"
  "${COMPOSE[@]}" ps

  local service
  for service in "${REQUIRED_SERVICES[@]}"; do
    require_service_running "${service}"
    local health
    health="$(service_health "${service}")"
    [[ "${health}" == "healthy" || "${health}" == "running" ]] || die "Service ${service} is not healthy (health=${health})."
    log "Service ${service}: state=running health=${health}"
  done

  local app_url directus_url
  app_url="$(read_env_value NEXT_PUBLIC_APP_URL)"
  directus_url="$(read_env_value NEXT_PUBLIC_DIRECTUS_URL)"
  [[ "${app_url}" == https://* ]] || die "NEXT_PUBLIC_APP_URL must be an HTTPS URL."
  [[ "${directus_url}" == https://* ]] || die "NEXT_PUBLIC_DIRECTUS_URL must be an HTTPS URL."
  check_url frontend "${app_url}/login"
  check_url directus "${directus_url}/server/ping"

  local recent_logs="${BACKUP_DIR}/service-logs-${TIMESTAMP}.log"
  "${COMPOSE[@]}" logs --no-color --since "${STARTED_AT}" frontend directus > "${recent_logs}"
  if grep -Ein '(^|[^[:alnum:]_])(error|fatal|panic|unhandled|uncaught)([^[:alnum:]_]|$)' "${recent_logs}"; then
    die "Errors were found in recent service logs: ${recent_logs}"
  fi
  log "Post-update checks passed"
  log "Service logs: ${recent_logs}"
}

main() {
  parse_arguments "$@"
  cd -- "${PROJECT_DIR}"
  mkdir -p -- "${BACKUP_DIR}"
  chmod 700 "${BACKUP_DIR}"
  acquire_lock
  trap cleanup EXIT INT TERM
  exec > >(tee -a "${LOG_FILE}") 2>&1

  log "Starting production operation mode=${MODE} user=$(id -un)"
  preflight
  [[ "${MODE}" == "preflight" ]] && return

  create_backups
  [[ "${MODE}" == "backup" ]] && return

  update_source
  build_and_validate
  schema_dry_run
  [[ "${MODE}" == "dry-run" ]] && return

  confirm_schema_apply
  apply_schema_and_bootstrap
  switch_frontend
  post_update_checks
}

main "$@"
