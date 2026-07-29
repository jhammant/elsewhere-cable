#!/bin/sh
set -eu

mode=${1:-once}
batch_count=${ELSEWHERE_LIVE_BATCH_COUNT:-24}
generation_concurrency=${ELSEWHERE_GENERATION_CONCURRENCY:-2}
output_root=${ELSEWHERE_LIVE_SEGMENTS_DIR:-data/segments-live}
history_root=${ELSEWHERE_CREATIVE_HISTORY_DIR:-data/segments}
llm_base_url=${ELSEWHERE_LLM_BASE_URL:-http://127.0.0.1:1235/v1}
llm_model=${ELSEWHERE_LLM_MODEL:-qwen3.5-35b-a3b}
tts_base_url=${ELSEWHERE_TTS_BASE_URL:-local}
tts_model=${ELSEWHERE_TTS_MODEL:-mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-bf16}
embedding_base_url=${ELSEWHERE_EMBEDDING_BASE_URL:-http://127.0.0.1:11434}
embedding_model=${ELSEWHERE_EMBEDDING_MODEL:-nomic-embed-text:latest}
reservoir_target_hours=${ELSEWHERE_RESERVOIR_TARGET_HOURS:-72}
optimisation_brief=${ELSEWHERE_OPTIMISATION_BRIEF:-data/optimisation/current-brief.json}
recovery_refill_count=${ELSEWHERE_RECOVERY_REFILL_COUNT:-0}
package_prepared_scripts=${ELSEWHERE_PACKAGE_PREPARED_SCRIPTS:-0}
script_queue=${ELSEWHERE_SCRIPT_QUEUE_DIR:-data/script-reservoir}

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
case "$generation_concurrency" in
  '' | *[!0-9]*)
    echo "ELSEWHERE_GENERATION_CONCURRENCY must be an integer from 1 to 4." >&2
    exit 64
    ;;
esac
if [ "$generation_concurrency" -lt 1 ] || [ "$generation_concurrency" -gt 4 ]; then
  echo "ELSEWHERE_GENERATION_CONCURRENCY must be an integer from 1 to 4." >&2
  exit 64
fi
case "$recovery_refill_count" in
  '' | *[!0-9]*)
    echo "ELSEWHERE_RECOVERY_REFILL_COUNT must be an integer from 0 to 100." >&2
    exit 64
    ;;
esac
if [ "$recovery_refill_count" -lt 0 ] || [ "$recovery_refill_count" -gt 100 ]; then
  echo "ELSEWHERE_RECOVERY_REFILL_COUNT must be an integer from 0 to 100." >&2
  exit 64
fi
if [ "$package_prepared_scripts" != "0" ] && [ "$package_prepared_scripts" != "1" ]; then
  echo "ELSEWHERE_PACKAGE_PREPARED_SCRIPTS must be 0 or 1." >&2
  exit 64
fi

pnpm exec tsx infra/scripts/bootstrap-live-queue.ts \
  --base "$history_root" \
  --output "$output_root"
if [ "$package_prepared_scripts" = "1" ]; then
  mkdir -p "$script_queue/pending"
fi

while :; do
  if pnpm exec tsx infra/scripts/reservoir-status.ts \
    --segments "$output_root" \
    --target-hours "$reservoir_target_hours" \
    --ready-check; then
    echo "Reservoir target reached; generation stopped cleanly."
    exit 0
  fi
  if [ "$package_prepared_scripts" = "1" ] &&
    ! find "$script_queue/pending" -maxdepth 1 -type f -name 'draft_*.json' -print -quit |
      grep -q .; then
    if [ "$mode" = "once" ]; then
      echo "No prepared scripts are waiting for packaging." >&2
      exit 66
    fi
    echo "Prepared script queue empty; waiting without affecting playout."
    sleep 15
    continue
  fi

  set -- \
    --count "$batch_count" \
    --concurrency "$generation_concurrency" \
    --output "$output_root" \
    --base-url "$llm_base_url" \
    --model "$llm_model" \
    --embedding-base-url "$embedding_base_url" \
    --embedding-model "$embedding_model"
  if [ "$tts_base_url" != "local" ]; then
    set -- "$@" \
      --tts-base-url "$tts_base_url" \
      --tts-model "$tts_model"
  fi
  if [ "$package_prepared_scripts" = "1" ]; then
    set -- "$@" \
      --package-scripts \
      --script-queue "$script_queue"
  fi
  if [ -r "$optimisation_brief" ]; then
    set -- "$@" \
      --optimisation-brief "$optimisation_brief"
  fi

  if ! pnpm generate:batch -- "$@"; then
    if [ "$mode" = "once" ]; then
      exit 1
    fi
    echo "Batch yielded no approved material; preserving the reservoir and retrying."
    sleep 30
    continue
  fi

  pnpm exec tsx infra/scripts/audit-reservoir.ts \
    --segments "$output_root" \
    --recent "$batch_count" \
    --apply
  if [ "$recovery_refill_count" -gt 0 ]; then
    pnpm exec tsx infra/scripts/emergency-refill.ts \
      --segments "$output_root" \
      --count "$recovery_refill_count"
  fi

  ELSEWHERE_LOCAL_SEGMENTS_DIR="$output_root" pnpm endor:sync

  if [ "$mode" = "once" ]; then
    exit 0
  fi
  sleep 30
done
