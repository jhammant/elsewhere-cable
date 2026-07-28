#!/bin/sh
set -eu

lmstudio_root=${ELSEWHERE_LMSTUDIO_ROOT:-"$HOME/.lmstudio"}
backend_root=${ELSEWHERE_LLAMA_BACKEND_ROOT:-"$lmstudio_root/extensions/backends"}
model_path=${ELSEWHERE_BULK_LLM_MODEL_PATH:-"$lmstudio_root/models/lmstudio-community/Qwen3.5-35B-A3B-GGUF/Qwen3.5-35B-A3B-Q4_K_M.gguf"}
port=${ELSEWHERE_BULK_LLM_PORT:-1235}

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
  --ctx-size 8192 \
  --n-gpu-layers 999999 \
  --threads 13 \
  --parallel 2 \
  --batch-size 2048 \
  --ubatch-size 512 \
  --flash-attn auto \
  --kv-offload \
  --mlock
