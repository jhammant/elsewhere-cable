#!/bin/sh
set -eu

controller_pid=''
display_pid=''
browser_pid=''
bed_pid=''
watchdog_pid=''

cleanup() {
  for pid in "$watchdog_pid" "$bed_pid" "$browser_pid" "$controller_pid" "$display_pid"; do
    if [ -n "$pid" ]; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  pulseaudio --kill 2>/dev/null || true
}
trap cleanup EXIT INT TERM

set -- $(node /usr/local/bin/elsewhere-chromium-handover launch-settings)
chromium_profile=$1
chromium_debug_port=$2
chromium_slot=$3

mkdir -p "$XDG_RUNTIME_DIR" "$chromium_profile" /recordings
chmod 0700 "$XDG_RUNTIME_DIR"

# This profile is private to the broadcast container. Chromium leaves its
# singleton links behind when Docker force-recreates the container, while the
# next container has a different hostname and rejects those links as a foreign
# active profile. No Chromium process exists at this point, so remove only the
# three profile-local singleton artefacts before launching it.
rm -f \
  "$chromium_profile/SingletonLock" \
  "$chromium_profile/SingletonCookie" \
  "$chromium_profile/SingletonSocket"

# A failed encoder start can leave Xvfb's lock files in the container's
# writable layer. Removing only this private display's files makes restarts
# deterministic without touching any host display.
rm -f /tmp/.X99-lock /tmp/.X11-unix/X99

Xvfb "$DISPLAY" -screen 0 1280x720x24 -nolisten tcp -ac &
display_pid=$!

pulseaudio --daemonize=yes --exit-idle-time=-1 --log-target=file:/tmp/pulseaudio.log
for attempt in 1 2 3 4 5; do
  : "$attempt"
  if pactl info >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
pactl load-module module-null-sink \
  sink_name=elsewhere \
  sink_properties=device.description=ElsewhereCable >/dev/null
pactl set-default-sink elsewhere

ffmpeg \
  -hide_banner \
  -loglevel error \
  -nostdin \
  -re \
  -f lavfi \
  -i 'anoisesrc=color=pink:amplitude=0.002:sample_rate=44100' \
  -ac 2 \
  -f pulse \
  elsewhere >/tmp/elsewhere-bed.log 2>&1 &
bed_pid=$!

pnpm --filter @elsewhere-cable/playout-controller start &
controller_pid=$!

for attempt in $(seq 1 60); do
  : "$attempt"
  if curl -fsS "http://127.0.0.1:${ELSEWHERE_PORT}/health/ready" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$controller_pid" 2>/dev/null; then
    echo "Playout controller exited before becoming ready" >&2
    exit 1
  fi
  sleep 1
done

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
  --remote-debugging-port="$chromium_debug_port" \
  --remote-allow-origins='*' \
  --user-data-dir="$chromium_profile" \
  --window-position=0,0 \
  --window-size=1280,720 \
  --kiosk \
  "http://127.0.0.1:${ELSEWHERE_PORT}/?broadcast=1" &
browser_pid=$!
node /usr/local/bin/elsewhere-chromium-handover \
  record-active "$chromium_slot" container-start >/tmp/elsewhere-renderer-active.json

ELSEWHERE_AUDIO_QUIET_SECONDS=${ELSEWHERE_AUDIO_QUIET_SECONDS:-2} \
  sh /usr/local/bin/elsewhere-audio-watchdog >/tmp/elsewhere-audio-watchdog.log 2>&1 &
watchdog_pid=$!

sleep 8

set -- \
  -hide_banner \
  -loglevel info \
  -f x11grab \
  -draw_mouse 0 \
  -framerate 25 \
  -video_size 1280x720 \
  -i "${DISPLAY}.0" \
  -f pulse \
  -thread_queue_size 2048 \
  -i elsewhere.monitor

if [ -e /dev/dri/renderD128 ] \
  && vainfo --display drm --device /dev/dri/renderD128 >/tmp/vainfo.log 2>&1 \
  && ffmpeg -hide_banner -encoders 2>/dev/null | grep -q h264_vaapi; then
  set -- "$@" \
    -vaapi_device /dev/dri/renderD128 \
    -vf format=nv12,hwupload \
    -c:v h264_vaapi \
    -profile:v high
else
  set -- "$@" \
    -c:v libx264 \
    -preset veryfast \
    -tune zerolatency \
    -profile:v high \
    -pix_fmt yuv420p
fi

set -- "$@" \
  -r 25 \
  -g 50 \
  -keyint_min 50 \
  -sc_threshold 0 \
  -b:v 1600k \
  -maxrate 1800k \
  -bufsize 3200k \
  -c:a aac \
  -ar 48000 \
  -ac 2 \
  -b:a 96k

case "${ELSEWHERE_OUTPUT_MODE}" in
  record)
    exec ffmpeg "$@" -f matroska -y "$ELSEWHERE_RECORDING_PATH"
    ;;
  youtube)
    if [ ! -r "$ELSEWHERE_STREAM_KEY_FILE" ]; then
      echo "YouTube stream key file is missing or unreadable" >&2
      exit 78
    fi
    stream_key=$(tr -d '\r\n' <"$ELSEWHERE_STREAM_KEY_FILE")
    if [ -z "$stream_key" ]; then
      echo "YouTube stream key file is empty" >&2
      exit 78
    fi
    unset stream_key
    exec node /usr/local/bin/elsewhere-youtube-ffmpeg \
      "$ELSEWHERE_STREAM_KEY_FILE" \
      "$ELSEWHERE_STREAM_URL" \
      "$@"
    ;;
  *)
    echo "ELSEWHERE_OUTPUT_MODE must be record or youtube" >&2
    exit 64
    ;;
esac
