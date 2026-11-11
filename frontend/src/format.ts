const grouped = new Intl.NumberFormat("en-IN");
const tndNumber = new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 0 });

/** 12950.4 → "12 950" (Tunisian grouping, whole dinars) */
export const formatTndNumber = (tnd: number) => tndNumber.format(Math.round(tnd));

/** 12950.4 → "12 950 DT" */
export const formatTnd = (tnd: number) => `${formatTndNumber(tnd)} DT`;

/** Axis ticks: 15000 → "15k" */
export const formatTndShort = (tnd: number) =>
  tnd >= 1000 ? `${+(tnd / 1000).toFixed(1)}k` : String(Math.round(tnd));

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
