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

Do not paste the stream key into chat, a shell command, an environment variable or source control.
Store it through the hidden interactive prompt:

```bash
pnpm endor:youtube:key
```

## Start the unlisted broadcast

From Ghost:

```bash
pnpm endor:youtube:start
pnpm endor:status
```

Wait for YouTube Live Control Room to show a healthy preview, then click **Go live**. Keep the first
test unlisted. The runtime log filter replaces the stream key with `[REDACTED]` if FFmpeg includes
the destination in diagnostics.

## Stop safely

```bash
pnpm endor:youtube:stop
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

## Verified Endor result

The 28 July 2026 acceptance recording ran for 2 minutes 21 seconds with:

- Radeon `h264_vaapi` at 1280×720 and 25 fps.
- AAC stereo at 48 kHz; mean audio level -19.2 dB and peak -1.5 dB.
- Approximately 2.4–5.9 CPU cores during steady mixed 2D/3D playout.
- Approximately 865 MiB RAM, within the 3 GiB hard container limit.
- No dropped output frames after the one-frame capture startup adjustment.
