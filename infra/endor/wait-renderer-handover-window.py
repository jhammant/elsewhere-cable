#!/usr/bin/env python3

import argparse
import json
import os
import pathlib
import re
import subprocess
import time


SEGMENT_REQUEST = re.compile(r"^/api/playout/segments/(seg_[a-z0-9_]+)$")


def latest_segment_request(container: str) -> tuple[str, int] | None:
    result = subprocess.run(
        ["docker", "logs", "--since", "5m", "--tail", "10000", container],
        capture_output=True,
        check=False,
        text=True,
        timeout=15,
    )
    latest: tuple[str, int] | None = None
    for line in f"{result.stdout}\n{result.stderr}".splitlines():
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue
        request = record.get("req")
        if not isinstance(request, dict) or request.get("method") != "GET":
            continue
        url = request.get("url")
        timestamp = record.get("time")
        match = SEGMENT_REQUEST.fullmatch(url) if isinstance(url, str) else None
        if match is None or not isinstance(timestamp, (int, float)):
            continue
        if latest is None or timestamp > latest[1]:
            latest = (match.group(1), int(timestamp))
    return latest


def manifest_durations(manifest_path: pathlib.Path) -> dict[str, int]:
    with manifest_path.open(encoding="utf-8") as handle:
        manifest = json.load(handle)
    durations: dict[str, int] = {}
    for entry in manifest.get("segments", []):
        segment_id = entry.get("segmentId")
        duration_ms = entry.get("durationMs")
        if (
            isinstance(segment_id, str)
            and SEGMENT_REQUEST.fullmatch(f"/api/playout/segments/{segment_id}")
            is not None
            and isinstance(duration_ms, int)
            and duration_ms > 0
        ):
            durations[segment_id] = duration_ms
    return durations


def atomic_write(path: pathlib.Path, value: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    next_path = path.with_name(f"{path.name}.{os.getpid()}.next")
    next_path.write_text(f"{json.dumps(value)}\n", encoding="utf-8")
    os.replace(next_path, path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--container", default="elsewhere-cable")
    parser.add_argument("--manifest", type=pathlib.Path, required=True)
    parser.add_argument("--output", type=pathlib.Path, required=True)
    parser.add_argument("--timeout-seconds", type=int, default=120)
    args = parser.parse_args()
    if re.fullmatch(r"[a-zA-Z0-9_.-]{1,80}", args.container) is None:
        raise SystemExit("Invalid container name")
    if args.timeout_seconds < 1 or args.timeout_seconds > 300:
        raise SystemExit("--timeout-seconds must be from 1 to 300")

    deadline = time.monotonic() + args.timeout_seconds
    latest_status: dict[str, object] = {"safe": False, "reason": "no-segment-request"}
    while time.monotonic() < deadline:
        request = latest_segment_request(args.container)
        if request is not None:
            segment_id, started_at_ms = request
            duration_ms = manifest_durations(args.manifest).get(segment_id)
            if duration_ms is None:
                latest_status = {
                    "safe": False,
                    "reason": "segment-absent-from-manifest",
                    "segmentId": segment_id,
                }
            else:
                elapsed_ms = max(0, int(time.time() * 1000) - started_at_ms)
                remaining_ms = duration_ms - elapsed_ms
                latest_status = {
                    "safe": elapsed_ms >= 1000 and remaining_ms >= 10000,
                    "event": "segment.started",
                    "segmentId": segment_id,
                    "durationMs": duration_ms,
                    "observedAt": time.strftime(
                        "%Y-%m-%dT%H:%M:%SZ", time.gmtime(started_at_ms / 1000)
                    ),
                    "elapsedMs": elapsed_ms,
                    "remainingMs": remaining_ms,
                }
                if latest_status["safe"]:
                    atomic_write(args.output, latest_status)
                    print(json.dumps(latest_status))
                    return
        time.sleep(0.25)
    raise SystemExit(
        f"No safe renderer handover window appeared: {json.dumps(latest_status)}"
    )


if __name__ == "__main__":
    main()
