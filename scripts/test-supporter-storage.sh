#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
container_name="pmc-supporter-storage-test-$$"
postgres_image='postgres:17.11-alpine3.24@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24'
directus_image='directus/directus:12.5.0@sha256:7de5d6898b955dab1672619aed590035dcade4f8d7396d913e55543e114d1331'

# Only this script's temporary container is stopped; no project volumes or databases are touched.
docker run --detach --rm --name "$container_name" --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_PASSWORD=supporter-test-only -e POSTGRES_DB=supporter_test "$postgres_image" >/dev/null
trap 'docker stop "$container_name" >/dev/null 2>&1 || true' EXIT HUP INT TERM
attempt=0
until docker exec "$container_name" pg_isready -h 127.0.0.1 -U postgres -d supporter_test >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 30 ] || { echo "Temporary Postgres did not become ready" >&2; exit 1; }
  sleep 1
done
docker run --rm --network "container:$container_name" \
  --mount "type=bind,source=$project_dir/directus,target=/workspace/directus,readonly" \
  -e DB_HOST=127.0.0.1 -e DB_DATABASE=supporter_test --entrypoint node "$directus_image" \
  /workspace/directus/extensions/directus-extension-pmc-website/scripts/test-supporter-storage.mjs
