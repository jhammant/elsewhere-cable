FROM node:22-trixie-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"
WORKDIR /app

RUN corepack enable \
  && corepack prepare pnpm@10.33.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY services ./services

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @elsewhere-cable/renderer build

FROM node:22-trixie-slim AS runtime

ENV DEBIAN_FRONTEND=noninteractive
ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"
ENV DISPLAY=:99
ENV XDG_RUNTIME_DIR=/tmp/elsewhere-runtime
ENV PULSE_RUNTIME_PATH=/tmp/elsewhere-runtime/pulse
ENV LIBVA_DRIVER_NAME=radeonsi

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    chromium \
    curl \
    ffmpeg \
    fonts-dejavu-core \
    fonts-liberation \
    mesa-va-drivers \
    mesa-vulkan-drivers \
    pulseaudio \
    vainfo \
    xvfb \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --create-home --uid 10001 --gid users \
    --groups audio,video broadcast \
  && mkdir -p /tmp/.X11-unix \
  && chmod 1777 /tmp/.X11-unix \
  && corepack enable \
  && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app
COPY --from=build --chown=broadcast:users /app /app
COPY --chown=broadcast:users infra/endor/entrypoint.sh /usr/local/bin/elsewhere-entrypoint
COPY --chown=broadcast:users infra/endor/audio-watchdog.sh /usr/local/bin/elsewhere-audio-watchdog
COPY --chown=broadcast:users infra/endor/chromium-handover.mjs /usr/local/bin/elsewhere-chromium-handover
COPY --chown=broadcast:users infra/endor/ffmpeg-youtube.mjs /usr/local/bin/elsewhere-youtube-ffmpeg

RUN chmod 0755 \
  /usr/local/bin/elsewhere-entrypoint \
  /usr/local/bin/elsewhere-audio-watchdog \
  /usr/local/bin/elsewhere-chromium-handover \
  /usr/local/bin/elsewhere-youtube-ffmpeg

USER broadcast

ENV ELSEWHERE_HOST=127.0.0.1
ENV ELSEWHERE_PORT=4174
ENV ELSEWHERE_SEGMENTS_DIR=/content/current
ENV ELSEWHERE_OUTPUT_MODE=record
ENV ELSEWHERE_RECORDING_PATH=/recordings/elsewhere-test.mkv
ENV ELSEWHERE_STREAM_URL=rtmps://a.rtmps.youtube.com/live2

HEALTHCHECK --interval=10s --timeout=3s --start-period=45s --retries=6 \
  CMD curl -fsS http://127.0.0.1:4174/health/ready >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/elsewhere-entrypoint"]
