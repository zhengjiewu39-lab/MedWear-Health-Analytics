#!/usr/bin/env python3
"""
Export BHI algorithm pipeline flowchart (SCI publication style).
Outputs PDF, SVG, PNG to ~/Desktop/MedWear-BHI-Flowchart/
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch, Polygon

plt.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["Arial", "Helvetica", "DejaVu Sans"],
    "font.size": 9,
    "pdf.fonttype": 42,
    "ps.fonttype": 42,
})

OUT_DIR = Path.home() / "Desktop" / "MedWear-BHI-Flowchart"

C_INPUT = "#E3F2FD"
C_INPUT_E = "#1565C0"
C_PROC = "#E8F5E9"
C_PROC_E = "#2E7D32"
C_DEC = "#FFF8E1"
C_DEC_E = "#F57F17"
C_MATH = "#F3E5F5"
C_MATH_E = "#6A1B9A"
C_OUT = "#ECEFF1"
C_OUT_E = "#37474F"
C_ARROW = "#212121"


def box(ax, cx, cy, w, h, text, face, edge, fontsize=8.5, bold=False, sub=None):
    x, y = cx - w / 2, cy - h / 2
    patch = FancyBboxPatch(
        (x, y), w, h,
        boxstyle="round,pad=0.02,rounding_size=0.06",
        linewidth=1.2, edgecolor=edge, facecolor=face, zorder=2,
    )
    ax.add_patch(patch)
    weight = "bold" if bold else "normal"
    if sub:
        ax.text(cx, cy + 0.12, text, ha="center", va="center", fontsize=fontsize,
                fontweight=weight, zorder=3)
        ax.text(cx, cy - 0.18, sub, ha="center", va="center", fontsize=fontsize - 1.3,
                color="#424242", zorder=3)
    else:
        ax.text(cx, cy, text, ha="center", va="center", fontsize=fontsize,
                fontweight=weight, zorder=3)
    return patch


def diamond(ax, cx, cy, w, h, text, face, edge, fontsize=8):
    pts = [(cx, cy + h / 2), (cx + w / 2, cy), (cx, cy - h / 2), (cx - w / 2, cy)]
    patch = Polygon(pts, closed=True, linewidth=1.2, edgecolor=edge, facecolor=face, zorder=2)
    ax.add_patch(patch)
    ax.text(cx, cy, text, ha="center", va="center", fontsize=fontsize, zorder=3)
    return patch


def arrow(ax, x1, y1, x2, y2, label=None, rad=0.0, fontsize=7):
    arr = FancyArrowPatch(
        (x1, y1), (x2, y2),
        arrowstyle="-|>", mutation_scale=11, linewidth=1.1,
        color=C_ARROW, connectionstyle=f"arc3,rad={rad}", zorder=1,
    )
    ax.add_patch(arr)
    if label:
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        ax.text(mx + 0.15, my, label, fontsize=fontsize, color="#616161", ha="left", va="center")


def draw_flowchart():
    fig, ax = plt.subplots(figsize=(7.5, 11))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 14.5)
    ax.axis("off")

    ax.text(5, 14.1, "BHI Algorithm Pipeline and Dynamic Compensation",
            ha="center", fontsize=12, fontweight="bold")
    ax.text(5, 13.7, "MedWear-AnalyticsCore-v1  ·  behavioralHealthIndex.js",
            ha="center", fontsize=8.5, color="#616161")

    cx = 5.0

    # 1. Input
    box(ax, cx, 12.85, 7.2, 0.95,
        "Data input (single-day feature vector)",
        C_INPUT, C_INPUT_E, bold=True,
        sub="X = {steps, sleep, rhr, spo2, hrv}\n"
              "from cleaned daily store (age, sex optional)")

    arrow(ax, cx, 12.35, cx, 11.95)

    # 2. Missing detection
    box(ax, cx, 11.55, 7.2, 1.05,
        "Missing-value screening",
        C_PROC, C_PROC_E, bold=True,
        sub="Build available set S (subset of {s, l, r, o, h})\n"
            "s: steps>0  ·  l: sleep hours>0  ·  r: RHR or mean(HR)\n"
            "o: mean(SpO2)  ·  h: mean(HRV)  ·  else mark missing")

    arrow(ax, cx, 11.0, cx, 10.55)

    # 3. Decision
    diamond(ax, cx, 10.15, 5.8, 0.85,
            "|S| > 0 ?", C_DEC, C_DEC_E, fontsize=8.5)
    ax.text(7.2, 10.15, "No  →  BHI = null", fontsize=7.5, color="#C62828", va="center")

    arrow(ax, cx, 9.72, cx, 9.25, label="Yes")

    # 4. Weight normalization
    box(ax, cx, 8.85, 7.4, 1.15,
        "Dynamic weight re-normalization",
        C_MATH, C_MATH_E, bold=True,
        sub="w_i' = w_i / sum(w_j for j in S)\n"
              "base weights:  w_s=0.28  w_l=0.24  w_r=0.20  w_o=0.16  w_h=0.12")

    arrow(ax, cx, 8.25, cx, 7.85)

    # 5. Nonlinear mapping (parallel sub-process visual)
    box(ax, cx, 7.15, 7.6, 1.55,
        "Nonlinear component mapping  c_i = f_i(x_i)",
        C_PROC, C_PROC_E, bold=True,
        sub="c_s: sigmoid(steps)  ·  c_l: Gaussian(sleep h, peak 7.25)\n"
            "c_r: Gaussian(RHR; age/sex ref)  ·  c_o: logistic(SpO2)\n"
            "c_h: min(1, HRV / age-ref)  ·  each c_i in [0, 1]")

    arrow(ax, cx, 6.35, cx, 5.95)

    # 6. Weighted sum
    box(ax, cx, 5.55, 7.2, 0.95,
        "Weighted aggregation",
        C_MATH, C_MATH_E, bold=True,
        sub="BHI_base = 100 x sum(w_i' x c_i) for i in S\n"
              "(rounded to integer)")

    arrow(ax, cx, 5.05, cx, 4.6)

    # 7. Trend decision
    diamond(ax, cx, 4.2, 6.2, 0.9,
            "Prior ≥3 days\nwith valid BHI?", C_DEC, C_DEC_E, fontsize=8)
    ax.text(1.55, 4.2, "No  →  skip trend", fontsize=7.5, color="#616161", va="center")

    arrow(ax, cx, 3.75, cx, 3.3, label="Yes")

    # 8. Trend adjustment
    box(ax, cx, 2.85, 7.5, 1.2,
        "Longitudinal trend micro-adjustment",
        C_MATH, C_MATH_E, bold=True,
        sub="BHI_7 = mean of prior-day BHI (up to 7 d)\n"
              "Delta = clip((BHI_base - BHI_7) x 0.12, -3, +3)")

    arrow(ax, cx, 2.25, cx, 1.85)

    # 9. Output
    box(ax, cx, 1.45, 7.2, 0.95,
        "Final output",
        C_OUT, C_OUT_E, bold=True,
        sub="BHI_final = clip(BHI_base + Delta, 0, 100)\n"
              "API field: healthScore  ·  not a disease-risk score")

    # Side note: renormalized flag
    ax.text(
        9.35, 8.85,
        "If |missing|>0:\nrenormalized=true\ncoverage = sum w_i",
        ha="center", va="center", fontsize=7,
        bbox=dict(boxstyle="round,pad=0.3", facecolor="#FAFAFA", edgecolor="#BDBDBD"),
    )

    # Legend
    proc = mpatches.Patch(facecolor=C_PROC, edgecolor=C_PROC_E, label="Process")
    dec = mpatches.Patch(facecolor=C_DEC, edgecolor=C_DEC_E, label="Decision")
    math = mpatches.Patch(facecolor=C_MATH, edgecolor=C_MATH_E, label="Computation")
    ax.legend(handles=[proc, dec, math], loc="lower center", bbox_to_anchor=(0.5, -0.01),
              ncol=3, frameon=False, fontsize=8)

    caption = (
        "Figure. Algorithmic data-flow diagram for the Behavioral Health Index (BHI). "
        "Missing wearable dimensions are excluded from set S; remaining weights are "
        "re-normalized before nonlinear mapping and aggregation. An optional ±3-point "
        "trend correction uses the prior-day BHI mean when at least three history days exist."
    )
    fig.text(0.5, 0.008, caption, ha="center", va="bottom", fontsize=7, color="#424242", wrap=True)

    fig.subplots_adjust(left=0.05, right=0.95, top=0.98, bottom=0.06)
    return fig


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    fig = draw_flowchart()

    pdf = OUT_DIR / "MedWear_BHI_Algorithm_Flowchart.pdf"
    svg = OUT_DIR / "MedWear_BHI_Algorithm_Flowchart.svg"
    png = OUT_DIR / "MedWear_BHI_Algorithm_Flowchart.png"
    note = OUT_DIR / "figure_caption.txt"

    fig.savefig(png, dpi=300, bbox_inches="tight", facecolor="white")
    fig.savefig(pdf, bbox_inches="tight", facecolor="white")
    fig.savefig(svg, bbox_inches="tight", facecolor="white")
    plt.close(fig)

    note.write_text(
        f"BHI Algorithm Flowchart — exported {datetime.now():%Y-%m-%d %H:%M}\n\n"
        "Suggested caption:\n"
        "Figure X. Data-flow diagram of the MedWear Behavioral Health Index (BHI) "
        "with dynamic weight re-normalization under missing sensors and optional "
        "longitudinal trend compensation (±3 points vs. prior-day mean). "
        "Implementation: server/services/behavioralHealthIndex.js.\n\n"
        "Files:\n"
        "  MedWear_BHI_Algorithm_Flowchart.pdf  (vector, LaTeX)\n"
        "  MedWear_BHI_Algorithm_Flowchart.svg  (editable)\n"
        "  MedWear_BHI_Algorithm_Flowchart.png  (300 DPI)\n",
        encoding="utf-8",
    )

    print(f"Exported to {OUT_DIR}")
    for p in (pdf, svg, png, note):
        print(f"  -> {p}")


if __name__ == "__main__":
    main()
