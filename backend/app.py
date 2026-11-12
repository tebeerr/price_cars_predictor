"""FastAPI service: Tunisian used-car price estimates.

Run:  uvicorn app:app --reload --port 8000

Price = Tunisian calibration applied to the CarDekho value model (see train.py):
    log(price_TND) = a + b * age + c * log(predicted price in lakh)
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
from pydantic import BaseModel, Field, field_validator, model_validator

import train

ModelName = Literal["linear", "lasso"]


@lru_cache(maxsize=1)
def load_artifact() -> dict:
    if not train.ARTIFACT_PATH.exists():
        train.main()
    art = joblib.load(train.ARTIFACT_PATH)
    if "calibration" not in art:  # artifact from an older version of train.py
        train.main()
        art = joblib.load(train.ARTIFACT_PATH)
    return art


class CarInput(BaseModel):
    brand: str
    car_model: str = Field(description='Model within the brand, e.g. "Corolla", or "Other" for a rare model')
    year: int = Field(ge=train.MIN_YEAR, le=train.MARKET_YEAR)
    km_driven: int = Field(ge=0, le=1_000_000)
    fuel: Literal["Petrol", "Diesel", "CNG", "LPG"]
    seller_type: Literal["Dealer", "Individual"]
    transmission: Literal["Manual", "Automatic"]
    owner: int = Field(ge=0, le=3, description="0 = first owner … 3 = fourth owner or more")
    max_power_bhp: float = Field(gt=0, le=800)
    seats: int = Field(ge=2, le=14)

    @field_validator("brand")
    @classmethod
    def known_brand(cls, v: str) -> str:
        if v not in load_artifact()["meta"]["brands"]:
            raise ValueError("unknown brand")
        return v

    @model_validator(mode="after")
    def known_model(self) -> "CarInput":
        offered = load_artifact()["meta"]["models_by_brand"].get(self.brand, [])
        if self.car_model not in {m["name"] for m in offered}:
            raise ValueError(f"unknown model {self.car_model!r} for brand {self.brand!r}")
        return self


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


app = FastAPI(title="Car Price Predictor API (Tunisia)", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


def to_matrix(rows: list[dict]) -> np.ndarray:
    art = load_artifact()
    frame = train.encode(pd.DataFrame(rows), set(art["known_cars"]), train.MARKET_YEAR, art["feature_columns"])
    return art["scaler"].transform(frame)


def tnd(log_pred_lakh: np.ndarray, age: np.ndarray, cal: dict) -> np.ndarray:
    return np.exp(cal["a"] + cal["b_age"] * age + cal["c_log_pred"] * log_pred_lakh)


def contributions(model, cal: dict, z_row: np.ndarray, columns: list[str], scaler) -> list[Contribution]:
    """Exact split of log(price_TND) into per-feature terms vs. the average car.

    log(price) = const + Σ c·coef_j·z_j + b·age, and b·age = b·(age − mean) + const,
    so each term is c·coef_j·z_j, plus b·(age − mean age) for age.
    The brand + model dummies are summed into one "model" term.
    """
    c, b = cal["c_log_pred"], cal["b_age"]
    age_idx = columns.index("age")
    grouped: dict[str, float] = {}
    for j, (col, coef, z) in enumerate(zip(columns, model.coef_, z_row)):
        if col.startswith(train.CAR_PREFIX):
            key = "model"
        elif col.startswith("fuel_"):
            key = "fuel"
        else:
            key = col
        term = c * float(coef * z)
        if j == age_idx:
            term += b * float(z * scaler.scale_[j])  # z·scale = age − mean age
        grouped[key] = grouped.get(key, 0.0) + term
    items = [
        Contribution(feature=k, log_effect=v, pct_effect=float(np.expm1(v) * 100)) for k, v in grouped.items()
    ]
    return sorted(items, key=lambda x: abs(x.log_effect), reverse=True)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/meta")
def meta() -> dict:
    art = load_artifact()
    return {**art["meta"], "metrics": art["metrics"], "currency": {"code": "TND"}}


@app.post("/api/predict", response_model=PredictionResponse)
def predict(car: CarInput) -> PredictionResponse:
    art = load_artifact()
    base = car.model_dump()

    years = list(range(max(train.MIN_YEAR, car.year - 12), train.MARKET_YEAR + 1))
    curve_rows = [{**base, "year": y} for y in years]
    age = float(max(0, train.MARKET_YEAR - car.year))
    curve_age = np.array([max(0, train.MARKET_YEAR - y) for y in years], dtype=float)

    try:
        z = to_matrix([base])
        z_curve = to_matrix(curve_rows)
    except Exception as exc:  # malformed input that slipped past validation
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    out: dict[str, ModelPrediction] = {}
    for name, model in art["models"].items():
        cal = art["calibration"][name]
        price = float(tnd(model.predict(z), np.array([age]), cal)[0])
        curve = tnd(model.predict(z_curve), curve_age, cal)
        out[name] = ModelPrediction(
            price_tnd=round(price, 2),
            low_tnd=round(price * float(np.exp(cal["residual_q10"])), 2),
            high_tnd=round(price * float(np.exp(cal["residual_q90"])), 2),
            contributions=contributions(model, cal, z[0], art["feature_columns"], art["scaler"]),
            depreciation=[{"year": y, "price_tnd": round(float(p), 2)} for y, p in zip(years, curve)],
        )
    return PredictionResponse(input=car, predictions=out)
