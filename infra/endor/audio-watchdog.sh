#!/bin/sh
set -eu

sink_name=${ELSEWHERE_AUDIO_SINK:-elsewhere}
quiet_threshold=${ELSEWHERE_AUDIO_QUIET_SECONDS:-8}
audible_peak_db=${ELSEWHERE_AUDIO_AUDIBLE_PEAK_DB:--45}
quiet_seconds=0

chromium_input_index() {
  pactl list sink-inputs 2>/dev/null |
    awk '
      /^Sink Input #/ { current = substr($3, 2) }
      /application\.process\.binary = "chromium"/ { print current; exit }
    '
}

chromium_is_audible() {
  input_index=$(chromium_input_index)
  if [ -z "$input_index" ]; then
    return 1
  fi

  peak_db=$(
    timeout 1 \
      parec \
      --monitor-stream="$input_index" \
      --rate=8000 \
      --format=s16le \
      --channels=1 \
      --latency-msec=50 \
      --process-time-msec=50 2>/dev/null |
      ffmpeg \
        -hide_banner \
        -nostats \
        -f s16le \
        -ar 8000 \
        -ac 1 \
        -i pipe:0 \
        -af volumedetect \
        -f null \
        - 2>&1 |
      awk '/max_volume:/ { print $(NF - 1); exit }'
  )
  case "$peak_db" in
    '' | -inf)
      return 1
      ;;
  esac
  awk -v peak="$peak_db" -v threshold="$audible_peak_db" \
    'BEGIN { exit !(peak + 0 > threshold + 0) }'
}

while :; do
  if chromium_is_audible; then
    quiet_seconds=0
    sleep 1
    continue
  fi

  quiet_seconds=$((quiet_seconds + 1))
  if [ "$quiet_seconds" -lt "$quiet_threshold" ]; then
    sleep 1
    continue
  fi

  # Never fill a quiet programme beat with an arbitrary library clip: doing so makes
  # the voice disagree with the active picture. A persistent Chromium sink can be
  # safely unmuted in place; if no sink exists, the permanent low pink-noise bed keeps
  # the encoded audio track alive while the renderer advances to its next segment.
  input_index=$(chromium_input_index)
  if [ -n "$input_index" ]; then
    pactl set-sink-input-mute "$input_index" 0 2>/dev/null || true
    pactl set-sink-input-volume "$input_index" 100% 2>/dev/null || true
  fi
  printf '%s audio quiet for %ss; checked Chromium sink without injecting speech\n' \
    "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$quiet_seconds"
  quiet_seconds=0
  sleep 2
done
