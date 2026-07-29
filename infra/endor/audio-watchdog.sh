#!/bin/sh
set -eu

sink_name=${ELSEWHERE_AUDIO_SINK:-elsewhere}
quiet_threshold=${ELSEWHERE_AUDIO_QUIET_SECONDS:-1}
cursor=${ELSEWHERE_AUDIO_RECOVERY_CURSOR:-1}
quiet_seconds=0

chromium_is_speaking() {
  pactl list sink-inputs 2>/dev/null |
    grep -Eq 'application\.name = "Chromium"|application\.process\.binary = "chromium"'
}

while :; do
  if chromium_is_speaking; then
    quiet_seconds=0
    sleep 1
    continue
  fi

  quiet_seconds=$((quiet_seconds + 1))
  if [ "$quiet_seconds" -lt "$quiet_threshold" ]; then
    sleep 1
    continue
  fi

  audio_list=$(mktemp /tmp/elsewhere-audio-list.XXXXXX)
  find -L /content/current -type f -name 'speech_*.m4a' -print | sort >"$audio_list"
  audio_count=$(wc -l <"$audio_list" | tr -d ' ')
  if [ "$audio_count" -eq 0 ]; then
    sleep 2
    continue
  fi
  cursor=$((cursor % audio_count + 1))
  clip=$(sed -n "${cursor}p" "$audio_list")
  rm -f "$audio_list"

  ffmpeg \
    -hide_banner \
    -loglevel error \
    -nostdin \
    -re \
    -i "$clip" \
    -af 'volume=0.72' \
    -ac 2 \
    -f pulse \
    "$sink_name" &
  recovery_pid=$!

  while kill -0 "$recovery_pid" 2>/dev/null; do
    if chromium_is_speaking; then
      kill "$recovery_pid" 2>/dev/null || true
      break
    fi
    sleep 1
  done
  wait "$recovery_pid" 2>/dev/null || true
  quiet_seconds=0
done
