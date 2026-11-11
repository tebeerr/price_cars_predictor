const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const grouped = new Intl.NumberFormat("en-IN");

/** 5.42 → "₹5,42,000" */
export const formatInr = (lakhs: number) => inr.format(Math.round(lakhs * 100_000));

/** 5.4231 → "5.42" */
export const formatLakhs = (lakhs: number, digits = 2) => lakhs.toFixed(digits);

export const formatInt = (n: number) => grouped.format(Math.round(n));

export const formatPct = (pct: number) => {
  const rounded = Math.abs(pct) >= 10 ? pct.toFixed(0) : pct.toFixed(1);
  return `${pct > 0 ? "+" : pct < 0 ? "−" : "±"}${rounded.replace("-", "")}%`;
};

export const FEATURE_LABELS: Record<string, string> = {
  age: "Age",
  brand: "Brand",
  km_driven: "Kilometres",
  fuel: "Fuel",
  seller_type: "Seller",
  transmission: "Gearbox",
  owner: "Previous owners",
  engine_cc: "Engine size",
  max_power_bhp: "Power",
  seats: "Seats",
};

export const OWNER_LABELS = ["First", "Second", "Third", "Fourth+"];

/** The dataset stores Land Rover as "Land". */
export const brandLabel = (b: string) => (b === "Land" ? "Land Rover" : b);

export const MODEL_LABELS = { linear: "Linear regression", lasso: "Lasso (LassoCV)" } as const;
