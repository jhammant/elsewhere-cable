#!/bin/sh
set -eu

sink_name=${ELSEWHERE_AUDIO_SINK:-elsewhere}
quiet_threshold=${ELSEWHERE_AUDIO_QUIET_SECONDS:-2}
audible_peak_db=${ELSEWHERE_AUDIO_AUDIBLE_PEAK_DB:--45}
cursor=${ELSEWHERE_AUDIO_RECOVERY_CURSOR:-1}
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

  audio_list=$(mktemp /tmp/elsewhere-audio-list.XXXXXX)
  find -L /content/current -type f -name 'speech_*.m4a' -mmin -30 -print | sort >"$audio_list"
  if [ ! -s "$audio_list" ]; then
    find -L /content/current -type f -name 'speech_*.m4a' -mmin -240 -print |
      sort >"$audio_list"
  fi
  if [ ! -s "$audio_list" ]; then
    find -L /content/current -type f -name 'speech_*.m4a' -print | sort >"$audio_list"
  fi
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
    if chromium_is_audible; then
      kill "$recovery_pid" 2>/dev/null || true
      break
    fi
    sleep 1
  done
  wait "$recovery_pid" 2>/dev/null || true
  quiet_seconds=$quiet_threshold
done
