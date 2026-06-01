#!/usr/bin/env python3
import argparse
import json
import re
import subprocess
import time
from pathlib import Path


RUN_SUMMARY_RE = re.compile(r"\[run\.summary\]\s+(.*)$")
KV_RE = re.compile(r"(\w+)=([^\s]+)")


def write_input(input_path: Path, payload: dict) -> None:
    input_path.parent.mkdir(parents=True, exist_ok=True)
    input_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def parse_summary(output: str) -> dict:
    for line in output.splitlines()[::-1]:
        m = RUN_SUMMARY_RE.search(line)
        if not m:
            continue
        fields = {}
        for k, v in KV_RE.findall(m.group(1)):
            if v.isdigit():
                fields[k] = int(v)
            else:
                try:
                    fields[k] = float(v)
                except ValueError:
                    fields[k] = v
        return fields
    return {}


def run_once(python_bin: str) -> tuple[float, int, str]:
    start = time.perf_counter()
    proc = subprocess.run(
        [python_bin, "-m", "main"],
        capture_output=True,
        text=True,
    )
    elapsed = time.perf_counter() - start
    output = (proc.stdout or "") + "\n" + (proc.stderr or "")
    return elapsed, proc.returncode, output


def main() -> None:
    parser = argparse.ArgumentParser(description="Run reproducible local benchmark passes for the actor")
    parser.add_argument("--url", required=True, help="Instagram post URL")
    parser.add_argument("--runs", type=int, default=3, help="Number of benchmark runs")
    parser.add_argument("--max-comments", type=int, default=20, help="Limit comments for reproducibility")
    parser.add_argument("--headful", action="store_true", help="Run in headful mode")
    parser.add_argument("--python", default="python3", help="Python executable")
    args = parser.parse_args()

    input_payload = {
        "urls": [args.url],
        "maxComments": args.max_comments,
        "headful": bool(args.headful),
        "maxCommentLikers": 0,
        "likerCollectionMode": "best_effort",
    }

    input_path = Path("storage/key_value_stores/default/INPUT.json")
    write_input(input_path, input_payload)

    results = []
    for i in range(1, args.runs + 1):
        elapsed, code, output = run_once(args.python)
        summary = parse_summary(output)
        results.append({"run": i, "elapsed_secs": round(elapsed, 2), "exit_code": code, "summary": summary})
        print(json.dumps(results[-1], ensure_ascii=False))

    ok = [r for r in results if r["exit_code"] == 0]
    avg_elapsed = round(sum(r["elapsed_secs"] for r in ok) / len(ok), 2) if ok else None
    avg_comments = round(sum((r["summary"].get("comments_captured_total") or 0) for r in ok) / len(ok), 2) if ok else None

    report = {
        "runs": args.runs,
        "successful_runs": len(ok),
        "avg_elapsed_secs": avg_elapsed,
        "avg_comments_captured_total": avg_comments,
        "results": results,
    }
    print("---")
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
