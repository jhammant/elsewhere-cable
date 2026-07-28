#!/bin/sh
set -eu

remote_host=${ELSEWHERE_ENDOR_HOST:-endor}
remote_root=${ELSEWHERE_ENDOR_ROOT:-/mnt/tank/apps/elsewhere-cable}

exec ssh -t "$remote_host" \
  "cd '$remote_root/source/repository' && sh infra/scripts/configure-youtube-key.sh"
