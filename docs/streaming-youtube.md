# YouTube streaming from Endor

Endor renders Elsewhere Cable in a private Chromium/Xvfb display, captures programme audio through
a private PulseAudio null sink, encodes 1280×720 at 25 fps, and sends one encrypted RTMPS upload to
YouTube. It never captures the desktop, microphone or camera.

## Safety defaults

- The stack starts in `record` mode, not live mode.
- The HTTP preview binds only to Endor's loopback interface.
- The container has a 3 GiB memory limit and eight-CPU limit.
- The stream key is a protected Endor file and is never committed or placed in Compose environment
  variables.
- Logs rotate at 10 MiB and retain three files.
- Prepared content is published through an atomic `current` symlink, so a partial transfer cannot
  reach playout.

## Deploy a local recording test

From Ghost:

```bash
pnpm endor:sync
pnpm endor:deploy
pnpm endor:status
```

The test recording appears at:

```text
/mnt/tank/apps/elsewhere-cable/recordings/elsewhere-test.mkv
```

Inspect at least two channel changes, dialogue audio, subtitle timing, renderer FPS, container
memory and dropped-frame count before enabling YouTube.

## Add the YouTube stream key

In YouTube Studio, create an **unlisted** encoder stream and select its RTMPS URL. YouTube can take
up to 24 hours to enable live streaming for a channel the first time.

Do not paste the stream key into chat. Place it on Endor through an interactive SSH session:

```bash
ssh endor
read -rs STREAM_KEY
printf '%s' "$STREAM_KEY" > /mnt/tank/apps/elsewhere-cable/secrets/youtube-stream-key
unset STREAM_KEY
chmod 600 /mnt/tank/apps/elsewhere-cable/secrets/youtube-stream-key
```

## Start the unlisted broadcast

On Endor:

```bash
cd /mnt/tank/apps/elsewhere-cable/source/repository
ELSEWHERE_OUTPUT_MODE=youtube docker compose -f infra/endor/compose.yaml up -d --force-recreate
docker logs -f --tail 80 elsewhere-cable
```

Wait for YouTube Live Control Room to show a healthy preview, then click **Go live**. Keep the first
test unlisted.

## Stop safely

```bash
cd /mnt/tank/apps/elsewhere-cable/source/repository
docker compose -f infra/endor/compose.yaml stop broadcast
```

End the broadcast in YouTube Live Control Room as well.

## Encoder profile

```text
1280×720
25 fps
H.264 high profile
4 Mbps target, 5 Mbps maximum
2-second / 50-frame GOP
AAC stereo, 48 kHz, 160 kbps
RTMPS
```

The container prefers `h264_vaapi` through `/dev/dri/renderD128` and falls back to
`libx264 -preset veryfast -tune zerolatency` if VA-API is unavailable.
