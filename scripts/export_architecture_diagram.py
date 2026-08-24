#!/usr/bin/env python3
"""
Export MedWear system architecture diagram for SCI-style publications.
Outputs PDF, SVG, and 300 DPI PNG to ~/Desktop/MedWear-Architecture-Diagram/
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch, Rectangle

# SCI-style typography (Arial/Helvetica fallback)
plt.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["Arial", "Helvetica", "DejaVu Sans"],
    "font.size": 9,
    "axes.linewidth": 0.8,
    "pdf.fonttype": 42,
    "ps.fonttype": 42,
})

OUT_DIR = Path.home() / "Desktop" / "MedWear-Architecture-Diagram"

# Colorblind-friendly, print-safe palette
C_DEMO = "#E3F2FD"
C_DEMO_EDGE = "#1565C0"
C_REAL = "#FFF3E0"
C_REAL_EDGE = "#E65100"
C_SHARED = "#F5F5F5"
C_SHARED_EDGE = "#424242"
C_ENGINE = "#E8F5E9"
C_ENGINE_EDGE = "#2E7D32"
C_OUTPUT = "#F3E5F5"
C_OUTPUT_EDGE = "#6A1B9A"
C_ARROW = "#212121"
C_ISOLATION = "#C62828"


def box(ax, xy, w, h, text, face, edge, fontsize=8.5, bold=False, sub=None):
    x, y = xy
    patch = FancyBboxPatch(
        (x, y), w, h,
        boxstyle="round,pad=0.012,rounding_size=0.08",
        linewidth=1.2,
        edgecolor=edge,
        facecolor=face,
        zorder=2,
    )
    ax.add_patch(patch)
    weight = "bold" if bold else "normal"
    if sub:
        ax.text(
            x + w / 2, y + h * 0.62, text,
            ha="center", va="center", fontsize=fontsize, fontweight=weight, zorder=3,
        )
        ax.text(
            x + w / 2, y + h * 0.32, sub,
            ha="center", va="center", fontsize=fontsize - 1.2, color="#424242", zorder=3,
        )
    else:
        ax.text(
            x + w / 2, y + h / 2, text,
            ha="center", va="center", fontsize=fontsize, fontweight=weight, zorder=3,
        )
    return patch


def arrow(ax, start, end, style="-|>", lw=1.2, color=C_ARROW, linestyle="solid", rad=0.0):
    arr = FancyArrowPatch(
        start, end,
        arrowstyle=style,
        mutation_scale=12,
        linewidth=lw,
        color=color,
        linestyle=linestyle,
        connectionstyle=f"arc3,rad={rad}",
        zorder=1,
    )
    ax.add_patch(arr)
    return arr


def draw_diagram():
    fig, ax = plt.subplots(figsize=(7.2, 9.6))  # ~183 mm width at print scale
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 13.5)
    ax.axis("off")

    # Title
    ax.text(
        5, 13.05,
        "MedWear System Architecture and Data Flow",
        ha="center", va="center", fontsize=12, fontweight="bold",
    )
    ax.text(
        5, 12.65,
        "Research-grade digital phenotyping · local-first · dual-mode isolation",
        ha="center", va="center", fontsize=8.5, color="#616161",
    )

    # --- Layer 1: Data sources (isolated paths) ---
    ax.text(5, 12.15, "Layer 1 — Data sources (mode-isolated)", ha="center", fontsize=8.5, fontweight="bold")

    box(
        ax, (0.55, 10.55), 4.0, 1.35,
        "Demo mode",
        C_DEMO, C_DEMO_EDGE, bold=True,
        sub="Synthetic cohort (seed = 42)\nJSON benchmark · no PHI",
    )
    box(
        ax, (5.45, 10.55), 4.0, 1.35,
        "Real mode",
        C_REAL, C_REAL_EDGE, bold=True,
        sub="Apple Health export.zip\nexport.xml · on-device only",
    )

    # Isolation barrier
    barrier = Rectangle((4.72, 10.35), 0.56, 1.75, linewidth=0, facecolor="white", zorder=4)
    ax.add_patch(barrier)
    ax.plot([5, 5], [10.35, 12.1], color=C_ISOLATION, linewidth=1.5, linestyle=(0, (4, 3)), zorder=5)
    ax.text(5, 12.25, "isolated", ha="center", fontsize=7, color=C_ISOLATION, rotation=90)

    # --- Layer 2: Ingest ---
    ax.text(5, 9.95, "Layer 2 — Ingestion", ha="center", fontsize=8.5, fontweight="bold")

    box(
        ax, (0.55, 8.55), 4.0, 1.15,
        "In-memory demo store",
        C_DEMO, C_DEMO_EDGE,
        sub="Pre-built synthetic vitals",
    )
    box(
        ax, (5.45, 8.55), 4.0, 1.15,
        "Streaming SAX XML parser",
        C_REAL, C_REAL_EDGE,
        sub="Batch ingest → SQLite DAO",
    )

    arrow(ax, (2.55, 10.55), (2.55, 9.72), color=C_DEMO_EDGE, linestyle="--")
    arrow(ax, (7.45, 10.55), (7.45, 9.72), color=C_REAL_EDGE)

    # --- Layer 3: Local persistence ---
    ax.text(5, 8.15, "Layer 3 — Local persistence", ha="center", fontsize=8.5, fontweight="bold")

    box(
        ax, (1.8, 6.85), 6.4, 1.05,
        "SQLite local database",
        C_SHARED, C_SHARED_EDGE, bold=True,
        sub="data/medwear-health.db · AES-256-GCM vault (optional backup)",
    )

    arrow(ax, (2.55, 8.55), (3.6, 7.92), color=C_DEMO_EDGE, linestyle="--", rad=0.08)
    arrow(ax, (7.45, 8.55), (6.4, 7.92), color=C_REAL_EDGE, rad=-0.08)

    # --- Layer 4: Analytics engine ---
    ax.text(
        5, 6.45,
        "Layer 4 — Analytics engine (MedWear-AnalyticsCore-v1)",
        ha="center", fontsize=8.5, fontweight="bold",
    )

    engine_y = 4.55
    ew, eh = 2.05, 1.55
    gap = 0.18
    xs = [0.55, 0.55 + ew + gap, 0.55 + 2 * (ew + gap), 0.55 + 3 * (ew + gap)]
    labels = [
        ("BHI scoring", "Behavioral Health\nIndex (0–100)"),
        ("Threshold alerts", "Tachycardia · hypoxemia\npeak / single-reading"),
        ("MAD anomaly", "Robust Z-score\nmedian + MAD baseline"),
        ("Rule engine", "MedWear-RuleEngine-v1\n(+ optional ONNX)"),
    ]
    for x, (title, sub) in zip(xs, labels):
        box(ax, (x, engine_y), ew, eh, title, C_ENGINE, C_ENGINE_EDGE, bold=True, sub=sub)

    arrow(ax, (5, 6.85), (5, 6.12))

    # --- Layer 5: Outputs ---
    ax.text(5, 4.05, "Layer 5 — Outputs", ha="center", fontsize=8.5, fontweight="bold")

    box(
        ax, (1.2, 2.55), 7.6, 1.25,
        "Screening UI · clinician reports · XAI charts",
        C_OUTPUT, C_OUTPUT_EDGE, bold=True,
        sub="Dashboard · import · research center · methodology transparency API",
    )

    arrow(ax, (5, 4.55), (5, 3.82))

    # Side annotation: optional ONNX / benchmark branch
    box(
        ax, (0.55, 0.55), 4.0, 1.35,
        "Optional ONNX inference",
        "#ECEFF1", "#455A64",
        sub="medwear_rf.onnx · 17-dim features\nbenchmark: npm run benchmark:system",
    )
    box(
        ax, (5.45, 0.55), 4.0, 1.35,
        "Evaluation & reproduction",
        "#ECEFF1", "#455A64",
        sub="Independent gold labels · seed = 42\nJupyter notebook · CI pipeline",
    )
    arrow(ax, (7.1, 4.55), (7.5, 1.92), color="#455A64", linestyle=":", rad=-0.15)
    arrow(ax, (2.9, 4.55), (2.5, 1.92), color="#455A64", linestyle=":", rad=0.15)

    # Legend
    legend_y = 0.15
    demo_patch = mpatches.Patch(facecolor=C_DEMO, edgecolor=C_DEMO_EDGE, label="Demo path (synthetic, dashed)")
    real_patch = mpatches.Patch(facecolor=C_REAL, edgecolor=C_REAL_EDGE, label="Real path (Apple Health, solid)")
    shared_patch = mpatches.Patch(facecolor=C_SHARED, edgecolor=C_SHARED_EDGE, label="Shared local processing")
    ax.legend(
        handles=[demo_patch, real_patch, shared_patch],
        loc="lower center",
        bbox_to_anchor=(0.5, -0.02),
        ncol=3,
        frameon=False,
        fontsize=7.5,
    )

    # Caption block (for manuscript)
    caption = (
        "Figure. End-to-end data flow of the MedWear wearable analytics platform. "
        "Demo and real modes remain isolated at ingestion; both converge on local SQLite storage "
        "before transparent BHI scoring, threshold alerts, MAD-based anomaly detection, and "
        "rule-engine outputs. Not a clinical diagnostic device."
    )
    fig.text(0.5, 0.01, caption, ha="center", va="bottom", fontsize=7, wrap=True, color="#424242")

    fig.subplots_adjust(left=0.04, right=0.96, top=0.98, bottom=0.08)
    return fig


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    fig = draw_diagram()

    png = OUT_DIR / "MedWear_Architecture_Flowchart.png"
    pdf = OUT_DIR / "MedWear_Architecture_Flowchart.pdf"
    svg = OUT_DIR / "MedWear_Architecture_Flowchart.svg"
    caption_txt = OUT_DIR / "figure_caption.txt"

    fig.savefig(png, dpi=300, bbox_inches="tight", facecolor="white")
    fig.savefig(pdf, bbox_inches="tight", facecolor="white")
    fig.savefig(svg, bbox_inches="tight", facecolor="white")
    plt.close(fig)

    caption_txt.write_text(
        "MedWear Architecture Flowchart — exported "
        f"{datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n"
        "Files:\n"
        "  MedWear_Architecture_Flowchart.pdf  (vector, preferred for LaTeX)\n"
        "  MedWear_Architecture_Flowchart.svg  (vector, editable)\n"
        "  MedWear_Architecture_Flowchart.png  (300 DPI raster)\n\n"
        "Suggested LaTeX caption:\n"
        "Figure X. End-to-end data flow of the MedWear wearable analytics platform. "
        "Demo mode (synthetic cohort, seed = 42) and real mode (Apple Health ZIP/XML) "
        "are isolated at ingestion. Both paths persist data locally (SQLite) before "
        "BHI scoring, threshold alerts, MAD robust Z-score anomaly detection, and "
        "rule-engine outputs are rendered in the screening UI. Optional ONNX inference "
        "and benchmark scripts support reproducibility evaluation. "
        "The system is intended for research-grade digital phenotyping and simulation "
        "benchmarking—not clinical diagnosis.\n",
        encoding="utf-8",
    )

    print(f"Exported to {OUT_DIR}")
    for p in (pdf, svg, png, caption_txt):
        print(f"  → {p}")


if __name__ == "__main__":
    main()
