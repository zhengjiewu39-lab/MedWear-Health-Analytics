#!/usr/bin/env python3
"""
MedWear system benchmarks — export tables + line charts to Desktop.

1. Inference latency & throughput: ONNX Runtime vs native sklearn RF (batch sizes)
2. Storage: high-frequency time series in SQLite vs DuckDB (write/read/disk)
3. MAD robustness: F1 vs injected noise SNR 20 dB → 5 dB
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import statistics
import sys
import tempfile
import time
from datetime import datetime, timedelta
from pathlib import Path

import duckdb
import joblib
import matplotlib.pyplot as plt
import numpy as np
import onnxruntime as ort
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import f1_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
ONNX_PATH = ROOT / "server" / "ai" / "models" / "medwear_rf.onnx"
META_PATH = ROOT / "server" / "ai" / "models" / "medwear_rf.meta.json"
FEATURES_CSV = ROOT / "experiments" / "data" / "medwear" / "features_v1.csv"

FEATURE_COLS = [
    "steps_norm", "avg_hr", "std_hr", "resting_hr", "avg_spo2", "min_spo2", "avg_hrv",
    "sleep_hours", "deep_sleep_ratio", "active_energy_norm", "hr_above_threshold",
    "spo2_below_threshold", "low_activity", "window_hr_mean", "window_hr_std",
    "anomaly_flag", "health_score_norm",
]

BATCH_SIZES = [1, 4, 8, 16, 32, 64, 128, 256]
SNR_LEVELS_DB = [20, 17, 14, 11, 8, 5]
MAD_OPTS = {
    "window_days": 14,
    "hr_mad_k": 2.5,
    "spo2_mad_k": 2.0,
    "min_baseline_readings": 10,
    "activity_steps_threshold": 6500,
    "hr_spike_min_count": 3,
    "spo2_low_min_count": 2,
}


def default_output_dir() -> Path:
    desktop = Path.home() / "Desktop" / "MedWear-System-Benchmark"
    desktop.mkdir(parents=True, exist_ok=True)
    return desktop


def save_figure(fig, path: Path, title: str) -> None:
    fig.suptitle(title, fontsize=13, fontweight="bold")
    fig.tight_layout()
    fig.savefig(path, dpi=160, bbox_inches="tight")
    plt.close(fig)
    print(f"  → chart {path}")


def load_feature_matrix(n_rows: int | None = None) -> np.ndarray:
    if FEATURES_CSV.exists():
        df = pd.read_csv(FEATURES_CSV)
        cols = [c for c in FEATURE_COLS if c in df.columns]
        X = df[cols].astype(float).values
        if n_rows and len(X) > n_rows:
            rng = np.random.default_rng(42)
            X = X[rng.choice(len(X), n_rows, replace=False)]
        return X
    rng = np.random.default_rng(42)
    return rng.normal(0, 1, size=(max(n_rows or 5000, 512), len(FEATURE_COLS))).astype(np.float32)


def build_sklearn_pipeline(X: np.ndarray, y: np.ndarray) -> Pipeline:
    pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        ("clf", RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)),
    ])
    pipe.fit(X, y)
    return pipe


def load_or_train_sklearn(X: np.ndarray) -> Pipeline:
    cache = ROOT / "experiments" / "results" / "benchmark_rf.joblib"
    if cache.exists():
        return joblib.load(cache)["pipe"]
    if FEATURES_CSV.exists():
        df = pd.read_csv(FEATURES_CSV)
        cols = [c for c in FEATURE_COLS if c in df.columns]
        X_train = df[cols].astype(float).values
        y_train = df["label"].astype(str).values
    else:
        X_train = X
        y_train = np.array(["low", "moderate", "high"])[np.argmax(X_train[:, :3], axis=1) % 3]
    pipe = build_sklearn_pipeline(X_train, y_train)
    cache.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"pipe": pipe}, cache)
    return pipe


def benchmark_inference(out_dir: Path, repeats: int = 30) -> pd.DataFrame:
    print("\n[1/3] Inference latency & throughput (ONNX vs sklearn RF)")
    if not ONNX_PATH.exists():
        raise FileNotFoundError(f"Missing ONNX model: {ONNX_PATH}")

    meta = json.loads(META_PATH.read_text(encoding="utf-8"))
    session = ort.InferenceSession(str(ONNX_PATH), providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    label_output = next(
        (o.name for o in session.get_outputs() if "label" in o.name),
        session.get_outputs()[0].name,
    )

    X_pool = load_feature_matrix(5000)
    y_pool = np.zeros(len(X_pool), dtype=int)  # placeholder for sklearn
    if FEATURES_CSV.exists():
        df = pd.read_csv(FEATURES_CSV)
        if len(df) >= len(X_pool):
            y_pool = pd.Categorical(df["label"].iloc[: len(X_pool)]).codes
    sklearn_pipe = load_or_train_sklearn(X_pool)

    rows = []
    for batch in BATCH_SIZES:
        if batch > len(X_pool):
            continue
        batch_x = X_pool[:batch].astype(np.float32)

        # warmup
        for _ in range(3):
            session.run([label_output], {input_name: batch_x})
            sklearn_pipe.predict(batch_x)

        onnx_latencies = []
        for _ in range(repeats):
            t0 = time.perf_counter()
            session.run([label_output], {input_name: batch_x})
            onnx_latencies.append((time.perf_counter() - t0) * 1000)

        sk_latencies = []
        for _ in range(repeats):
            t0 = time.perf_counter()
            sklearn_pipe.predict(batch_x)
            sk_latencies.append((time.perf_counter() - t0) * 1000)

        onnx_mean = statistics.mean(onnx_latencies)
        sk_mean = statistics.mean(sk_latencies)
        rows.append({
            "batch_size": batch,
            "onnx_mean_ms": round(onnx_mean, 4),
            "onnx_p95_ms": round(float(np.percentile(onnx_latencies, 95)), 4),
            "onnx_throughput_samples_per_s": round(batch / (onnx_mean / 1000), 1),
            "sklearn_mean_ms": round(sk_mean, 4),
            "sklearn_p95_ms": round(float(np.percentile(sk_latencies, 95)), 4),
            "sklearn_throughput_samples_per_s": round(batch / (sk_mean / 1000), 1),
            "speedup_onnx_vs_sklearn": round(sk_mean / onnx_mean, 3) if onnx_mean else None,
            "model_id": meta.get("model_id", "medwear_rf"),
            "feature_dim": len(FEATURE_COLS),
        })
        print(f"  batch={batch:4d}  ONNX {onnx_mean:.3f} ms  sklearn {sk_mean:.3f} ms")

    df = pd.DataFrame(rows)
    csv_path = out_dir / "inference_latency.csv"
    df.to_csv(csv_path, index=False)
    print(f"  → table {csv_path}")

    fig, axes = plt.subplots(1, 2, figsize=(12, 4.5))
    axes[0].plot(df["batch_size"], df["onnx_mean_ms"], "o-", label="ONNX Runtime", color="#1565C0", linewidth=2)
    axes[0].plot(df["batch_size"], df["sklearn_mean_ms"], "s-", label="sklearn RF (Python)", color="#EF6C00", linewidth=2)
    axes[0].set_xlabel("Batch size")
    axes[0].set_ylabel("Mean latency (ms)")
    axes[0].set_title("Inference latency")
    axes[0].set_xscale("log", base=2)
    axes[0].grid(True, alpha=0.3)
    axes[0].legend()

    axes[1].plot(df["batch_size"], df["onnx_throughput_samples_per_s"], "o-", label="ONNX Runtime", color="#1565C0", linewidth=2)
    axes[1].plot(df["batch_size"], df["sklearn_throughput_samples_per_s"], "s-", label="sklearn RF (Python)", color="#EF6C00", linewidth=2)
    axes[1].set_xlabel("Batch size")
    axes[1].set_ylabel("Throughput (samples/s)")
    axes[1].set_title("Inference throughput")
    axes[1].set_xscale("log", base=2)
    axes[1].grid(True, alpha=0.3)
    axes[1].legend()

    save_figure(fig, out_dir / "inference_latency.png", "MedWear — ONNX vs Python inference by batch size")
    return df


def generate_timeseries_rows(n_rows: int, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    base = datetime(2026, 1, 1)
    metrics = ["heart_rate", "spo2", "hrv", "steps", "resp_rate"]
    rows = []
    for i in range(n_rows):
        day_offset = i % 14
        hour = (i // 14) % 24
        minute = (i // (14 * 24)) % 60
        ts = base + timedelta(days=day_offset, hours=hour, minutes=minute)
        metric = metrics[i % len(metrics)]
        if metric == "heart_rate":
            val = 68 + rng.normal(0, 5)
        elif metric == "spo2":
            val = 97 + rng.normal(0, 0.8)
        elif metric == "hrv":
            val = 45 + rng.normal(0, 8)
        elif metric == "steps":
            val = rng.integers(0, 120)
        else:
            val = 16 + rng.normal(0, 2)
        rows.append({
            "ts": ts.isoformat(),
            "day": ts.strftime("%Y-%m-%d"),
            "metric": metric,
            "value": float(val),
            "hour": hour,
        })
    return pd.DataFrame(rows)


def benchmark_storage(out_dir: Path, n_rows: int = 600_000) -> pd.DataFrame:
    print(f"\n[2/3] Storage performance (SQLite vs DuckDB, n={n_rows:,} readings)")
    df = generate_timeseries_rows(n_rows)

    with tempfile.TemporaryDirectory() as tmp:
        sqlite_path = Path(tmp) / "readings.sqlite"
        duck_path = Path(tmp) / "readings.duckdb"

        # --- SQLite write ---
        t0 = time.perf_counter()
        con = sqlite3.connect(sqlite_path)
        con.execute("""
            CREATE TABLE readings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              ts TEXT NOT NULL,
              day TEXT NOT NULL,
              metric TEXT NOT NULL,
              value REAL NOT NULL,
              hour INTEGER
            )
        """)
        con.execute("CREATE INDEX idx_readings_day_metric ON readings(day, metric)")
        con.executemany(
            "INSERT INTO readings (ts, day, metric, value, hour) VALUES (?,?,?,?,?)",
            df[["ts", "day", "metric", "value", "hour"]].itertuples(index=False, name=None),
        )
        con.commit()
        sqlite_write_ms = (time.perf_counter() - t0) * 1000
        sqlite_bytes = sqlite_path.stat().st_size

        t0 = time.perf_counter()
        cur = con.execute("""
            SELECT day, metric, AVG(value) AS avg_val, COUNT(*) AS n
            FROM readings GROUP BY day, metric ORDER BY day, metric
        """)
        sqlite_read_rows = len(cur.fetchall())
        sqlite_read_ms = (time.perf_counter() - t0) * 1000
        con.close()

        # --- DuckDB write ---
        t0 = time.perf_counter()
        dcon = duckdb.connect(str(duck_path))
        dcon.execute("""
            CREATE TABLE readings (
              ts TIMESTAMP,
              day DATE,
              metric VARCHAR,
              value DOUBLE,
              hour INTEGER
            )
        """)
        dcon.register("batch_df", df)
        dcon.execute("INSERT INTO readings SELECT CAST(ts AS TIMESTAMP), CAST(day AS DATE), metric, value, hour FROM batch_df")
        duck_write_ms = (time.perf_counter() - t0) * 1000
        duck_bytes = duck_path.stat().st_size

        t0 = time.perf_counter()
        duck_read_rows = len(dcon.execute("""
            SELECT day, metric, AVG(value) AS avg_val, COUNT(*) AS n
            FROM readings GROUP BY day, metric ORDER BY day, metric
        """).fetchdf())
        duck_read_ms = (time.perf_counter() - t0) * 1000
        dcon.close()

    result = pd.DataFrame([
        {
            "engine": "SQLite",
            "rows": n_rows,
            "write_ms": round(sqlite_write_ms, 2),
            "read_aggregate_ms": round(sqlite_read_ms, 2),
            "disk_mb": round(sqlite_bytes / (1024 * 1024), 3),
            "read_result_rows": sqlite_read_rows,
            "write_rows_per_s": round(n_rows / (sqlite_write_ms / 1000), 0),
        },
        {
            "engine": "DuckDB",
            "rows": n_rows,
            "write_ms": round(duck_write_ms, 2),
            "read_aggregate_ms": round(duck_read_ms, 2),
            "disk_mb": round(duck_bytes / (1024 * 1024), 3),
            "read_result_rows": duck_read_rows,
            "write_rows_per_s": round(n_rows / (duck_write_ms / 1000), 0),
        },
    ])
    csv_path = out_dir / "storage_performance.csv"
    result.to_csv(csv_path, index=False)
    print(f"  SQLite write {sqlite_write_ms:.0f} ms, read {sqlite_read_ms:.0f} ms, {sqlite_bytes/1e6:.2f} MB")
    print(f"  DuckDB write {duck_write_ms:.0f} ms, read {duck_read_ms:.0f} ms, {duck_bytes/1e6:.2f} MB")
    print(f"  → table {csv_path}")

    fig, axes = plt.subplots(1, 2, figsize=(11, 4.5))
    engines = result["engine"]
    x = np.arange(len(engines))
    w = 0.35
    axes[0].bar(x - w / 2, result["write_ms"], width=w, label="Bulk write (ms)", color="#2E7D32")
    axes[0].bar(x + w / 2, result["read_aggregate_ms"], width=w, label="Aggregate read (ms)", color="#00838F")
    axes[0].set_xticks(x, engines)
    axes[0].set_ylabel("Milliseconds")
    axes[0].set_title("Read / write latency")
    axes[0].legend()
    axes[0].grid(axis="y", alpha=0.3)

    axes[1].bar(engines, result["disk_mb"], color=["#5C6BC0", "#FF7043"])
    axes[1].set_ylabel("On-disk size (MB)")
    axes[1].set_title("Disk footprint")
    axes[1].grid(axis="y", alpha=0.3)

    save_figure(fig, out_dir / "storage_performance.png", f"MedWear — time-series storage ({n_rows:,} rows)")
    return result


# --- MAD anomaly (Python port of server/services/robustAnomaly.js) ---

def _median(arr):
    if not arr:
        return None
    s = sorted(arr)
    m = len(s) // 2
    return s[m] if len(s) % 2 else (s[m - 1] + s[m]) / 2


def _mad(arr):
    med = _median(arr)
    if med is None:
        return 1e-6
    return _median([abs(x - med) for x in arr]) or 1e-6


def _robust_z(value, baseline):
    if not baseline:
        return 0.0
    med = _median(baseline)
    scale = _mad(baseline) * 1.4826
    if not scale:
        return 0.0
    return (value - med) / scale


def detect_mad_anomaly(daily: dict, opts: dict | None = None) -> bool:
    o = {**MAD_OPTS, **(opts or {})}
    days = sorted(daily.keys())[-o["window_days"] :]
    baseline_hr, baseline_spo2 = [], []
    for day in days:
        d = daily[day]
        if (d.get("steps") or 0) < o["activity_steps_threshold"]:
            baseline_hr.extend(d.get("heart_rate", []))
        baseline_spo2.extend(d.get("spo2", []))

    if len(baseline_hr) < o["min_baseline_readings"]:
        return False

    hr_med = _median(baseline_hr)
    hr_scale = _mad(baseline_hr) * 1.4826
    spo2_med = _median(baseline_spo2)
    spo2_scale = max(_mad(baseline_spo2) * 1.4826, 0.35)

    for day in days:
        d = daily[day]
        hrs = d.get("heart_rate", [])
        high_activity = (d.get("steps") or 0) >= o["activity_steps_threshold"]
        if not high_activity and hr_scale > 0:
            spikes = [h for h in hrs if _robust_z(h, baseline_hr) > o["hr_mad_k"]]
            if len(spikes) >= o["hr_spike_min_count"]:
                return True
        spo2s = d.get("spo2", [])
        spo2_threshold = spo2_med - o["spo2_mad_k"] * spo2_scale
        low = [s for s in spo2s if s < spo2_threshold]
        if len(low) >= o["spo2_low_min_count"]:
            return True
    return False


def synth_daily_store(rng, inject_anomaly: bool) -> dict:
    daily = {}
    for i in range(14):
        day = f"2026-03-{i+1:02d}"
        hr = [68 + rng.normal(0, 2) for _ in range(12)]
        spo2 = [97 + rng.normal(0, 0.3) for _ in range(12)]
        steps = int(rng.integers(3000, 5500))
        if inject_anomaly and i >= 10:
            hr.extend([95 + rng.normal(0, 1) for _ in range(4)])
            spo2.extend([91 + rng.normal(0, 0.2) for _ in range(3)])
        daily[day] = {"steps": steps, "heart_rate": hr, "spo2": spo2}
    return daily


def add_noise_to_store(daily: dict, snr_db: float, rng) -> dict:
    noisy = {}
    for day, d in daily.items():
        nd = dict(d)
        for key in ("heart_rate", "spo2"):
            series = np.array(d.get(key, []), dtype=float)
            if len(series) == 0:
                continue
            power = np.mean(series ** 2) + 1e-9
            noise_power = power / (10 ** (snr_db / 10))
            noise = rng.normal(0, np.sqrt(noise_power), size=series.shape)
            nd[key] = (series + noise).tolist()
        noisy[day] = nd
    return noisy


def benchmark_mad_snr(out_dir: Path, n_cases: int = 400, seed: int = 42) -> pd.DataFrame:
    print(f"\n[3/3] MAD robustness vs noise SNR 20→5 dB (n={n_cases} synthetic stores)")
    rng = np.random.default_rng(seed)
    rows = []
    for snr in SNR_LEVELS_DB:
        y_true, y_pred = [], []
        for _ in range(n_cases):
            inject = rng.random() < 0.5
            store = synth_daily_store(rng, inject_anomaly=inject)
            noisy = add_noise_to_store(store, snr, rng)
            pred = detect_mad_anomaly(noisy)
            y_true.append(inject)
            y_pred.append(pred)
        f1 = f1_score(y_true, y_pred, zero_division=0)
        rows.append({
            "snr_db": snr,
            "f1_score": round(float(f1), 4),
            "n_cases": n_cases,
            "positive_rate": round(sum(y_true) / len(y_true), 3),
            "detected_rate": round(sum(y_pred) / len(y_pred), 3),
        })
        print(f"  SNR {snr:2d} dB  F1={f1:.4f}")

    df = pd.DataFrame(rows)
    csv_path = out_dir / "mad_snr_robustness.csv"
    df.to_csv(csv_path, index=False)
    print(f"  → table {csv_path}")

    fig, ax = plt.subplots(figsize=(8, 5))
    ax.plot(df["snr_db"], df["f1_score"], "o-", color="#C62828", linewidth=2.5, markersize=8)
    ax.set_xlabel("Signal-to-noise ratio (dB)")
    ax.set_ylabel("MAD anomaly detection F1-score")
    ax.set_title("MAD heuristic F1 vs injected noise")
    ax.set_xticks(SNR_LEVELS_DB)
    ax.set_ylim(0, 1.05)
    ax.grid(True, alpha=0.3)
    ax.invert_xaxis()
    save_figure(fig, out_dir / "mad_snr_robustness.png", "MedWear — MAD F1 decay under noise (20 dB → 5 dB)")
    return df


def write_summary(out_dir: Path, inference_df, storage_df, mad_df) -> None:
    summary = out_dir / "benchmark_summary.md"
    lines = [
        "# MedWear System Benchmark",
        "",
        f"Generated: {datetime.now().isoformat(timespec='seconds')}",
        "",
        "## 1. Inference (ONNX vs sklearn RF)",
        "",
        f"- Batch sizes: {list(inference_df['batch_size'])}",
        f"- ONNX batch-1 mean latency: {inference_df['onnx_mean_ms'].iloc[0]} ms",
        f"- sklearn batch-1 mean latency: {inference_df['sklearn_mean_ms'].iloc[0]} ms",
        "",
        "## 2. Storage (SQLite vs DuckDB)",
        "",
        f"- SQLite bulk write: {storage_df.loc[storage_df.engine == 'SQLite', 'write_ms'].iloc[0]} ms",
        f"- DuckDB bulk write: {storage_df.loc[storage_df.engine == 'DuckDB', 'write_ms'].iloc[0]} ms",
        f"- SQLite disk: {storage_df.loc[storage_df.engine == 'SQLite', 'disk_mb'].iloc[0]} MB",
        f"- DuckDB disk: {storage_df.loc[storage_df.engine == 'DuckDB', 'disk_mb'].iloc[0]} MB",
        "",
        "## 3. MAD F1 vs SNR (20 dB → 5 dB)",
        "",
        f"- F1 @ 20 dB: {mad_df.loc[mad_df.snr_db == 20, 'f1_score'].iloc[0]}",
        f"- F1 @ 5 dB: {mad_df.loc[mad_df.snr_db == 5, 'f1_score'].iloc[0]}",
        "",
        "## Artifacts",
        "- `inference_latency.csv` / `.png`",
        "- `storage_performance.csv` / `.png`",
        "- `mad_snr_robustness.csv` / `.png`",
    ]
    summary.write_text("\n".join(lines), encoding="utf-8")
    print(f"\n  → summary {summary}")


def main():
    parser = argparse.ArgumentParser(description="MedWear system benchmark suite")
    parser.add_argument("--out", type=Path, default=None, help="Output directory (default: ~/Desktop/MedWear-System-Benchmark)")
    parser.add_argument("--storage-rows", type=int, default=600_000)
    parser.add_argument("--mad-cases", type=int, default=400)
    parser.add_argument("--repeats", type=int, default=30)
    args = parser.parse_args()

    out_dir = args.out or default_output_dir()
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"MedWear system benchmark → {out_dir}")
    inference_df = benchmark_inference(out_dir, repeats=args.repeats)
    storage_df = benchmark_storage(out_dir, n_rows=args.storage_rows)
    mad_df = benchmark_mad_snr(out_dir, n_cases=args.mad_cases)
    write_summary(out_dir, inference_df, storage_df, mad_df)
    print("\nDone. Tables and charts exported to Desktop.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
