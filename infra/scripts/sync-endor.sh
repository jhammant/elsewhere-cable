#!/bin/sh
set -eu

source_directory=${ELSEWHERE_LOCAL_SEGMENTS_DIR:-data/segments-live}
remote_host=${ELSEWHERE_ENDOR_HOST:-endor}
remote_root=${ELSEWHERE_ENDOR_ROOT:-/mnt/tank/apps/elsewhere-cable}

if [ ! -r "$source_directory/manifest.json" ]; then
  echo "Missing readable manifest: $source_directory/manifest.json" >&2
  exit 66
fi

if [ "${ELSEWHERE_ENDOR_EXTENDED_MEDIA:-0}" != "1" ]; then
  pnpm exec tsx infra/scripts/check-endor-content-compatibility.ts \
    --segments "$source_directory"
fi

release_id="$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short HEAD)-$$"
remote_incoming="$remote_root/content/incoming/$release_id"
remote_release="$remote_root/content/releases/$release_id"

ssh "$remote_host" "
  sudo -n install -d -o truenas_admin -g truenas_admin -m 750 \
    '$remote_root' \
    '$remote_root/content' \
    '$remote_root/content/incoming' \
    '$remote_root/content/releases' \
    '$remote_root/recordings' \
    '$remote_root/secrets'
  mkdir -p '$remote_incoming'
"

rsync -a --checksum \
  --link-dest="$remote_root/content/current" \
  "$source_directory/" "$remote_host:$remote_incoming/"

ssh "$remote_host" "python3 - '$remote_incoming/manifest.json' '$remote_incoming' '$remote_release' '$remote_root/content'" <<'PY'
import json
import os
import pathlib
import sys

manifest_path, incoming, release, content_root = sys.argv[1:]
with open(manifest_path, encoding="utf-8") as handle:
    manifest = json.load(handle)
segments = manifest.get("segments")
if not isinstance(segments, list) or not segments:
    raise SystemExit("Refusing to publish an empty Endor manifest")
for entry in segments:
    package_path = entry.get("packagePath")
    if not isinstance(package_path, str):
        raise SystemExit("Manifest entry is missing packagePath")
    if not pathlib.Path(incoming, package_path).is_file():
        raise SystemExit(f"Missing package referenced by manifest: {package_path}")

os.rename(incoming, release)
next_link = pathlib.Path(content_root, ".current-next")
current_link = pathlib.Path(content_root, "current")
try:
    next_link.unlink()
except FileNotFoundError:
    pass
next_link.symlink_to(pathlib.Path("releases", pathlib.Path(release).name))
os.replace(next_link, current_link)
print(json.dumps({
    "published": pathlib.Path(release).name,
    "segmentCount": len(segments),
    "durationMs": manifest.get("totalDurationMs", 0),
}))
PY
