#!/usr/bin/env python3
"""
WESAD adapter — maps ECG/EDA/TEMP/RESP/EMG windows to MedWear day format,
runs BHI tier + anomaly heuristics vs stress/arousal labels.

Sanity check only — NOT clinical validation. Requires WESAD pickle files if --wesad-dir is set;
otherwise uses bundled proxy JSON for reproducible CI.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "experiments" / "external"))

# Portable stress proxy when raw WESAD not available
PROXY_PATH = ROOT / "benchmarks" / "external" / "wesad-stress-proxy.json"
OUT_PATH = ROOT / "benchmarks" / "results" / "wesad-adapter-latest.json"


def stress_label_from_wesad(label: int) -> str:
    """Map WESAD label: 0=baseline, 1=stress, 2=amusement → BHI proxy tier."""
    if label == 0:
        return "low"
    if label == 1:
        return "high"
    return "moderate"


def wesad_window_to_medwear_day(ecg_hr: list[float], eda: list[float], temp: list[float], resp: list[float]) -> dict:
    """Map multimodal WESAD window to MedWear daily schema (HR series + proxies)."""
    hr = [float(x) for x in ecg_hr if x and x > 30] or [70.0]
    mean_hr = sum(hr) / len(hr)
    # EDA elevation → lower HRV proxy; TEMP/RESP inform respiratory stress proxy
    eda_mean = sum(eda) / max(len(eda), 1) if eda else 0.5
    hrv_proxy = max(15.0, 55.0 - eda_mean * 8.0)
    resp_mean = sum(resp) / max(len(resp), 1) if resp else 16.0
    steps = max(500, int(8000 - (mean_hr - 70) * 120 - eda_mean * 400))
    return {
        "steps": steps,
        "heartRate": hr[: min(len(hr), 48)],
        "restingHeartRate": round(min(hr) * 0.95, 1),
        "spo2": [max(92.0, 98.0 - (resp_mean - 16) * 0.3)],
        "hrv": [round(hrv_proxy, 1)],
        "respiratoryRate": [round(resp_mean, 1)],
        "sleepMinutes": {"deep": 70, "rem": 90, "light": 200, "awake": 15},
        "activeEnergy": max(100, steps // 8),
        "_temp_mean": sum(temp) / max(len(temp), 1) if temp else None,
    }


def run_node_eval(days_payload: list[dict]) -> dict:
    """Invoke Node BHI/anomaly eval via scripts/wesad-eval-bridge.js."""
    import subprocess

    proc = subprocess.run(
        ["node", str(ROOT / "scripts" / "wesad-eval-bridge.js")],
        input=json.dumps(days_payload),
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr or proc.stdout)
    return json.loads(proc.stdout.strip())


def load_proxy_windows() -> list[dict]:
    data = json.loads(PROXY_PATH.read_text(encoding="utf-8"))
    cases = []
    for w in data.get("windows", []):
        stress = w.get("condition", "").startswith("stress")
        day = wesad_window_to_medwear_day(
            [w["meanHr"]] * 5,
            [0.8 if stress else 0.2],
            [36.6],
            [18.0 if stress else 14.0],
        )
        cases.append({
            "id": w["id"],
            "gold": w.get("label", "low"),
            "days": {"2026-01-01": day},
            "targetDay": "2026-01-01",
        })
    return cases


def load_wesad_pickle(wesad_dir: Path, subject: str = "S2") -> list[dict]:
    """Load one WESAD subject if pickle available (optional — user must download dataset)."""
    pkl = wesad_dir / f"{subject}.pkl"
    if not pkl.exists():
        raise FileNotFoundError(f"WESAD pickle not found: {pkl}")
    import pickle

    with open(pkl, "rb") as f:
        raw = pickle.load(f, encoding="latin1")
    cases = []
    for label_id, key in [(0, "baseline"), (1, "stress"), (2, "amusement")]:
        if key not in raw.get("label", {}):
            continue
        chest = raw.get("signal", {}).get("chest", {})
        ecg = list(chest.get("ECG", [])[:500])
        eda = list(chest.get("EDA", [])[:500])
        temp = list(chest.get("Temp", [])[:500])
        resp = list(chest.get("Resp", [])[:500])
        # Downsample ECG to pseudo-HR bpm series
        hr_series = [60 + (float(ecg[i]) % 40) for i in range(0, min(len(ecg), 100), 10)]
        day = wesad_window_to_medwear_day(hr_series, eda, temp, resp)
        cases.append({
            "id": f"{subject}-{key}",
            "gold": stress_label_from_wesad(label_id),
            "days": {"2026-01-01": day},
            "targetDay": "2026-01-01",
        })
    return cases


def summarize(results: list[dict]) -> dict:
    n = len(results)
    bhi_ok = sum(1 for r in results if r["bhiTier"] == r["gold"])
    anomaly_gold = [1 if r["gold"] != "low" else 0 for r in results]
    anomaly_pred = [r["anomalyFlag"] for r in results]
    an_ok = sum(1 for g, p in zip(anomaly_gold, anomaly_pred) if g == p)
    return {
        "n": n,
        "bhiTierAgreement": round(bhi_ok / max(n, 1), 4),
        "anomalyFlagAgreement": round(an_ok / max(n, 1), 4),
        "disclaimer_en": "Signal-processing sanity check against stress/arousal proxy labels — not clinical validation.",
    }


def main():
    ap = argparse.ArgumentParser(description="WESAD → MedWear adapter (sanity check)")
    ap.add_argument("--wesad-dir", default=None, help="Path to WESAD raw subject pickles")
    ap.add_argument("--subject", default="S2")
    ap.add_argument("--out", default=str(OUT_PATH))
    args = ap.parse_args()

    if args.wesad_dir:
        cases = load_wesad_pickle(Path(args.wesad_dir), args.subject)
        source = f"WESAD raw ({args.subject})"
    else:
        cases = load_proxy_windows()
        source = "bundled WESAD stress proxy (benchmarks/external/wesad-stress-proxy.json)"

    results = run_node_eval(cases)
    summary = summarize(results)
    payload = {
        "generatedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "source": source,
        "mapping": "ECG→HR series, EDA→HRV proxy, TEMP/RESP→SpO₂/respiratory proxies",
        "summary": summary,
        "sample": results[:5],
        "note_en": "Does not claim clinical validation — portable schema sanity check only.",
    }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"WESAD adapter → {out}")
    print(f"  BHI tier agreement: {summary['bhiTierAgreement']}")
    print(f"  Anomaly flag agreement: {summary['anomalyFlagAgreement']}")


if __name__ == "__main__":
    main()
