#!/bin/sh
set -eu

remote_host=${ELSEWHERE_ENDOR_HOST:-endor}
remote_root=${ELSEWHERE_ENDOR_ROOT:-/mnt/tank/apps/elsewhere-cable}

ssh "$remote_host" "
  cd '$remote_root/source/repository'
  docker compose -f infra/endor/compose.yaml stop broadcast
"

echo "Endor's YouTube upload is stopped."
