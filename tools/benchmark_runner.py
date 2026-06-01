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
    parser.add_argument("--max-ui-rounds", type=int, default=120, help="Max UI rounds for loading comments")
    parser.add_argument("--ui-idle-rounds", type=int, default=15, help="Stop after N idle UI rounds")
    parser.add_argument("--login-enabled", action="store_true", help="Enable login flow")
    parser.add_argument("--headful", action="store_true", help="Run in headful mode")
    parser.add_argument("--python", default="python3", help="Python executable")
    parser.add_argument("--warmup-runs", type=int, default=0, help="Warmup runs (excluded from aggregate)")
    parser.add_argument("--out", default="", help="Optional output JSON file path for benchmark report")
    args = parser.parse_args()

    input_payload = {
        "urls": [args.url],
        "maxComments": args.max_comments,
        "maxUiRounds": args.max_ui_rounds,
        "uiIdleRounds": args.ui_idle_rounds,
        "loginEnabled": bool(args.login_enabled),
        "headful": bool(args.headful),
        "maxCommentLikers": 0,
        "likerCollectionMode": "best_effort",
    }

    input_path = Path("storage/key_value_stores/default/INPUT.json")
    write_input(input_path, input_payload)

    total_runs = args.warmup_runs + args.runs
    results = []
    for i in range(1, total_runs + 1):
        elapsed, code, output = run_once(args.python)
        summary = parse_summary(output)
        urls_total = int(summary.get("urls_total") or 0)
        urls_processed = int(summary.get("urls_processed") or 0)
        valid = (code == 0) and (urls_total == 0 or urls_processed >= urls_total)
        row = {
            "run": i,
            "phase": "warmup" if i <= args.warmup_runs else "measured",
            "elapsed_secs": round(elapsed, 2),
            "exit_code": code,
            "valid": valid,
            "summary": summary,
        }
        results.append(row)
        print(json.dumps(row, ensure_ascii=False))

    measured = [r for r in results if r["phase"] == "measured"]
    valid_measured = [r for r in measured if r["valid"]]

    def _median(values):
        if not values:
            return None
        vals = sorted(values)
        n = len(vals)
        mid = n // 2
        if n % 2 == 1:
            return vals[mid]
        return round((vals[mid - 1] + vals[mid]) / 2, 2)

    avg_elapsed = round(sum(r["elapsed_secs"] for r in valid_measured) / len(valid_measured), 2) if valid_measured else None
    med_elapsed = _median([r["elapsed_secs"] for r in valid_measured])
    avg_comments = round(sum((r["summary"].get("comments_captured_total") or 0) for r in valid_measured) / len(valid_measured), 2) if valid_measured else None

    report = {
        "warmup_runs": args.warmup_runs,
        "runs": args.runs,
        "successful_runs": len([r for r in measured if r["exit_code"] == 0]),
        "valid_runs": len(valid_measured),
        "avg_elapsed_secs": avg_elapsed,
        "median_elapsed_secs": med_elapsed,
        "avg_comments_captured_total": avg_comments,
        "results": results,
    }

    measured_elapsed = [r["elapsed_secs"] for r in valid_measured]
    if len(measured_elapsed) >= 2 and min(measured_elapsed) > 0:
        spread = max(measured_elapsed) / min(measured_elapsed)
        if spread >= 1.8:
            print(f"WARN: high runtime variance detected (max/min={spread:.2f}).")
    print("---")
    print(json.dumps(report, indent=2, ensure_ascii=False))

    if args.out:
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Report written to: {out_path}")


if __name__ == "__main__":
    main()
