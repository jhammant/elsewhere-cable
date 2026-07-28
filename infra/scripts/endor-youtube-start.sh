#!/bin/sh
set -eu

remote_host=${ELSEWHERE_ENDOR_HOST:-endor}
remote_root=${ELSEWHERE_ENDOR_ROOT:-/mnt/tank/apps/elsewhere-cable}

if ! ssh "$remote_host" "test -s '$remote_root/secrets/youtube-stream-key'"; then
  echo "YouTube stream key is missing. Run: pnpm endor:youtube:key" >&2
  exit 66
fi

ssh "$remote_host" "
  cd '$remote_root/source/repository'
  ELSEWHERE_OUTPUT_MODE=youtube \
    docker compose -f infra/endor/compose.yaml up -d --force-recreate broadcast
"

echo "Endor is uploading to YouTube. Check the preview and stream health in Live Control Room."
