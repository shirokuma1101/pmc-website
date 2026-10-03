#!/usr/bin/env bash
set -Eeuo pipefail

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
test_directory="$(mktemp -d)"
trap 'rm -rf -- "$test_directory"' EXIT
mkdir -p "$test_directory/world" "$test_directory/assets" "$test_directory/NAS output"
touch "$test_directory/world/level.dat" "$test_directory/assets/bluemap-embed.js" "$test_directory/assets/bluemap-embed.css"
cat > "$test_directory/java" <<'EOF'
#!/usr/bin/env bash
set -eu
render=false
while (($#)); do
  case "$1" in
    -c) config="$2"; shift 2 ;;
    -r) render=true; shift ;;
    *) shift ;;
  esac
done
if [[ "$render" == false ]]; then
  mkdir -p "$config"
  touch "$config/core.conf" "$config/webapp.conf" "$config/webserver.conf"
  exit 1
fi
webroot="$(sed -n 's/^webroot: "\(.*\)"$/\1/p' "$config/webapp.conf")"
storage="$(sed -n 's/^root: "\(.*\)"$/\1/p' "$config/storages/file.conf")"
[[ "$storage" == "$webroot/maps" ]]
mkdir -p "$storage/world"
printf '{}\n' > "$webroot/settings.json"
printf '<html></html>\n' > "$webroot/index.html"
printf 'model\n' > "$storage/world/model.json.gz"
EOF
chmod +x "$test_directory/java"
# Substitute only runtime executable/asset locations; exercise the real config writer.
sed -e "s|/opt/java25/bin/java|$test_directory/java|g" \
  -e "s|/usr/local/share/bluemap|$test_directory/assets|g" \
  "$script_directory/generator/render-bluemap.sh" > "$test_directory/render-bluemap.sh"
BLUEMAP_ACCEPT_DOWNLOAD=true bash "$test_directory/render-bluemap.sh" \
  "$test_directory/world" "$test_directory/NAS output/bluemap" "$test_directory/work/bluemap"
[[ -f "$test_directory/NAS output/bluemap/maps/world/model.json.gz" ]]
[[ -f "$test_directory/work/bluemap/config/core.conf" ]]
[[ ! -d "$test_directory/NAS output/config" ]]
[[ -z "$(find "$test_directory/work" -name '*.gz' -print)" ]]
echo 'PASS: BlueMap CLI config/cache stay local while web output uses external storage'
