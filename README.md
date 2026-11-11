# Valuer: used-car price dashboard

A web dashboard for the regression models in `cars_price_prediction_merged.ipynb`. You enter a car's details and get its predicted selling price, recalculated as you type.

```
cars_merged_extended.csv            dataset (8,510 CarDekho listings)
cars_price_prediction_merged.ipynb  original notebook
backend/   FastAPI service: trains and serves the notebook's models
frontend/  React + TypeScript dashboard (Vite)
```

## Run it

**1. Backend** (Python 3.10 or newer)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python train.py                 # writes model/artifact.joblib (also runs automatically on first start)
uvicorn app:app --port 8000
```

**2. Frontend** (Node 18 or newer), in a second terminal

```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173  (/api is proxied to :8000)
```

## How the model is reproduced

`backend/train.py` follows the notebook step by step:

| Step | Notebook | `train.py` |
|---|---|---|
| Encoding | fuel Petrol/Diesel/CNG/LPG → 0–3, seller Dealer/Individual → 0/1, gearbox Manual/Automatic → 0/1 | same |
| Age | `age = 2022 - year`, `year` dropped | same |
| Brand | `get_dummies(drop_first=True)` | same; inference aligns to the training columns |
| Target | `log(selling_price)` in lakh | same; predictions converted back with `exp` |
| Split / scaling | 80/20, `random_state=2`, `StandardScaler` fitted on train | same |
| Models | `LinearRegression`, `LassoCV(cv=5)` | both are served, and the UI switches between them |

Test-set results after retraining: Linear R² 0.899 (log) / 0.815 (lakh), MAE 1.43 lakh; Lasso R² 0.899 / 0.804, MAE 1.46 lakh.

## API

| Method | Path | Returns |
|---|---|---|
| GET | `/api/meta` | brands, allowed values, input ranges, train/test metrics |
| POST | `/api/predict` | price per model in lakh and ₹, 80 % band, per-feature effects, price by model year |

Example request body:

```json
{ "brand": "Maruti", "year": 2016, "km_driven": 50000, "fuel": "Petrol",
  "seller_type": "Individual", "transmission": "Manual", "owner": 0,
  "engine_cc": 1197, "max_power_bhp": 82, "seats": 5 }
```

Interactive API docs are at `http://localhost:8000/docs`.

## What the dashboard shows

- **Estimated price** in lakh and ₹, plus the other model's figure for comparison.
- **80 % band**: the 10th to 90th percentile of the models' log-errors on held-out test cars, applied around this estimate.
- **Same car, other model years**: the predicted price if only the year changed. Click a point on the curve to apply that year.
- **What moves this price**: each input's term (coefficient × standardised value) against the average training car. This is exact for a linear model on log-price. Brand dummies are summed into one row.
- **How far to trust it**: train and test R² and MAE for both models.
- **Saved estimates**: kept in your browser's localStorage.

## Notes and limits

- Inputs are limited to the ranges seen in the data. `year` can't go past 2022, because the notebook measures age from 2022.
- `owner` uses the dataset's 0–3 codes, shown as First, Second, Third and Fourth+.
- The notebook label-encodes `fuel` as 0–3, which treats it as an ordered value. The dashboard keeps this so its predictions match the notebook.
