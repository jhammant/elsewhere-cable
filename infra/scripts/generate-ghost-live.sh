#!/bin/sh
set -eu

mode=${1:-once}
batch_count=${ELSEWHERE_LIVE_BATCH_COUNT:-24}
output_root=${ELSEWHERE_LIVE_SEGMENTS_DIR:-data/segments-live}
history_root=${ELSEWHERE_CREATIVE_HISTORY_DIR:-data/segments}
llm_base_url=${ELSEWHERE_LLM_BASE_URL:-http://127.0.0.1:1234/v1}
llm_model=${ELSEWHERE_LLM_MODEL:-google/gemma-4-26b-a4b}
tts_base_url=${ELSEWHERE_TTS_BASE_URL:-http://127.0.0.1:8878/v1}
tts_model=${ELSEWHERE_TTS_MODEL:-mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-bf16}
embedding_base_url=${ELSEWHERE_EMBEDDING_BASE_URL:-http://127.0.0.1:11434}
embedding_model=${ELSEWHERE_EMBEDDING_MODEL:-nomic-embed-text:latest}

if [ "$mode" != "once" ] && [ "$mode" != "loop" ]; then
  echo "Usage: $0 [once|loop]" >&2
  exit 64
fi
case "$batch_count" in
  '' | *[!0-9]*)
    echo "ELSEWHERE_LIVE_BATCH_COUNT must be an integer from 1 to 100." >&2
    exit 64
    ;;
esac
if [ "$batch_count" -lt 1 ] || [ "$batch_count" -gt 100 ]; then
  echo "ELSEWHERE_LIVE_BATCH_COUNT must be an integer from 1 to 100." >&2
  exit 64
fi

while :; do
  pnpm generate:batch -- \
    --count "$batch_count" \
    --concurrency 2 \
    --history "$history_root" \
    --output "$output_root" \
    --base-url "$llm_base_url" \
    --model "$llm_model" \
    --tts-base-url "$tts_base_url" \
    --tts-model "$tts_model" \
    --embedding-base-url "$embedding_base_url" \
    --embedding-model "$embedding_model"

  ELSEWHERE_LOCAL_SEGMENTS_DIR="$output_root" pnpm endor:sync

  if [ "$mode" = "once" ]; then
    exit 0
  fi
  sleep 30
done
