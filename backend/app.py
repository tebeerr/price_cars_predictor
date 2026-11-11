"""FastAPI service exposing the notebook's car price models.

Run:  uvicorn app:app --reload --port 8000
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Literal

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

import train

ModelName = Literal["linear", "lasso"]

LAKH = 100_000  # 1 lakh = 100,000 INR
# The model is trained on CarDekho prices in lakh (INR). Every price the API
# returns is converted to Tunisian dinars with this rate (TND per 1 INR).
# Default: ~0.0315, mid-market rate in early November 2026. Override with
# the TND_PER_INR environment variable.
TND_PER_INR = float(os.getenv("TND_PER_INR", "0.0315"))
TND_PER_LAKH = LAKH * TND_PER_INR


def to_tnd(lakhs: float) -> float:
    return round(float(lakhs) * TND_PER_LAKH, 2)


@lru_cache(maxsize=1)
def load_artifact() -> dict:
    if not train.ARTIFACT_PATH.exists():
        train.main()
    return joblib.load(train.ARTIFACT_PATH)


class CarInput(BaseModel):
    brand: str
    year: int = Field(ge=1980, le=train.REFERENCE_YEAR)
    km_driven: int = Field(ge=0, le=1_000_000)
    fuel: Literal["Petrol", "Diesel", "CNG", "LPG"]
    seller_type: Literal["Dealer", "Individual"]
    transmission: Literal["Manual", "Automatic"]
    owner: int = Field(ge=0, le=3, description="0 = first owner … 3 = fourth owner or more")
    engine_cc: float = Field(ge=500, le=7000)
    max_power_bhp: float = Field(gt=0, le=800)
    seats: int = Field(ge=2, le=14)

    @field_validator("brand")
    @classmethod
    def known_brand(cls, v: str) -> str:
        if v not in load_artifact()["meta"]["brands"]:
            raise ValueError("unknown brand")
        return v


class Contribution(BaseModel):
    feature: str
    log_effect: float
    pct_effect: float


class ModelPrediction(BaseModel):
    price_tnd: float
    low_tnd: float
    high_tnd: float
    contributions: list[Contribution]
    depreciation: list[dict]


class PredictionResponse(BaseModel):
    input: CarInput
    predictions: dict[str, ModelPrediction]


app = FastAPI(title="Car Price Predictor API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


def to_matrix(rows: list[dict]) -> np.ndarray:
    art = load_artifact()
    frame = train.encode(pd.DataFrame(rows), brand_columns=art["brand_columns"])
    return art["scaler"].transform(frame[art["feature_columns"]])


def contributions(model, z_row: np.ndarray, feature_columns: list[str]) -> list[Contribution]:
    """Per-feature effect vs. the average training car (z = 0) in log-price space.

    The models are linear on standardised inputs, so prediction = intercept + Σ coef·z
    and each term coef·z is exactly how far that feature pushes log(price).
    Brand dummies are summed into a single "brand" effect.
    """
    grouped: dict[str, float] = {}
    for col, coef, z in zip(feature_columns, model.coef_, z_row):
        key = "brand" if col.startswith("brand_") else col
        grouped[key] = grouped.get(key, 0.0) + float(coef * z)
    items = [
        Contribution(feature=k, log_effect=v, pct_effect=float(np.expm1(v) * 100))
        for k, v in grouped.items()
    ]
    return sorted(items, key=lambda c: abs(c.log_effect), reverse=True)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/meta")
def meta() -> dict:
    art = load_artifact()
    metrics = {
        name: {
            **m,
            "train": {**m["train"], "mae_tnd": to_tnd(m["train"]["mae_lakhs"])},
            "test": {**m["test"], "mae_tnd": to_tnd(m["test"]["mae_lakhs"])},
        }
        for name, m in art["metrics"].items()
    }
    return {
        **art["meta"],
        "reference_year": art["reference_year"],
        "metrics": metrics,
        "currency": {"code": "TND", "tnd_per_inr": TND_PER_INR, "tnd_per_lakh": TND_PER_LAKH},
    }


@app.post("/api/predict", response_model=PredictionResponse)
def predict(car: CarInput) -> PredictionResponse:
    art = load_artifact()
    base = car.model_dump()

    year_min = int(art["meta"]["ranges"]["year"]["min"])
    years = list(range(max(year_min, car.year - 12), train.REFERENCE_YEAR + 1))
    curve_rows = [{**base, "year": y} for y in years]

    try:
        z = to_matrix([base])
        z_curve = to_matrix(curve_rows)
    except Exception as exc:  # malformed input that slipped past validation
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    out: dict[str, ModelPrediction] = {}
    for name, model in art["models"].items():
        m = art["metrics"][name]
        log_pred = float(model.predict(z)[0])
        price = float(np.exp(log_pred))
        curve = np.exp(model.predict(z_curve))
        out[name] = ModelPrediction(
            price_tnd=to_tnd(price),
            low_tnd=to_tnd(price * float(np.exp(m["residual_q10"]))),
            high_tnd=to_tnd(price * float(np.exp(m["residual_q90"]))),
            contributions=contributions(model, z[0], art["feature_columns"]),
            depreciation=[{"year": y, "price_tnd": to_tnd(p)} for y, p in zip(years, curve)],
        )
    return PredictionResponse(input=car, predictions=out)
