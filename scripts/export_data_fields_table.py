#!/usr/bin/env python3
"""
Export concise MedWear data-field summary table (SCI-style, English).
Outputs PDF, PNG, and CSV to ~/Desktop/MedWear-Data-Fields-Table/
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

import matplotlib.pyplot as plt

plt.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["Arial", "Helvetica", "DejaVu Sans"],
    "font.size": 9,
    "pdf.fonttype": 42,
    "ps.fonttype": 42,
})

OUT_DIR = Path.home() / "Desktop" / "MedWear-Data-Fields-Table"

# Signal, Source, Aggregation, Primary use, Missing handling (brief)
ROWS = [
    (
        "StepCount",
        "Apple Health / synthetic demo (seed=42)",
        "Daily sum",
        "BHI (28%), low-activity alert",
        "Skip BHI term; re-weight remaining components",
    ),
    (
        "HeartRate",
        "Wearable samples / synthetic arrays",
        "Intraday series (mean, max, min)",
        "BHI fallback, threshold alerts, MAD baseline",
        "Drop >220 or <30 bpm at ingest; median imputation",
    ),
    (
        "RestingHeartRate",
        "Apple Health daily value / synthetic",
        "Latest value per day",
        "BHI RHR component (20%)",
        "Use mean(HR) if absent; else omit term",
    ),
    (
        "OxygenSaturation",
        "Pulse oximetry / synthetic",
        "Intraday series (mean, min)",
        "BHI (16%), SpO2 alert (<93%), MAD",
        "Normalize % ; impute out-of-range; skip if empty",
    ),
    (
        "HRV (SDNN)",
        "Apple Watch SDNN / synthetic",
        "Intraday series (mean)",
        "BHI (12%), screening context",
        "Impute outside 5-250 ms; skip if empty",
    ),
    (
        "SleepAnalysis",
        "Sleep stages (Deep/REM/Light/Awake)",
        "Stage minutes summed per day",
        "BHI sleep (24%, peak ~7.25 h)",
        "Omit sleep term if zero; optional median fill",
    ),
    (
        "ActiveEnergyBurned",
        "Apple Health / synthetic",
        "Daily sum (kcal)",
        "ML feature; activity context",
        "Default 0",
    ),
    (
        "RespiratoryRate",
        "Apple Health (optional)",
        "Intraday series",
        "Stored locally; not in BHI v1",
        "Empty array if absent",
    ),
]

HEADERS = ["Field", "Source", "Aggregation", "Use", "Missing data"]

CAPTION = (
    "Table. Summary of main wearable fields in MedWear. Real mode: local Apple Health export; "
    "demo mode: synthetic cohort (seed = 42). BHI weights re-normalize when a component is missing."
)


def export_csv(path: Path) -> None:
    import csv
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(HEADERS)
        w.writerows(ROWS)


def render_figure() -> plt.Figure:
    fig, ax = plt.subplots(figsize=(11, 6.5))
    ax.axis("off")
    ax.set_title(
        "Table 1. Main wearable data fields (MedWear)",
        fontsize=12,
        fontweight="bold",
        pad=12,
        loc="left",
    )

    col_widths = [0.14, 0.22, 0.16, 0.28, 0.20]
    table = ax.table(
        cellText=ROWS,
        colLabels=HEADERS,
        colWidths=col_widths,
        loc="upper center",
        cellLoc="left",
        bbox=[0, 0.12, 1, 0.82],
    )
    table.auto_set_font_size(False)
    table.set_fontsize(8.5)

    for (row, col), cell in table.get_celld().items():
        cell.set_edgecolor("#BDBDBD")
        cell.set_linewidth(0.6)
        if row == 0:
            cell.set_facecolor("#ECEFF1")
            cell.set_text_props(fontweight="bold")
            cell.set_height(0.06)
        else:
            cell.set_facecolor("#FFFFFF" if row % 2 else "#FAFAFA")
            cell.set_height(0.07)
        cell.PAD = 0.05

    fig.text(0.02, 0.02, CAPTION, ha="left", va="bottom", fontsize=7.5, color="#424242")
    return fig


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    fig = render_figure()

    png = OUT_DIR / "MedWear_Data_Fields_Summary.png"
    pdf = OUT_DIR / "MedWear_Data_Fields_Summary.pdf"
    csv = OUT_DIR / "MedWear_Data_Fields_Summary.csv"

    fig.savefig(png, dpi=300, bbox_inches="tight", facecolor="white")
    fig.savefig(pdf, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    export_csv(csv)

    (OUT_DIR / "table_notes.txt").write_text(
        f"Exported {datetime.now():%Y-%m-%d %H:%M}\n\n{CAPTION}\n",
        encoding="utf-8",
    )

    print(f"Exported to {OUT_DIR}")
    for p in (pdf, png, csv):
        print(f"  -> {p}")


if __name__ == "__main__":
    main()
