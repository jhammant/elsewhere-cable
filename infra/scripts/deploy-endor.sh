#!/bin/sh
set -eu

remote_host=${ELSEWHERE_ENDOR_HOST:-endor}
remote_root=${ELSEWHERE_ENDOR_ROOT:-/mnt/tank/apps/elsewhere-cable}
commit=$(git rev-parse HEAD)

if [ -n "$(git status --short)" ]; then
  echo "Refusing to deploy a dirty worktree. Commit and push first." >&2
  exit 65
fi

ssh "$remote_host" "
  sudo -n install -d -o truenas_admin -g truenas_admin -m 750 \
    '$remote_root' \
    '$remote_root/source' \
    '$remote_root/secrets' \
    '$remote_root/recordings'
  if [ ! -e '$remote_root/secrets/youtube-stream-key' ]; then
    install -m 600 /dev/null '$remote_root/secrets/youtube-stream-key'
  fi
"

if ! ssh "$remote_host" "test -d '$remote_root/source/repository/.git'"; then
  ssh "$remote_host" \
    "git clone https://github.com/jhammant/elsewhere-cable.git '$remote_root/source/repository'"
fi

ssh "$remote_host" "
  cd '$remote_root/source/repository'
  git fetch origin
  git checkout --detach '$commit'
  docker compose -f infra/endor/compose.yaml build
  ELSEWHERE_OUTPUT_MODE=record docker compose -f infra/endor/compose.yaml up -d
"
