# Endor CPU burn — 9 August 2026

Elsewhere Cable was stopped on `endor` after it was found consuming ~4.5 cores
continuously for **2 days 21 hours**. This records what was measured, what caused
it, and what to prove before it runs unattended there again.

The container was stopped, not removed. Nothing was deleted.

## What was measured

`endor` load average sat at **13.6** on a 24-core box. `docker stats` attributed
**269%** to `elsewhere-cable`; every other workload was under 12%.

Inside the container, three processes had been running since startup:

```text
%CPU     ELAPSED  COMMAND
446   2-21:11:26  chromium --type=gpu-process --use-angle=vulkan
                           --enable-gpu-rasterization --ozone-platform=x11
19.1  2-21:11:19  ffmpeg -f x11grab -framerate 25 -video_size 1280x720 -i :99.0
3.3   2-21:11:28  Xvfb :99 -screen 0 1280x720x24
```

The **Chromium GPU process** was the cost — 446% on its own. `ffmpeg` and `Xvfb`
were close to what you would expect for 720p25 capture.

Throughout, the container reported `healthy` and served `/segments/seg_recovery_*`
with HTTP 206. The health check passes while the renderer burns, so nothing
surfaced this.

Stopping the container took host load from **13.6 → 7.98** within three minutes,
and CPU to **82% idle**. No orphaned `chromium` or `ffmpeg` processes were left.

## Cause

A GPU process consuming 4.5 cores is not doing GPU work — it is rendering in
software. `entrypoint.sh` launches Chromium with:

```text
--enable-features=Vulkan
--ignore-gpu-blocklist
--use-angle=vulkan
--use-gl=angle
```

If a working Vulkan context is unavailable inside the container, ANGLE silently
falls back to a software rasteriser. `--ignore-gpu-blocklist` makes this more
likely to be reached rather than refused. The result is a renderer that appears to
start correctly and produces correct output, at roughly two orders of magnitude
more CPU than intended — and no error anywhere.

**The encoder path already handles this correctly and is not implicated.**
`entrypoint.sh` probes before committing:

```sh
if [ -e /dev/dri/renderD128 ] \
  && vainfo --display drm --device /dev/dri/renderD128 >/tmp/vainfo.log 2>&1 \
  && ffmpeg -hide_banner -encoders 2>/dev/null | grep -q h264_vaapi; then
  # h264_vaapi
else
  # libx264 veryfast
fi
```

That guard is the pattern the renderer is missing: **verify the acceleration path
works, then choose.** The renderer asserts Vulkan and hopes.

## The GPU on endor is fine — this is a Chromium/Vulkan problem

This matters, because the obvious conclusion ("the 890M can't be used from a
container") is wrong.

On the same host, on the same day, on the same device, Plex Media Server
successfully initialised VA-API hardware transcoding:

```text
Codecs: hardware transcoding: testing API vaapi for device
        '/dev/dri/renderD128' (AMD Strix [Radeon 880M / 890M])
Codecs: testing h264_vaapi (encoder)
[FFMPEG] - Using nv12 as format of reconstructed frames.
Codecs: testing h264 (decoder) with hwdevice vaapi
```

No failure or fallback lines. Permissions check out: `/dev/dri/renderD128` is
`root:render(107)` mode `660`, and Plex's runtime user holds groups `44` and `107`
with confirmed read/write.

So: **`/dev/dri` passthrough works, VA-API works, the 890M encodes.** The failure
is specific to Chromium's Vulkan/ANGLE path, not to GPU access on endor.

Elsewhere Cable's compose grants `/dev/dri` and `group_add: ['44','107','950']`,
which is a superset of what Plex uses — so device access is very unlikely to be
the blocker either.

## This was predicted

[`endor-capability-report.md`](./endor-capability-report.md) (28 July 2026) called
it, and the caveats were never discharged:

> Endor should launch Elsewhere Cable at **Minimal profile**, with a path to
> Standard **after its renderer, VA-API encoder and sustained upload tests pass
> directly on the NAS**.

> **Endor GPU access still needs direct proof.**

> Still required on Endor: `pnpm diagnose`, renderer benchmark, encoder benchmark,
> local-runtime inventory and sustained upload test.

The renderer benchmark on endor is the specific test that would have caught this.
The report's judgement was sound; it ran ahead of its own evidence.

## Before running it on endor again

1. **Prove the renderer's GPU path, don't assert it.** Mirror the encoder's guard:
   probe for a working Vulkan/GL context at startup and log which path was chosen.
   A one-line "renderer: hardware" / "renderer: SOFTWARE FALLBACK" makes this
   visible forever after.
2. **Fail loudly on fallback.** Software rasterisation at 720p25 is not a viable
   degraded mode here — it costs ~4.5 cores. Refusing to start beats running
   expensively and silently.
3. **Consider dropping `--ignore-gpu-blocklist`.** It converts "Chromium declined
   this GPU" into "Chromium tried and fell back to software", turning a clear
   failure into an expensive silent one.
4. **Put renderer CPU in the health check.** The container reported `healthy` for
   almost three days while saturating the host. A GPU process sustained above
   ~150% is a failure signal, not a healthy one.
5. **Cap it.** `compose.yaml` sets `cpus: 8`, so this stayed within its limit while
   still dominating a shared box. On a host also serving Plex, the *arr* stack,
   Nextcloud and Home Assistant, 2–3 is a more honest ceiling.
6. **Look at the recovery loop.** Logs showed continuous `/segments/seg_recovery_*`
   206s. Whether the capture pipeline should still have been running after a
   recovery cycle is worth confirming separately — this postmortem does not answer
   it.

## Restarting it

```bash
ssh nas 'cd /mnt/tank/apps/elsewhere-cable/source/repository/infra/endor \
  && sudo docker compose start'
```

Restart policy is `unless-stopped`, so it stays down across reboots until started
explicitly. Image, volumes and state are intact.

To check whether the renderer is on the GPU or in software:

```bash
ssh nas 'docker exec elsewhere-cable ps -eo pcpu,etime,comm --sort=-pcpu | head -5'
```

A `chromium` GPU process sustained in the hundreds of percent means software
fallback.

---

*Investigated 9 August 2026 while diagnosing an unrelated Plex issue on the same
host. Measurements are from `endor` (TrueNAS SCALE, AMD Ryzen AI 9 HX PRO 370 /
Radeon 890M, 24 logical cores).*
