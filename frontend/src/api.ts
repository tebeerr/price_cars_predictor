export type Fuel = "Petrol" | "Diesel" | "CNG" | "LPG";
export type SellerType = "Dealer" | "Individual";
export type Transmission = "Manual" | "Automatic";
export type ModelName = "linear" | "lasso";

export interface CarInput {
  brand: string;
  car_model: string;
  year: number;
  km_driven: number;
  fuel: Fuel;
  seller_type: SellerType;
  transmission: Transmission;
  owner: number;
  max_power_bhp: number;
  seats: number;
}

export interface Range {
  min: number;
  max: number;
  median: number;
}

export interface SplitMetrics {
  r2_log: number;
  r2_price: number;
  mae_lakhs: number;
}

/** How the Tunisian calibration did on real Tunisian listings. */
export interface TunisiaMetrics {
  listings: number;
  car_models: string[];
  /** Median |error| / price, each car model predicted by a calibration fitted without it. */
  median_ape: number;
  /** Same, converting the Indian price at the exchange rate only. */
  naive_median_ape: number;
  residual_q10: number;
  residual_q90: number;
}

export interface ModelMetrics {
  train: SplitMetrics;
  test: SplitMetrics;
  tunisia: TunisiaMetrics;
  non_zero_coefficients: number;
  alpha?: number;
}

/** Specs of a typical listing of one model, used to prefill the form. */
export interface TypicalSpecs {
  fuel: Fuel;
  transmission: Transmission;
  seats: number;
  max_power_bhp: number;
}

export interface CarModelInfo {
  /** Model name, or "Other" for the pooled rare models of a brand. */
  name: string;
  listings: number;
  /** For "Other": the rare models pooled under it. */
  pooled: string[];
  typical: TypicalSpecs;
}

export interface Meta {
  trained_at: string;
  rows: number;
  train_rows: number;
  test_rows: number;
  brands: string[];
  models_by_brand: Record<string, CarModelInfo[]>;
  min_model_listings: number;
  fuel: Fuel[];
  seller_type: SellerType[];
  transmission: Transmission[];
  owner: number[];
  seats: number[];
  ranges: Record<"year" | "km_driven" | "max_power_bhp", Range>;
  data_year: number;
  market_year: number;
  km_per_year: number;
  metrics: Record<ModelName, ModelMetrics>;
  currency: { code: "TND" };
}

export interface Contribution {
  feature: string;
  log_effect: number;
  pct_effect: number;
}

export interface CurvePoint {
  year: number;
  price_tnd: number;
}

export interface ModelPrediction {
  price_tnd: number;
  low_tnd: number;
  high_tnd: number;
  contributions: Contribution[];
  depreciation: CurvePoint[];
}

export interface PredictionResponse {
  input: CarInput;
  predictions: Record<ModelName, ModelPrediction>;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const BASE = import.meta.env.VITE_API_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError("Le service de prédiction est injoignable.", 0);
  }
  if (!res.ok) {
    let detail = `Échec de la requête (${res.status})`;
    try {
      const body = await res.json();
      if (Array.isArray(body.detail)) {
        detail = body.detail.map((d: { loc: string[]; msg: string }) => `${d.loc.at(-1)}: ${d.msg}`).join(" · ");
      } else if (typeof body.detail === "string") {
        detail = body.detail;
      }
    } catch {
      /* non-JSON error body */
    }
    // Vite's proxy answers 5xx when the backend is down.
    if (res.status === 502 || res.status === 504) throw new ApiError("Le service de prédiction est injoignable.", 0);
    throw new ApiError(detail, res.status);
  }
  return res.json() as Promise<T>;
}

export const getMeta = (signal?: AbortSignal) => request<Meta>("/api/meta", { signal });

export const predict = (car: CarInput, signal?: AbortSignal) =>
  request<PredictionResponse>("/api/predict", { method: "POST", body: JSON.stringify(car), signal });
