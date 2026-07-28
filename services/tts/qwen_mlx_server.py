#!/usr/bin/env python3
"""Local-only OpenAI-shaped TTS server for Qwen3-TTS VoiceDesign on Apple Silicon."""

from __future__ import annotations

import argparse
import io
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
import soundfile as sf
from mlx_audio.tts.utils import load_model


def delivery_instruction(speed: float) -> str:
    if speed >= 1.18:
        return "Speak quickly with alert comic timing, while remaining intelligible."
    if speed <= 0.84:
        return "Speak slowly with deliberate pauses and restrained deadpan timing."
    return "Use natural conversational timing with a dry comic performance."


class VoiceServer(ThreadingHTTPServer):
    model: object
    model_id: str
    generation_lock: threading.Lock


class Handler(BaseHTTPRequestHandler):
    server: VoiceServer

    def log_message(self, format_string: str, *args: object) -> None:
        print(f"qwen-tts {self.address_string()} {format_string % args}", flush=True)

    def send_json(self, status: int, payload: dict[str, object]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path == "/health/ready":
            self.send_json(200, {"status": "ready", "model": self.server.model_id})
            return
        self.send_json(404, {"error": "not found"})

    def do_POST(self) -> None:
        if self.path != "/v1/audio/speech":
            self.send_json(404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            request = json.loads(self.rfile.read(length))
            text = str(request["input"]).strip()
            voice = str(request.get("voice", "")).strip()
            speed = float(request.get("speed", 1))
            if not text or len(text) > 1_000:
                raise ValueError("input must contain 1–1000 characters")
            if not voice or len(voice) > 240:
                raise ValueError("voice must contain a concise character description")

            instruction = f"{voice}. {delivery_instruction(speed)}"
            with self.server.generation_lock:
                chunks = list(
                    self.server.model.generate_voice_design(
                        text=text,
                        language="English",
                        instruct=instruction,
                    )
                )
            if not chunks:
                raise RuntimeError("model returned no audio")
            arrays = [np.asarray(chunk.audio, dtype=np.float32) for chunk in chunks]
            audio = np.concatenate(arrays)
            sample_rate = int(getattr(chunks[0], "sample_rate", 24_000))
            output = io.BytesIO()
            sf.write(output, audio, sample_rate, format="WAV", subtype="PCM_16")
            body = output.getvalue()
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (KeyError, TypeError, ValueError) as error:
            self.send_json(400, {"error": str(error)})
        except Exception as error:  # Keep model errors visible to the local operator.
            self.send_json(500, {"error": f"{type(error).__name__}: {error}"})


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8878)
    parser.add_argument(
        "--model",
        default="mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-bf16",
    )
    args = parser.parse_args()

    print(f"Loading {args.model}; the first run may download model weights.", flush=True)
    model = load_model(args.model)
    server = VoiceServer((args.host, args.port), Handler)
    server.model = model
    server.model_id = args.model
    server.generation_lock = threading.Lock()
    print(f"Qwen VoiceDesign ready at http://{args.host}:{args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
