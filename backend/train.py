"""Train the car price model and calibrate it to the Tunisian market.

Two stages (the notebook cars_price_prediction_tunisia.ipynb runs the same steps):

1. Car value model, trained on 8,510 CarDekho (India) listings.
   - Features: age, km, owner, seller, gearbox, power, seats, fuel (one-hot)
     and the car = brand + model (one-hot). Models with fewer than
     MIN_MODEL_LISTINGS listings are pooled into "<brand>|Other".
   - Target: log(selling_price in lakh). 80/20 split, random_state=2,
     StandardScaler, LinearRegression and LassoCV(cv=5).
   - Engine size is left out: it duplicates power (r = 0.74) and came out with
     a negative weight, i.e. a bigger engine lowered the price.

2. Tunisian calibration, fitted on real Tunisian listings
   (tunisia_reference_listings.csv, collected from autoprix.tn and
   automobile.tn in November 2026).
   Converting Indian prices at the exchange rate is far off: Tunisian used cars
   cost about 2x more when recent and up to 6x more when old, because import
   duties make cars expensive and they lose value more slowly. The calibration is

       log(price_TND) = a + b * age + c * log(predicted price in lakh)

   fitted with a Huber (outlier-robust) regression, and checked by leaving one
   car model out at a time.

Writes `model/artifact.joblib`.  Usage:  python train.py
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn import metrics
from sklearn.linear_model import HuberRegressor, LassoCV, LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from car_models import clean_brand_and_model

ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT.parent / "cars_merged_extended.csv"
TUNISIA_PATH = ROOT.parent / "tunisia_reference_listings.csv"
ARTIFACT_PATH = ROOT / "model" / "artifact.joblib"

DATA_YEAR = 2022    # CarDekho listings were collected in 2022: age = 2022 - year
MARKET_YEAR = 2026  # Tunisian listings (and today's predictions): age = 2026 - year
MIN_YEAR = 1995

FUELS = ["Petrol", "Diesel", "CNG", "LPG"]  # Petrol is the reference level
SELLERS = ["Dealer", "Individual"]
TRANSMISSIONS = ["Manual", "Automatic"]

MIN_MODEL_LISTINGS = 5
OTHER_MODEL = "Other"
CAR_PREFIX = "car_"
NUMERIC = ["age", "km_driven", "owner", "seller_type", "transmission", "max_power_bhp", "seats"]


def car_key(brand: str, car_model: str, known: set[str]) -> str:
    """Category the model sees: "Toyota|Corolla", or "Toyota|Other" if the model is rare."""
    key = f"{brand}|{car_model}"
    return key if key in known else f"{brand}|{OTHER_MODEL}"


def encode(df: pd.DataFrame, known_cars: set[str], ref_year: int, columns: list[str] | None = None) -> pd.DataFrame:
    """Feature matrix for rows with brand, car_model, year, km_driven, fuel, … .

    `ref_year` is the year the price applies to (age = ref_year - year).
    With `columns` (inference), the result is aligned to the training columns.
    """
    out = pd.DataFrame(index=df.index)
    out["age"] = (ref_year - df["year"]).clip(lower=0)
    out["km_driven"] = df["km_driven"]
    out["owner"] = df["owner"]
    out["seller_type"] = (df["seller_type"] == "Individual").astype(int)
    out["transmission"] = (df["transmission"] == "Automatic").astype(int)
    out["max_power_bhp"] = df["max_power_bhp"]
    out["seats"] = df["seats"]
    for fuel in FUELS[1:]:
        out[f"fuel_{fuel}"] = (df["fuel"] == fuel).astype(int)
    cars = pd.Series([car_key(b, m, known_cars) for b, m in zip(df["brand"], df["car_model"])], index=df.index)
    dummies = pd.get_dummies(cars, prefix=CAR_PREFIX[:-1], dtype=int)
    out = pd.concat([out, dummies], axis=1)
    if columns is None:
        return out.drop(columns=sorted(dummies.columns)[0])  # drop_first
    return out.reindex(columns=columns, fill_value=0)


def evaluate(model, X, y_log) -> dict[str, float]:
    pred_log = model.predict(X)
    return {
        "r2_log": float(metrics.r2_score(y_log, pred_log)),
        "r2_price": float(metrics.r2_score(np.exp(y_log), np.exp(pred_log))),
        "mae_lakhs": float(metrics.mean_absolute_error(np.exp(y_log), np.exp(pred_log))),
    }


def load_dataset() -> pd.DataFrame:
    raw = pd.read_csv(DATA_PATH)
    if "model" not in raw.columns:  # original dataset without the cleaned brand / model columns
        raw[["brand", "model"]] = clean_brand_and_model(raw)
    return raw.rename(columns={"model": "car_model"})


def typical_specs(raw: pd.DataFrame, cars: pd.Series) -> dict[str, dict]:
    """Specs of a typical listing for every car key (most common / median values)."""
    out = {}
    for car, g in raw.groupby(cars):
        out[car] = {
            "fuel": g["fuel"].mode()[0],
            "transmission": g["transmission"].mode()[0],
            "seats": int(g["seats"].mode()[0]),
            "max_power_bhp": float(round(g["max_power_bhp"].median() * 2) / 2),
        }
    return out


def calib_design(age: np.ndarray, log_pred: np.ndarray) -> np.ndarray:
    return np.c_[np.ones(len(age)), age, log_pred]


def calibrate(model, scaler, columns, known_cars, typical, tn: pd.DataFrame) -> dict:
    """Fit log(price_TND) = a + b*age + c*log(pred_lakh) on the Tunisian listings."""
    rows = tn.copy()
    keys = [car_key(b, m, known_cars) for b, m in zip(rows["brand"], rows["car_model"])]
    spec = pd.DataFrame([typical[k] for k in keys], index=rows.index)
    stated = rows["transmission"].fillna("").astype(str)
    rows["transmission"] = stated.where(stated != "", spec["transmission"])
    rows["max_power_bhp"] = spec["max_power_bhp"]
    rows["seats"] = spec["seats"]
    rows["owner"] = 0
    rows["seller_type"] = "Individual"

    X = scaler.transform(encode(rows, known_cars, MARKET_YEAR, columns))
    log_pred = model.predict(X)
    age = (MARKET_YEAR - rows["year"]).clip(lower=0).to_numpy(float)
    y = np.log(rows["price_tnd"].to_numpy(float))

    def fit(mask):
        return HuberRegressor(fit_intercept=False, alpha=0.0, max_iter=1000).fit(
            calib_design(age[mask], log_pred[mask]), y[mask]
        ).coef_

    # Honest error: predict each car model with a calibration fitted without it.
    groups = rows["car_model"].to_numpy()
    lomo_log_err = np.empty(len(rows))
    for g in np.unique(groups):
        test = groups == g
        coef = fit(~test)
        lomo_log_err[test] = y[test] - calib_design(age[test], log_pred[test]) @ coef
    ape = np.abs(np.expm1(-lomo_log_err))  # |pred - actual| / actual

    coef = fit(np.ones(len(rows), bool))
    naive_ape = np.abs(np.exp(log_pred) * 3150 - np.exp(y)) / np.exp(y)  # exchange rate only (1 lakh ≈ 3,150 DT)
    return {
        "a": float(coef[0]),
        "b_age": float(coef[1]),
        "c_log_pred": float(coef[2]),
        "listings": int(len(rows)),
        "car_models": sorted(rows["brand"].str.cat(rows["car_model"], sep=" ").unique().tolist()),
        "median_ape": float(np.median(ape)),
        "naive_median_ape": float(np.median(naive_ape)),
        # 80 % band from the leave-one-model-out errors on Tunisian listings.
        "residual_q10": float(np.quantile(lomo_log_err, 0.10)),
        "residual_q90": float(np.quantile(lomo_log_err, 0.90)),
    }


def main() -> None:
    raw = load_dataset()
    counts = raw.groupby(["brand", "car_model"]).size()
    known_cars = {f"{b}|{m}" for (b, m), n in counts.items() if n >= MIN_MODEL_LISTINGS}

    X = encode(raw, known_cars, DATA_YEAR)
    y = np.log(raw["selling_price"])
    columns = list(X.columns)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=2)
    scaler = StandardScaler().fit(X_train)
    X_train_s, X_test_s = scaler.transform(X_train), scaler.transform(X_test)

    models = {
        "linear": LinearRegression().fit(X_train_s, y_train),
        "lasso": LassoCV(cv=5, random_state=0).fit(X_train_s, y_train),
    }

    cars = pd.Series([car_key(b, m, known_cars) for b, m in zip(raw["brand"], raw["car_model"])], index=raw.index)
    typical = typical_specs(raw, cars)

    tn = pd.read_csv(TUNISIA_PATH).rename(columns={"model": "car_model"})
    report: dict[str, dict] = {}
    calibration: dict[str, dict] = {}
    for name, model in models.items():
        report[name] = {
            "train": evaluate(model, X_train_s, y_train),
            "test": evaluate(model, X_test_s, y_test),
            "non_zero_coefficients": int(np.count_nonzero(model.coef_)),
        }
        calibration[name] = calibrate(model, scaler, columns, known_cars, typical, tn)
        report[name]["tunisia"] = {k: v for k, v in calibration[name].items() if k not in ("a", "b_age", "c_log_pred")}
    report["lasso"]["alpha"] = float(models["lasso"].alpha_)

    # Km a Tunisian car typically has per year of age, to prefill the form.
    tn_age = (MARKET_YEAR - tn["year"]).clip(lower=1)
    km_per_year = float(round(np.median(tn["km_driven"] / tn_age), -3))

    brands = sorted(raw["brand"].unique().tolist(), key=lambda b: (b == "Other", b))
    models_by_brand: dict[str, list[dict]] = {}
    for brand in brands:
        entries = []
        for car, g in sorted(raw[raw["brand"] == brand].groupby(cars), key=lambda kv: -len(kv[1])):
            model_name = car.split("|", 1)[1]
            entries.append({
                "name": model_name,
                "listings": int(len(g)),
                "pooled": sorted(g["car_model"].unique().tolist()) if model_name == OTHER_MODEL else [],
                "typical": typical[car],
            })
        entries.sort(key=lambda e: e["name"] == OTHER_MODEL)  # "Other" last
        models_by_brand[brand] = entries

    artifact = {
        "models": models,
        "scaler": scaler,
        "feature_columns": columns,
        "known_cars": sorted(known_cars),
        "calibration": calibration,
        "metrics": report,
        "meta": {
            "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "rows": int(len(raw)),
            "train_rows": int(len(X_train)),
            "test_rows": int(len(X_test)),
            "data_year": DATA_YEAR,
            "market_year": MARKET_YEAR,
            "km_per_year": km_per_year,
            "brands": brands,
            "models_by_brand": models_by_brand,
            "min_model_listings": MIN_MODEL_LISTINGS,
            "fuel": FUELS,
            "seller_type": SELLERS,
            "transmission": TRANSMISSIONS,
            "owner": [0, 1, 2, 3],
            "seats": sorted(int(v) for v in raw["seats"].unique()),
            "ranges": {
                "year": {"min": MIN_YEAR, "max": MARKET_YEAR, "median": 2016},
                "km_driven": {"min": 0, "max": 500_000, "median": float(tn["km_driven"].median())},
                "max_power_bhp": {
                    "min": float(raw["max_power_bhp"].min()),
                    "max": float(raw["max_power_bhp"].max()),
                    "median": float(raw["max_power_bhp"].median()),
                },
            },
        },
    }

    ARTIFACT_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, ARTIFACT_PATH)

    print(f"Saved {ARTIFACT_PATH}")
    for name in models:
        t, c = report[name]["test"], calibration[name]
        print(
            f"  {name:<6}  CarDekho test R2(log)={t['r2_log']:.3f} R2(price)={t['r2_price']:.3f}"
            f" | Tunisia: median error {c['median_ape']:.1%} (exchange rate only: {c['naive_median_ape']:.1%})"
            f" | a={c['a']:.3f} b_age={c['b_age']:.4f} c={c['c_log_pred']:.3f}"
        )
    print(f"  km per year (Tunisia): {km_per_year:,.0f}")


if __name__ == "__main__":
    main()
