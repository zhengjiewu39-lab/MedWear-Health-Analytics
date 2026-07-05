#!/usr/bin/env python3
"""Generate synthetic MedWear health data (calls Node generator or standalone fallback)."""

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "generate_synthetic_healthdata.js"


def main():
    p = argparse.ArgumentParser(description="Generate synthetic Apple Health-style datasets")
    p.add_argument("--users", type=int, default=200)
    p.add_argument("--days", type=int, default=14)
    p.add_argument("--out", default="experiments/data/medwear")
    p.add_argument("--seed", type=int, default=42)
    args = p.parse_args()

    if SCRIPT.exists():
        cmd = [
            "node", str(SCRIPT),
            "--users", str(args.users),
            "--days", str(args.days),
            "--out", args.out,
            "--seed", str(args.seed),
        ]
        print("Running:", " ".join(cmd))
        subprocess.check_call(cmd, cwd=ROOT)
    else:
        print(f"Node script not found: {SCRIPT}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
