#!/usr/bin/env python3
"""Train ML models on exported MedWear wearable feature CSV/JSON."""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime

import joblib
import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.metrics import classification_report, f1_score, accuracy_score
from sklearn.model_selection import cross_val_predict, cross_validate, StratifiedKFold
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier

FEATURE_COLS = [
    "steps_norm", "avg_hr", "std_hr", "resting_hr", "avg_spo2", "min_spo2", "avg_hrv",
    "sleep_hours", "deep_sleep_ratio", "active_energy_norm", "hr_above_threshold",
    "spo2_below_threshold", "low_activity", "window_hr_mean", "window_hr_std",
    "anomaly_flag", "health_score_norm",
]


def load_data(path: str) -> tuple[pd.DataFrame, np.ndarray]:
    if path.endswith(".json"):
        raw = json.load(open(path, encoding="utf-8"))
        df = pd.DataFrame(raw["rows"])
    else:
        df = pd.read_csv(path)
    X = df[FEATURE_COLS].astype(float)
    y = LabelEncoder().fit_transform(df["label"])
    return X, y


def build_model(name: str, seed: int):
    if name == "lr":
        return LogisticRegression(max_iter=2000, random_state=seed, class_weight="balanced")
    if name == "rf":
        return RandomForestClassifier(n_estimators=200, random_state=seed, class_weight="balanced")
    if name == "xgb":
        from xgboost import XGBClassifier
        return XGBClassifier(n_estimators=200, max_depth=4, random_state=seed, eval_metric="mlogloss", verbosity=0)
    if name == "lgbm":
        from lightgbm import LGBMClassifier
        return LGBMClassifier(n_estimators=200, random_state=seed, verbose=-1, class_weight="balanced")
    if name == "mlp":
        return MLPClassifier(hidden_layer_sizes=(64, 32), max_iter=500, random_state=seed)
    if name == "transformer":
        try:
            import torch
            import torch.nn as nn

            class TabularTransformer(nn.Module):
                def __init__(self, n_features, n_classes, d_model=32, nhead=4):
                    super().__init__()
                    self.embed = nn.Linear(n_features, d_model)
                    enc = nn.TransformerEncoderLayer(d_model=d_model, nhead=nhead, batch_first=True)
                    self.encoder = nn.TransformerEncoder(enc, num_layers=2)
                    self.head = nn.Linear(d_model, n_classes)

                def forward(self, x):
                    x = self.embed(x).unsqueeze(1)
                    return self.head(self.encoder(x).squeeze(1))

            class TorchClf:
                def __init__(self, n_features, n_classes, seed):
                    self.n_features, self.n_classes, self.seed = n_features, n_classes, seed
                    self.model = None
                    self.classes_ = np.arange(n_classes)

                def fit(self, X, y):
                    torch.manual_seed(self.seed)
                    self.model = TabularTransformer(self.n_features, self.n_classes)
                    opt = torch.optim.Adam(self.model.parameters(), lr=1e-3)
                    crit = nn.CrossEntropyLoss()
                    Xt, yt = torch.tensor(X, dtype=torch.float32), torch.tensor(y, dtype=torch.long)
                    self.model.train()
                    for _ in range(100):
                        opt.zero_grad()
                        crit(self.model(Xt), yt).backward()
                        opt.step()
                    return self

                def predict(self, X):
                    self.model.eval()
                    with torch.no_grad():
                        return self.model(torch.tensor(X, dtype=torch.float32)).argmax(1).numpy()

            return TorchClf(len(FEATURE_COLS), 3, seed)
        except ImportError:
            return MLPClassifier(hidden_layer_sizes=(64, 32), max_iter=500, random_state=seed)
    raise ValueError(f"Unknown model: {name}")


def main():
    p = argparse.ArgumentParser(description="Train MedWear wearable risk models")
    p.add_argument("--data", default="experiments/data/medwear/features_v1.csv")
    p.add_argument("--model", default="xgb", choices=["lr", "rf", "xgb", "lgbm", "mlp", "transformer"])
    p.add_argument("--cv", type=int, default=5)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--out", default=None)
    args = p.parse_args()

    X, y = load_data(args.data)
    clf = build_model(args.model, args.seed)
    n_splits = min(args.cv, min(np.bincount(y)))
    cv = StratifiedKFold(n_splits=max(2, n_splits), shuffle=True, random_state=args.seed)

    if args.model == "transformer":
        imp = SimpleImputer(strategy="median")
        sc = StandardScaler()
        Xp = sc.fit_transform(imp.fit_transform(X))
        y_pred = cross_val_predict(clf, Xp, y, cv=cv)
        clf.fit(Xp, y)
        pipe = {"imputer": imp, "scaler": sc, "clf": clf}
    else:
        pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            ("clf", clf),
        ])
        y_pred = cross_val_predict(pipe, X, y, cv=cv)
        scores = cross_validate(pipe, X, y, cv=cv, scoring=["accuracy", "f1_macro"])
        pipe.fit(X, y)

    if args.model != "transformer":
        acc_m, f1_m = float(np.mean(scores["test_accuracy"])), float(np.mean(scores["test_f1_macro"]))
        acc_s, f1_s = float(np.std(scores["test_accuracy"])), float(np.std(scores["test_f1_macro"]))
    else:
        acc_m, f1_m = accuracy_score(y, y_pred), f1_score(y, y_pred, average="macro")
        acc_s, f1_s = 0.0, 0.0

    exp_id = f"medwear_{args.model}_{datetime.now().strftime('%Y-%m-%d')}"
    out_path = args.out or f"experiments/results/{exp_id}.json"
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    result = {
        "exp_id": exp_id,
        "project": "medwear",
        "model": args.model,
        "data": args.data,
        "cv": args.cv,
        "seed": args.seed,
        "n_samples": len(y),
        "metrics": {
            "accuracy_mean": acc_m,
            "accuracy_std": acc_s,
            "macro_f1_mean": f1_m,
            "macro_f1_std": f1_s,
        },
        "classification_report": classification_report(y, y_pred, output_dict=True),
        "created_at": datetime.utcnow().isoformat() + "Z",
    }
    json.dump(result, open(out_path, "w", encoding="utf-8"), indent=2)
    joblib.dump(pipe, out_path.replace(".json", ".joblib"))
    print(json.dumps(result["metrics"], indent=2))
    print(f"→ {out_path}")


if __name__ == "__main__":
    main()
