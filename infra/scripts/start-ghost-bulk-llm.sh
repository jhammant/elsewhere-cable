#!/bin/sh
set -eu

lmstudio_root=${ELSEWHERE_LMSTUDIO_ROOT:-"$HOME/.lmstudio"}
backend_root=${ELSEWHERE_LLAMA_BACKEND_ROOT:-"$lmstudio_root/extensions/backends"}
model_path=${ELSEWHERE_BULK_LLM_MODEL_PATH:-"$lmstudio_root/models/lmstudio-community/Qwen3.5-35B-A3B-GGUF/Qwen3.5-35B-A3B-Q4_K_M.gguf"}
port=${ELSEWHERE_BULK_LLM_PORT:-1235}
context_size=${ELSEWHERE_BULK_LLM_CONTEXT_SIZE:-16384}
parallel_slots=${ELSEWHERE_BULK_LLM_PARALLEL_SLOTS:-2}
threads=${ELSEWHERE_BULK_LLM_THREADS:-13}

for value in "$port" "$context_size" "$parallel_slots" "$threads"; do
  case "$value" in
    '' | *[!0-9]*)
      echo "Bulk LLM port, context, parallel slots and threads must be positive integers." >&2
      exit 64
      ;;
  esac
  if [ "$value" -lt 1 ]; then
    echo "Bulk LLM port, context, parallel slots and threads must be positive integers." >&2
    exit 64
  fi
done
if [ "$parallel_slots" -gt 4 ]; then
  echo "ELSEWHERE_BULK_LLM_PARALLEL_SLOTS must not exceed 4." >&2
  exit 64
fi
if [ $((context_size / parallel_slots)) -lt 8192 ]; then
  echo "Each bulk LLM slot needs at least 8192 context tokens." >&2
  exit 64
fi

server_path=$(
  find "$backend_root" -type f -name llama-server -perm -u+x -print |
    sort |
    tail -n 1
)

if [ -z "$server_path" ] || [ ! -x "$server_path" ]; then
  echo "No executable llama-server found below $backend_root" >&2
  exit 66
fi
if [ ! -r "$model_path" ]; then
  echo "Bulk generation model is missing: $model_path" >&2
  exit 66
fi

exec "$server_path" \
  --model "$model_path" \
  --host 127.0.0.1 \
  --port "$port" \
  --no-webui \
  --jinja \
  --reasoning off \
  --ctx-size "$context_size" \
  --n-gpu-layers 999999 \
  --threads "$threads" \
  --parallel "$parallel_slots" \
  --batch-size 2048 \
  --ubatch-size 512 \
  --flash-attn auto \
  --kv-offload \
  --mlock
