# Valuer: used-car prices in Tunisia

A web dashboard that estimates the price of a used car on the Tunisian market. You pick the brand (from a grid of logos), the model and the year; the other details are filled in with typical values and can be adjusted. The price is recalculated as you type. The interface is in French.

```
cars_merged_extended.csv             CarDekho dataset (8,510 listings) with cleaned `brand` and `model` columns
tunisia_reference_listings.csv       221 real Tunisian listings used to calibrate prices
cars_price_prediction_tunisia.ipynb  the full pipeline as a notebook (runs in Google Colab)
cars_price_prediction_merged.ipynb   original notebook
backend/   FastAPI service: trains, calibrates and serves the model
           car_models.py extracts the model ("Corolla") from the listing name
frontend/  React + TypeScript dashboard (Vite); brand logos in public/logos
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

**Notebook in Colab:** upload `cars_price_prediction_tunisia.ipynb` to Colab, then run all cells. The first cell asks for `cars_merged_extended.csv` and `tunisia_reference_listings.csv`.

## How the price is computed

### 1. Car value model (CarDekho, India)

| Step | Original notebook | Now |
|---|---|---|
| Car identity | `brand` one-hot | **brand + model** one-hot (`Toyota|Corolla`); models with fewer than 5 listings pooled into `Toyota|Other` |
| Fuel | label-encoded 0–3 (implies an order) | one-hot, Petrol as reference |
| Engine size | used | **dropped**: it duplicates power (r = 0.74) and got a negative weight, so a bigger engine lowered the price |
| Age | `2022 - year` | same for training (CarDekho data is from 2022) |
| Target, split, scaling | `log(selling_price)` in lakh, 80/20 `random_state=2`, `StandardScaler` | same |
| Models | `LinearRegression`, `LassoCV(cv=5)` | same; the UI switches between them |

CarDekho test set:

| | R² (log) | R² (price) | MAE |
|---|---|---|---|
| Linear, original notebook | 0.899 | 0.815 | 1.43 lakh |
| **Linear, now** | **0.936** | **0.927** | **1.03 lakh** |
| Lasso, now | 0.933 | 0.909 | 1.09 lakh |

### 2. Tunisian calibration

Converting Indian prices at the exchange rate gives prices that are far too low. Compared with 221 real Tunisian listings (autoprix.tn and automobile.tn, November 2026; placeholder prices such as 1,111 DT removed):

| Car age | Tunisian price ÷ converted Indian price |
|---|---|
| 0–3 years | 2.1 |
| 4–6 years | 2.5 |
| 7–10 years | 3.6 |
| 11–15 years | 4.8 |
| 15+ years | 6.1 |

Cars are about twice as expensive in Tunisia when recent (import duties) and keep their value much longer. `train.py` therefore fits, with a Huber (outlier-robust) regression:

```
log(price_TND) = a + b · age + c · log(predicted price in lakh)      age = 2026 − year
```

Result: a = 9.68, b = 0.013, c = 0.565. Since c > 0 and b is small, prices still rise with the car's value and fall with age, km and owners.

Checked by leaving one car model out at a time (it is predicted by a calibration fitted without it):

| | Median error on Tunisian listings |
|---|---|
| Exchange rate only (before) | 62.6 % |
| **Calibrated (now)** | **14.7 %** |

The 80 % band shown in the dashboard is the 10th–90th percentile of these leave-one-model-out errors (about −37 % / +26 %).

## Car models and brands

The dataset only gave the full listing name ("Toyota Corolla Altis 1.8 VL CVT"). `backend/car_models.py` extracts the model and normalises spellings: "Maruti Suzuki Swift" and "Maruti Swift" become one model, as do "KWID"/"Kwid" and "3 Series"/"3-Series"; two-word models such as "Wagon R" and "Grand i10" are kept whole. That gives 229 models.

Brands were cleaned too: "Land" became "Land Rover", and makers hidden under "Other" with at least 5 listings got their own brand (Kia, MG, Volvo, Mitsubishi, MINI, Isuzu). The dashboard shows CarDekho's "Maruti" as **Suzuki**, its name in Tunisia.

## API

| Method | Path | Returns |
|---|---|---|
| GET | `/api/meta` | brands, models per brand (with typical specs), allowed values, ranges, CarDekho and Tunisian metrics |
| POST | `/api/predict` | Tunisian price per model in TND, 80 % band, per-feature effects, price by year |

```json
{ "brand": "Toyota", "car_model": "Corolla", "year": 2020, "km_driven": 110000, "fuel": "Petrol",
  "seller_type": "Individual", "transmission": "Manual", "owner": 0, "max_power_bhp": 132, "seats": 5 }
```

Interactive API docs: `http://localhost:8000/docs`.

## What the dashboard shows

- **Brand, model, year** as the main inputs. Choosing a model fills in its typical fuel, gearbox, power and seats. The km follows the year (18,000 km per year, the median of the Tunisian listings) until you type your own.
- **Estimated price** in Tunisian dinars with its 80 % band, and the other model's figure.
- **Same car, other years**: the price if only the year changed; click a point to apply it.
- **What moves the price**: each input's exact share of log(price) against the average car (brand + model dummies summed into one row).
- **How far to trust it**: Tunisian error and CarDekho R² for both models.
- **Saved estimates**: kept in the browser's localStorage.

Brand logos come from the [car-logos-dataset](https://github.com/filippofilip95/car-logos-dataset) project, resized into `frontend/public/logos`. They are trademarks of their owners and are shown only to identify the brands.

## Limits

- The calibration rests on 221 listings of 10 models. Brands that are rare in Tunisia (Mahindra, Tata…) are extrapolated.
- Listings give asking prices, not final sale prices, and they do not describe condition or options.
- French brands common in Tunisia (Peugeot, Citroën) are not in the CarDekho data. Covering them needs Tunisian training data.
