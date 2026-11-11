export type Fuel = "Petrol" | "Diesel" | "CNG" | "LPG";
export type SellerType = "Dealer" | "Individual";
export type Transmission = "Manual" | "Automatic";
export type ModelName = "linear" | "lasso";

export interface CarInput {
  brand: string;
  year: number;
  km_driven: number;
  fuel: Fuel;
  seller_type: SellerType;
  transmission: Transmission;
  owner: number;
  engine_cc: number;
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
  mae_tnd: number;
}

export interface ModelMetrics {
  train: SplitMetrics;
  test: SplitMetrics;
  residual_q10: number;
  residual_q90: number;
  non_zero_coefficients: number;
  alpha?: number;
}

export interface Meta {
  trained_at: string;
  rows: number;
  train_rows: number;
  test_rows: number;
  brands: string[];
  fuel: Fuel[];
  seller_type: SellerType[];
  transmission: Transmission[];
  owner: number[];
  seats: number[];
  ranges: Record<"year" | "km_driven" | "engine_cc" | "max_power_bhp" | "selling_price", Range>;
  reference_year: number;
  metrics: Record<ModelName, ModelMetrics>;
  currency: { code: "TND"; tnd_per_inr: number; tnd_per_lakh: number };
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
    throw new ApiError("The prediction service is unreachable.", 0);
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
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
    if (res.status === 502 || res.status === 504) throw new ApiError("The prediction service is unreachable.", 0);
    throw new ApiError(detail, res.status);
  }
  return res.json() as Promise<T>;
}

export const getMeta = (signal?: AbortSignal) => request<Meta>("/api/meta", { signal });

export const predict = (car: CarInput, signal?: AbortSignal) =>
  request<PredictionResponse>("/api/predict", { method: "POST", body: JSON.stringify(car), signal });
