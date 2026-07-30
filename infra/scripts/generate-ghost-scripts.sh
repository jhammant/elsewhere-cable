#!/bin/sh
set -eu

script_directory=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
workspace_root=$(dirname "$(dirname "$script_directory")")
cd "$workspace_root"

mode=${1:-once}
batch_count=${ELSEWHERE_SCRIPT_BATCH_COUNT:-16}
generation_concurrency=${ELSEWHERE_GENERATION_CONCURRENCY:-4}
proposal_attempts=${ELSEWHERE_PROPOSAL_ATTEMPTS:-32}
output_root=${ELSEWHERE_LIVE_SEGMENTS_DIR:-data/segments-live}
script_queue=${ELSEWHERE_SCRIPT_QUEUE_DIR:-data/script-reservoir}
script_target_count=${ELSEWHERE_SCRIPT_TARGET_COUNT:-5400}
llm_base_url=${ELSEWHERE_LLM_BASE_URL:-http://127.0.0.1:1235/v1}
llm_model=${ELSEWHERE_LLM_MODEL:-qwen3.5-35b-a3b}
embedding_base_url=${ELSEWHERE_EMBEDDING_BASE_URL:-http://127.0.0.1:11434}
embedding_model=${ELSEWHERE_EMBEDDING_MODEL:-nomic-embed-text:latest}
optimisation_brief=${ELSEWHERE_OPTIMISATION_BRIEF:-data/optimisation/current-brief.json}
generation_history=${ELSEWHERE_GENERATION_HISTORY:-data/optimisation/generation-history.ndjson}

if [ "$mode" != "once" ] && [ "$mode" != "loop" ]; then
  echo "Usage: $0 [once|loop]" >&2
  exit 64
fi
for value in "$batch_count" "$generation_concurrency" "$proposal_attempts" "$script_target_count"; do
  case "$value" in
    '' | *[!0-9]*)
      echo "Script batch, concurrency and target values must be integers." >&2
      exit 64
      ;;
  esac
done
if [ "$proposal_attempts" -lt 1 ] || [ "$proposal_attempts" -gt 64 ]; then
  echo "ELSEWHERE_PROPOSAL_ATTEMPTS must be an integer from 1 to 64." >&2
  exit 64
fi
if [ "$batch_count" -lt 1 ] || [ "$batch_count" -gt 100 ]; then
  echo "ELSEWHERE_SCRIPT_BATCH_COUNT must be an integer from 1 to 100." >&2
  exit 64
fi
if [ "$generation_concurrency" -lt 1 ] || [ "$generation_concurrency" -gt 4 ]; then
  echo "ELSEWHERE_GENERATION_CONCURRENCY must be an integer from 1 to 4." >&2
  exit 64
fi
if [ "$script_target_count" -lt 1 ]; then
  echo "ELSEWHERE_SCRIPT_TARGET_COUNT must be a positive integer." >&2
  exit 64
fi

mkdir -p "$script_queue/pending" "$script_queue/completed" "$(dirname "$generation_history")"

while :; do
  pending_count=$(find "$script_queue/pending" -maxdepth 1 -type f -name 'draft_*.json' | wc -l | tr -d ' ')
  completed_count=$(find "$script_queue/completed" -maxdepth 1 -type f -name 'draft_*.json' | wc -l | tr -d ' ')
  if [ "$pending_count" -ge "$script_target_count" ]; then
    printf '{"pendingScripts":%s,"completedScripts":%s,"targetScripts":%s,"status":"target"}\n' \
      "$pending_count" "$completed_count" "$script_target_count"
    if [ "$mode" = "once" ]; then
      exit 0
    fi
    sleep 60
    continue
  fi

  set -- \
    --prepare-scripts \
    --script-queue "$script_queue" \
    --count "$batch_count" \
    --concurrency "$generation_concurrency" \
    --proposal-attempts "$proposal_attempts" \
    --output "$output_root" \
    --base-url "$llm_base_url" \
    --model "$llm_model" \
    --embedding-base-url "$embedding_base_url" \
    --embedding-model "$embedding_model"
  if [ -r "$optimisation_brief" ]; then
    set -- "$@" --optimisation-brief "$optimisation_brief"
  fi

  batch_started_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  batch_started_epoch=$(date '+%s')
  pending_before=$pending_count
  completed_before=$completed_count
  if pnpm generate:batch -- "$@"; then
    batch_status=approved
  else
    batch_status=rejected
  fi
  batch_finished_epoch=$(date '+%s')
  pending_count=$(find "$script_queue/pending" -maxdepth 1 -type f -name 'draft_*.json' | wc -l | tr -d ' ')
  completed_count=$(find "$script_queue/completed" -maxdepth 1 -type f -name 'draft_*.json' | wc -l | tr -d ' ')
  printf '{"generatedAt":"%s","status":"%s","requestedScripts":%s,"proposalAttempts":%s,"durationSeconds":%s,"pendingDelta":%s,"completedDelta":%s,"pendingScripts":%s,"completedScripts":%s}\n' \
    "$batch_started_at" \
    "$batch_status" \
    "$batch_count" \
    "$proposal_attempts" \
    "$((batch_finished_epoch - batch_started_epoch))" \
    "$((pending_count - pending_before))" \
    "$((completed_count - completed_before))" \
    "$pending_count" \
    "$completed_count" >>"$generation_history"

  if [ "$batch_status" = "rejected" ]; then
    if [ "$mode" = "once" ]; then
      exit 1
    fi
    echo "Script batch yielded no approved drafts; preserving the queue and retrying."
    sleep 30
    continue
  fi

  printf '{"pendingScripts":%s,"completedScripts":%s,"targetScripts":%s,"status":"growing"}\n' \
    "$pending_count" "$completed_count" "$script_target_count"
  if [ "$mode" = "once" ]; then
    exit 0
  fi
  sleep 15
done
