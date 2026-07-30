#!/bin/sh
set -eu

remote_host=${ELSEWHERE_ENDOR_HOST:-endor}
remote_root=${ELSEWHERE_ENDOR_ROOT:-/mnt/tank/apps/elsewhere-cable}
container=${ELSEWHERE_ENDOR_CONTAINER:-elsewhere-cable}
if [ "${1:-}" = "--" ]; then
  shift
fi
mode=${1:-live}

if [ "$mode" != "live" ] && [ "$mode" != "preflight" ]; then
  echo "Usage: $0 [live|preflight]" >&2
  exit 64
fi

if [ "$mode" = "live" ] && [ -n "$(git status --short)" ]; then
  echo "Refusing a live renderer refresh from a dirty worktree. Commit and push first." >&2
  exit 65
fi

build_id="$(git rev-parse --short HEAD)"
release_id="$(date -u +%Y%m%dT%H%M%SZ)-$build_id"
remote_release="$remote_root/state/renderer-releases/$release_id"

pnpm --filter @elsewhere-cable/renderer build

if [ "$mode" = "preflight" ]; then
  ssh "$remote_host" sh -s -- "$remote_root" "$container" <<'REMOTE'
set -eu
remote_root=$1
container=$2
runtime_state=$(
  docker inspect \
    --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}} restarts={{.RestartCount}}' \
    "$container"
)
case "$runtime_state" in
  'running healthy restarts='*)
    ;;
  *)
    echo "Endor renderer preflight failed: $runtime_state" >&2
    exit 69
    ;;
esac
test -w "$remote_root/state"
docker exec "$container" test -r /app/apps/renderer/dist/index.html
docker exec "$container" test -x /usr/bin/chromium
docker exec "$container" test -x /usr/local/bin/node
printf '{"preflight":"ready","runtime":"%s"}\n' "$runtime_state"
REMOTE
  exit 0
fi

ssh "$remote_host" "
  install -d -m 750 \
    '$remote_root/state' \
    '$remote_root/state/renderer-releases' \
    '$remote_release' \
    '$remote_release/dist'
"

rsync -a --delete apps/renderer/dist/ "$remote_host:$remote_release/dist/"
rsync -a \
  infra/endor/chromium-handover.mjs \
  infra/endor/entrypoint.sh \
  "$remote_host:$remote_release/"

ssh "$remote_host" sh -s -- "$remote_release" "$container" "$build_id" <<'REMOTE'
set -eu

release=$1
container=$2
build_id=$3
helper=/usr/local/bin/elsewhere-chromium-handover
staging="/tmp/elsewhere-renderer-$build_id"
handover_committed=0
bundle_installed=0
new_profile=''
probe_profile=/state/chromium-probe

cleanup() {
  if [ "$handover_committed" -eq 1 ]; then
    return
  fi
  if [ -n "$new_profile" ]; then
    docker exec "$container" node "$helper" terminate-profile "$new_profile" >/dev/null 2>&1 || true
  fi
  docker exec "$container" node "$helper" terminate-profile "$probe_profile" >/dev/null 2>&1 || true
  if [ "$bundle_installed" -eq 1 ]; then
    docker exec -u 0 "$container" node "$helper" rollback-bundle >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT HUP INT TERM

runtime_state=$(
  docker inspect \
    --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}} restarts={{.RestartCount}}' \
    "$container"
)
case "$runtime_state" in
  'running healthy restarts='*)
    ;;
  *)
    echo "Refusing renderer handover because Endor is not healthy: $runtime_state" >&2
    exit 69
    ;;
esac

docker cp "$release/chromium-handover.mjs" "$container:/tmp/elsewhere-chromium-handover.next"
docker exec -u 0 "$container" \
  sh -c 'chmod 0755 /tmp/elsewhere-chromium-handover.next && mv /tmp/elsewhere-chromium-handover.next /usr/local/bin/elsewhere-chromium-handover'
