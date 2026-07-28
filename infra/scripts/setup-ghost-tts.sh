#!/bin/sh
set -eu

workspace_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
venv_path="$workspace_root/.venv-tts"

uv venv --python 3.12 "$venv_path"
uv pip install --python "$venv_path/bin/python" mlx-audio soundfile

echo "Ghost TTS runtime installed at $venv_path"
echo "Model weights are downloaded only when pnpm tts:qwen:start first runs."
