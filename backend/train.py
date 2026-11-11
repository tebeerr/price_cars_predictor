"""Train the car price models exactly as in cars_price_prediction_merged.ipynb.

Pipeline (mirrors the notebook cell by cell):
  1. Encode fuel / seller_type / transmission as integers.
  2. Replace `year` with `age = 2022 - year`.
  3. One-hot encode `brand` (drop_first=True).
  4. Target = log(selling_price) (price in lakhs).
  5. 80/20 split, random_state=2, StandardScaler fitted on the train split.
  6. Fit LinearRegression and LassoCV(cv=5).

Writes `model/artifact.joblib` with both models, the scaler, the feature order,
evaluation metrics and the metadata the API needs to validate inputs.

Usage:  python train.py
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn import metrics
from sklearn.linear_model import LassoCV, LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT.parent / "cars_merged_extended.csv"
ARTIFACT_PATH = ROOT / "model" / "artifact.joblib"

REFERENCE_YEAR = 2022  # the notebook computes age as 2022 - year

FUEL_CODES = {"Petrol": 0, "Diesel": 1, "CNG": 2, "LPG": 3}
SELLER_CODES = {"Dealer": 0, "Individual": 1}
TRANSMISSION_CODES = {"Manual": 0, "Automatic": 1}


def encode(df: pd.DataFrame, brand_columns: list[str] | None = None) -> pd.DataFrame:
    """Apply the notebook's feature engineering to a raw dataframe."""
    out = df.copy()
    out["fuel"] = out["fuel"].map(FUEL_CODES)
    out["seller_type"] = out["seller_type"].map(SELLER_CODES)
    out["transmission"] = out["transmission"].map(TRANSMISSION_CODES)
    out["age"] = REFERENCE_YEAR - out["year"]
    out = pd.get_dummies(out, columns=["brand"], drop_first=brand_columns is None, dtype=int)
    if brand_columns is not None:
        # Inference: align dummies with the training columns (missing -> 0).
        for col in brand_columns:
            if col not in out.columns:
                out[col] = 0
    return out


def evaluate(model, X, y_log) -> dict[str, float]:
    pred_log = model.predict(X)
    return {
        "r2_log": float(metrics.r2_score(y_log, pred_log)),
        "r2_price": float(metrics.r2_score(np.exp(y_log), np.exp(pred_log))),
        "mae_lakhs": float(metrics.mean_absolute_error(np.exp(y_log), np.exp(pred_log))),
    }


def main() -> None:
    raw = pd.read_csv(DATA_PATH)
    df = encode(raw)

    X = df.drop(["name", "year", "source", "selling_price"], axis=1)
    y = np.log(df["selling_price"])
    feature_columns = list(X.columns)
    brand_columns = [c for c in feature_columns if c.startswith("brand_")]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=2)
    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    models = {
        "linear": LinearRegression().fit(X_train_s, y_train),
        "lasso": LassoCV(cv=5).fit(X_train_s, y_train),
    }

    report: dict[str, dict] = {}
    for name, model in models.items():
        residuals = y_test.to_numpy() - model.predict(X_test_s)
        report[name] = {
            "train": evaluate(model, X_train_s, y_train),
            "test": evaluate(model, X_test_s, y_test),
            # 10th / 90th percentile of log residuals on the test split:
            # 80 % of unseen cars landed inside pred * exp([q10, q90]).
            "residual_q10": float(np.quantile(residuals, 0.10)),
            "residual_q90": float(np.quantile(residuals, 0.90)),
            "non_zero_coefficients": int(np.count_nonzero(model.coef_)),
        }
    report["lasso"]["alpha"] = float(models["lasso"].alpha_)

    all_brands = sorted(raw["brand"].unique().tolist())

    def num_range(col: str) -> dict[str, float]:
        s = raw[col]
        return {"min": float(s.min()), "max": float(s.max()), "median": float(s.median())}

    artifact = {
        "models": models,
        "scaler": scaler,
        "feature_columns": feature_columns,
        "brand_columns": brand_columns,
        "reference_year": REFERENCE_YEAR,
        "metrics": report,
        "meta": {
            "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "rows": int(len(raw)),
            "train_rows": int(len(X_train)),
            "test_rows": int(len(X_test)),
            "brands": all_brands,
            "fuel": list(FUEL_CODES),
            "seller_type": list(SELLER_CODES),
            "transmission": list(TRANSMISSION_CODES),
            "owner": sorted(int(v) for v in raw["owner"].unique()),
            "seats": sorted(int(v) for v in raw["seats"].unique()),
            "ranges": {
                "year": num_range("year"),
                "km_driven": num_range("km_driven"),
                "engine_cc": num_range("engine_cc"),
                "max_power_bhp": num_range("max_power_bhp"),
                "selling_price": num_range("selling_price"),
            },
        },
    }

    ARTIFACT_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, ARTIFACT_PATH)

    print(f"Saved {ARTIFACT_PATH}")
    for name in models:
        t = report[name]["test"]
        print(f"  {name:<6}  test R2(log)={t['r2_log']:.4f}  R2(price)={t['r2_price']:.4f}  MAE={t['mae_lakhs']:.3f} lakhs")


if __name__ == "__main__":
    main()