docker cp "$release/entrypoint.sh" "$container:/tmp/elsewhere-entrypoint.next"
docker exec -u 0 "$container" \
  sh -c 'chmod 0755 /tmp/elsewhere-entrypoint.next && mv /tmp/elsewhere-entrypoint.next /usr/local/bin/elsewhere-entrypoint'

next_slot=$(docker exec "$container" node "$helper" next-slot)
old_profile=$(docker exec "$container" node "$helper" active-profile)
case "$next_slot" in
  a)
    new_profile=/state/chromium-a
    debug_port=9222
    ;;
  b)
    new_profile=/state/chromium-b
    debug_port=9223
    ;;
  *)
    echo "Handover helper returned an invalid slot" >&2
    exit 70
    ;;
esac

docker exec "$container" node "$helper" terminate-profile "$new_profile"
docker exec "$container" node "$helper" prepare-profile "$new_profile"
docker exec -u 0 "$container" node "$helper" prepare-staging "$staging"
docker cp "$release/dist/." "$container:$staging/"
docker exec -u 0 "$container" node "$helper" install-bundle "$staging"
bundle_installed=1

# Prove the exact installed bundle in a silent headless Chromium before it is
# allowed to create a visible X11 window.
docker exec "$container" node "$helper" terminate-profile "$probe_profile"
docker exec "$container" node "$helper" prepare-profile "$probe_profile"
docker exec -d \
  -u broadcast \
  "$container" \
  chromium \
  --headless=new \
  --mute-audio \
  --no-sandbox \
  --no-first-run \
  --disable-breakpad \
  --disable-dev-shm-usage \
  --disable-features=TranslateUI \
  --autoplay-policy=no-user-gesture-required \
  --use-gl=angle \
  --use-angle=swiftshader \
  --enable-unsafe-swiftshader \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9224 \
  '--remote-allow-origins=*' \
  --user-data-dir="$probe_profile" \
  "http://127.0.0.1:4174/?broadcast=1&standby=1&handover=$build_id"
docker exec "$container" node "$helper" wait-ready 9224 45000
docker exec "$container" node "$helper" seed-history 9224 /state/playout-observations.ndjson
docker exec "$container" node "$helper" probe-data 9224
docker exec "$container" node "$helper" terminate-profile "$probe_profile"

docker exec "$container" node "$helper" \
  wait-handover-window /state/playout-observations.ndjson 120000

docker exec -d \
  -u broadcast \
  -e DISPLAY=:99 \
  -e XDG_RUNTIME_DIR=/tmp/elsewhere-runtime \
  -e PULSE_RUNTIME_PATH=/tmp/elsewhere-runtime/pulse \
  "$container" \
  chromium \
  --no-sandbox \
  --no-first-run \
  --disable-breakpad \
  --disable-dev-shm-usage \
  --disable-features=TranslateUI \
  --disk-cache-size=104857600 \
  --autoplay-policy=no-user-gesture-required \
  --enable-features=Vulkan \
  --ignore-gpu-blocklist \
  --use-angle=vulkan \
  --use-gl=angle \
  --media-cache-size=104857600 \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port="$debug_port" \
  '--remote-allow-origins=*' \
  --user-data-dir="$new_profile" \
  --window-position=0,0 \
  --window-size=1280,720 \
  --kiosk \
  "http://127.0.0.1:4174/?broadcast=1&standby=1&handover=$build_id"

docker exec "$container" node "$helper" wait-ready "$debug_port" 45000
docker exec "$container" node "$helper" seed-history "$debug_port" /state/playout-observations.ndjson

# Activation loads and validates a real segment while the previous renderer is
# still running behind the standby slate. Only a successful activation permits
# the old Chromium profile to be stopped.
docker exec "$container" node "$helper" activate "$debug_port"
docker exec "$container" node "$helper" terminate-profile "$old_profile"
handover_committed=1
docker exec "$container" node "$helper" record-active "$next_slot" "$build_id"

curl -fsS http://127.0.0.1:4174/health/ready
docker exec "$container" node "$helper" status "$debug_port"
docker inspect \
  --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}} restarts={{.RestartCount}}' \
  "$container"
REMOTE
