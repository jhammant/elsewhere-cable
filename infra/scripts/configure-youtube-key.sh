#!/bin/sh
set -eu

remote_root=${ELSEWHERE_ENDOR_ROOT:-/mnt/tank/apps/elsewhere-cable}
secret_directory=$remote_root/secrets
secret_file=$secret_directory/youtube-stream-key

if [ ! -t 0 ]; then
  echo "This command needs an interactive terminal so the key is not echoed." >&2
  exit 64
fi
if [ ! -d "$secret_directory" ]; then
  echo "Endor has not been deployed yet: $secret_directory is missing." >&2
  exit 66
fi

printf 'Paste the YouTube stream key (input hidden): ' >&2
original_stty=$(stty -g)
trap 'stty "$original_stty"' EXIT INT TERM
stty -echo
IFS= read -r stream_key
stty "$original_stty"
trap - EXIT INT TERM
printf '\n' >&2

if [ "${#stream_key}" -lt 12 ]; then
  unset stream_key
  echo "The value was too short to be a YouTube stream key; nothing changed." >&2
  exit 65
fi

umask 027
temporary_secret=$(mktemp "$secret_directory/.youtube-stream-key.XXXXXX")
trap 'rm -f "$temporary_secret"' EXIT INT TERM
printf '%s' "$stream_key" >"$temporary_secret"
unset stream_key
chmod 640 "$temporary_secret"
mv "$temporary_secret" "$secret_file"
trap - EXIT INT TERM

echo "YouTube stream key stored on Endor with mode 640."
