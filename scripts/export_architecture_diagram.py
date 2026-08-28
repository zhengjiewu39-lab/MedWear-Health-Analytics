#!/usr/bin/env python3
"""
Export MedWear system architecture flowchart for Springer / Health and Technology.

Main figure (Figure 1): research-oriented labels, no title/caption embedded.
Supplementary figure: optional ONNX inference path (not part of main benchmark).

Outputs PDF, SVG, and 600 DPI PNG to ~/Desktop/MedWear-Architecture-Diagram/
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch, Rectangle

# Springer combination artwork: Arial/Helvetica, vector fonts for PDF
plt.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["Arial", "Helvetica", "DejaVu Sans"],
    "font.size": 9,
    "axes.linewidth": 0.8,
    "pdf.fonttype": 42,
    "ps.fonttype": 42,
})

OUT_DIR = Path.home() / "Desktop" / "MedWear-Architecture-Diagram"

# Print size (inches) — matches typical single-column Word embed (~6.05 × 7.42 in)
FIG_W_IN = 6.05
FIG_H_IN = 7.42
EXPORT_DPI = 600

# Colorblind-friendly palette
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
C_EVAL = "#ECEFF1"
C_EVAL_EDGE = "#455A64"


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


def draw_main_diagram():
    """Figure 1 — no embedded title or caption (manuscript text only)."""
    fig, ax = plt.subplots(figsize=(FIG_W_IN, FIG_H_IN))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 12.4)
    ax.axis("off")

    # --- Layer 1: Data sources (isolated paths) ---
    ax.text(5, 11.85, "Layer 1 — Data sources (mode-isolated)", ha="center", fontsize=8.5, fontweight="bold")

    box(
        ax, (0.55, 10.35), 4.0, 1.35,
        "Synthetic evaluation mode",
        C_DEMO, C_DEMO_EDGE, bold=True,
        sub="Synthetic cohort (seed = 42)\nJSON benchmark · no PHI",
    )
    box(
        ax, (5.45, 10.35), 4.0, 1.35,
        "Real-data mode",
        C_REAL, C_REAL_EDGE, bold=True,
        sub="Local-first primary processing path\nApple Health export.zip · structured local ingest",
    )

    barrier = Rectangle((4.72, 10.15), 0.56, 1.75, linewidth=0, facecolor="white", zorder=4)
    ax.add_patch(barrier)
    ax.plot([5, 5], [10.15, 11.9], color=C_ISOLATION, linewidth=1.5, linestyle=(0, (4, 3)), zorder=5)
    ax.text(5, 12.05, "isolated", ha="center", fontsize=7, color=C_ISOLATION, rotation=90)

    # --- Layer 2: Ingest ---
    ax.text(5, 9.75, "Layer 2 — Ingestion", ha="center", fontsize=8.5, fontweight="bold")

    box(
        ax, (0.55, 8.35), 4.0, 1.15,
        "In-memory demo store",
        C_DEMO, C_DEMO_EDGE,
        sub="Pre-built synthetic vitals",
    )
    box(
        ax, (5.45, 8.35), 4.0, 1.15,
        "Streaming SAX XML parser",
        C_REAL, C_REAL_EDGE,
        sub="Batch ingest → SQLite DAO",
    )

    arrow(ax, (2.55, 10.35), (2.55, 9.52), color=C_DEMO_EDGE, linestyle="--")
    arrow(ax, (7.45, 10.35), (7.45, 9.52), color=C_REAL_EDGE)

    # --- Layer 3: Local persistence ---
    ax.text(5, 7.95, "Layer 3 — Local persistence", ha="center", fontsize=8.5, fontweight="bold")

    box(
        ax, (1.8, 6.65), 6.4, 1.05,
        "SQLite local database",
        C_SHARED, C_SHARED_EDGE, bold=True,
        sub="data/medwear-health.db · AES-256-GCM vault (optional backup)",
    )

    arrow(ax, (2.55, 8.35), (3.6, 7.72), color=C_DEMO_EDGE, linestyle="--", rad=0.08)
    arrow(ax, (7.45, 8.35), (6.4, 7.72), color=C_REAL_EDGE, rad=-0.08)

    # --- Layer 4: Analytics engine ---
    ax.text(
        5, 6.25,
        "Layer 4 — Analytics engine (MedWear-AnalyticsCore-v1)",
        ha="center", fontsize=8.5, fontweight="bold",
    )

    engine_y = 4.35
    ew, eh = 2.05, 1.55
    gap = 0.18
    xs = [0.55, 0.55 + ew + gap, 0.55 + 2 * (ew + gap), 0.55 + 3 * (ew + gap)]
    labels = [
        ("BHI scoring", "Behavioral Health\nIndex (0–100)"),
        ("Threshold alerts", "High/low HR signals\nlow-SpO2 signals"),
        ("MAD anomaly", "Robust Z-score\nmedian + MAD baseline"),
        ("Rule engine", "MedWear-RuleEngine-v1\ninterpretable rules"),
    ]
    for x, (title, sub) in zip(xs, labels):
        box(ax, (x, engine_y), ew, eh, title, C_ENGINE, C_ENGINE_EDGE, bold=True, sub=sub)

    arrow(ax, (5, 6.65), (5, 5.92))

    # --- Layer 5: Outputs ---
    ax.text(5, 3.85, "Layer 5 — Outputs", ha="center", fontsize=8.5, fontweight="bold")

    box(
        ax, (1.2, 2.35), 7.6, 1.25,
        "Research dashboard · reports · transparent charts",
        C_OUTPUT, C_OUTPUT_EDGE, bold=True,
        sub="Import · research center · methodology transparency API",
    )

    arrow(ax, (5, 4.35), (5, 3.62))

    # --- Evaluation branch (main benchmark path) ---
    ax.text(5, 1.85, "Layer 6 — Reproducible evaluation", ha="center", fontsize=8.5, fontweight="bold")

    box(
        ax, (1.8, 0.55), 6.4, 1.15,
        "Evaluation & reproduction",
        C_EVAL, C_EVAL_EDGE, bold=True,
        sub="Independent synthetic reference labels · seed = 42\nJupyter notebook · CI pipeline",
    )

    arrow(ax, (5, 2.35), (5, 1.72), color=C_EVAL_EDGE, linestyle=":")

    # Legend
    demo_patch = mpatches.Patch(facecolor=C_DEMO, edgecolor=C_DEMO_EDGE, label="Synthetic path (dashed)")
    real_patch = mpatches.Patch(facecolor=C_REAL, edgecolor=C_REAL_EDGE, label="Real-data path (solid)")
    shared_patch = mpatches.Patch(facecolor=C_SHARED, edgecolor=C_SHARED_EDGE, label="Shared local processing")
    ax.legend(
        handles=[demo_patch, real_patch, shared_patch],
        loc="lower center",
        bbox_to_anchor=(0.5, -0.04),
        ncol=3,
        frameon=False,
        fontsize=7.5,
    )

    fig.subplots_adjust(left=0.04, right=0.96, top=0.98, bottom=0.06)
    return fig


def draw_supplementary_onnx_diagram():
    """Supplementary figure — optional ONNX path (not evaluated in main benchmark)."""
    fig, ax = plt.subplots(figsize=(5.5, 3.2))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 5.5)
    ax.axis("off")

    box(
        ax, (0.6, 3.2), 2.6, 1.2,
        "Feature export",
        C_SHARED, C_SHARED_EDGE, bold=True,
        sub="17-dim vector\nextractFeatures.js",
    )
    box(
        ax, (3.7, 3.2), 2.6, 1.2,
        "Optional ONNX",
        "#ECEFF1", "#455A64", bold=True,
        sub="medwear_rf.onnx\nnot in main benchmark",
    )
    box(
        ax, (6.8, 3.2), 2.6, 1.2,
        "Heuristic fallback",
        C_ENGINE, C_ENGINE_EDGE, bold=True,
        sub="Rule engine default\nwhen ONNX disabled",
    )

    arrow(ax, (3.2, 3.8), (3.7, 3.8))
    arrow(ax, (6.3, 3.8), (6.8, 3.8))

    box(
        ax, (2.0, 1.0), 6.0, 1.15,
        "Appendix-only ML comparison",
        C_EVAL, C_EVAL_EDGE,
        sub="Sklearn / ONNX experiments — supplementary, not primary metrics",
    )
    arrow(ax, (5, 3.2), (5, 2.18), linestyle=":", color=C_EVAL_EDGE)

    ax.text(
        5, 0.35,
        "Supplementary — not part of Figure 1 primary benchmark",
        ha="center", fontsize=7.5, color="#616161", style="italic",
    )

    fig.subplots_adjust(left=0.02, right=0.98, top=0.98, bottom=0.08)
    return fig


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # --- Main figure (Figure 1) ---
    fig_main = draw_main_diagram()
    main_stem = "MedWear_Architecture_Flowchart"
    main_png = OUT_DIR / f"{main_stem}.png"
    main_pdf = OUT_DIR / f"{main_stem}.pdf"
    main_svg = OUT_DIR / f"{main_stem}.svg"
    main_tiff = OUT_DIR / f"{main_stem}.tif"

    fig_main.savefig(main_png, dpi=EXPORT_DPI, facecolor="white")
    fig_main.savefig(main_pdf, facecolor="white")
    fig_main.savefig(main_svg, facecolor="white")
    try:
        fig_main.savefig(main_tiff, dpi=EXPORT_DPI, facecolor="white")
    except Exception:
        main_tiff = None
    plt.close(fig_main)

    # --- Supplementary ONNX figure ---
    fig_supp = draw_supplementary_onnx_diagram()
    supp_stem = "MedWear_Architecture_ONNX_Supplementary"
    supp_png = OUT_DIR / f"{supp_stem}.png"
    supp_pdf = OUT_DIR / f"{supp_stem}.pdf"
    supp_svg = OUT_DIR / f"{supp_stem}.svg"

    fig_supp.savefig(supp_png, dpi=EXPORT_DPI, bbox_inches="tight", facecolor="white", pad_inches=0.04)
    fig_supp.savefig(supp_pdf, bbox_inches="tight", facecolor="white", pad_inches=0.04)
    fig_supp.savefig(supp_svg, bbox_inches="tight", facecolor="white", pad_inches=0.04)
    plt.close(fig_supp)

    caption_txt = OUT_DIR / "figure_caption.txt"
    caption_txt.write_text(
        "MedWear Architecture Flowchart — exported "
        f"{datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n"
        "SPRINGER / HEALTH AND TECHNOLOGY NOTES\n"
        f"  • Main PNG raster: {EXPORT_DPI} DPI at {FIG_W_IN} × {FIG_H_IN} in "
        f"(≈ {int(FIG_W_IN * EXPORT_DPI)} × {int(FIG_H_IN * EXPORT_DPI)} px)\n"
        "  • Do NOT embed title or caption inside the figure artwork.\n"
        "  • Place caption in manuscript text only.\n\n"
        "FILES — Figure 1 (main)\n"
        f"  {main_stem}.pdf   (vector, preferred)\n"
        f"  {main_stem}.svg   (vector, editable)\n"
        f"  {main_stem}.png   ({EXPORT_DPI} DPI raster)\n\n"
        "FILES — Supplementary (optional ONNX, not in main benchmark)\n"
        f"  {supp_stem}.pdf\n"
        f"  {supp_stem}.svg\n"
        f"  {supp_stem}.png\n\n"
        "Suggested manuscript caption (Figure 1 — paste in Word/LaTeX, NOT in image):\n"
        "Figure 1. End-to-end data flow of the MedWear wearable digital phenotyping "
        "framework. Synthetic evaluation mode (seed = 42 benchmark cohort) and real-data "
        "mode (local-first Apple Health import) remain isolated at ingestion. Both paths "
        "persist data locally (SQLite) before BHI scoring, threshold alerts (high/low HR "
        "and low-SpO2 signals), MAD robust Z-score anomaly detection, and rule-engine "
        "outputs are rendered in the research dashboard with transparent charts. "
        "Reproducible evaluation uses independent synthetic reference labels. "
        "Not a clinical diagnostic device.\n\n"
        "Suggested supplementary caption (optional ONNX path):\n"
        "Supplementary Figure S1. Optional ONNX inference branch (medwear_rf.onnx) "
        "and appendix ML comparisons. This path is not part of the primary benchmark "
        "evaluated in the main text.\n",
        encoding="utf-8",
    )

    print(f"Exported to {OUT_DIR}")
    for p in (main_pdf, main_svg, main_png, supp_pdf, supp_svg, supp_png, caption_txt):
        if p and p.exists():
            print(f"  → {p}")
    if main_tiff and main_tiff.exists():
        print(f"  → {main_tiff}")


if __name__ == "__main__":
    main()
