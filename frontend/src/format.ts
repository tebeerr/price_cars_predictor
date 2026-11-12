import type { Fuel, ModelName, SellerType, Transmission } from "./api";

const intFormat = new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 0 });

/** 12950.4 → "12 950" (Tunisian grouping, whole dinars) */
export const formatTndNumber = (tnd: number) => intFormat.format(Math.round(tnd));

/** 12950.4 → "12 950 DT" */
export const formatTnd = (tnd: number) => `${formatTndNumber(tnd)} DT`;

/** Axis ticks: 15000 → "15k" */
export const formatTndShort = (tnd: number) =>
  tnd >= 1000 ? `${+(tnd / 1000).toFixed(1)}k` : String(Math.round(tnd));

export const formatInt = (n: number) => intFormat.format(Math.round(n));

export const formatPct = (pct: number) => {
  const rounded = Math.abs(pct) >= 10 ? pct.toFixed(0) : pct.toFixed(1);
  return `${pct > 0 ? "+" : pct < 0 ? "−" : "±"}${rounded.replace("-", "").replace(".", ",")} %`;
};

export const FEATURE_LABELS: Record<string, string> = {
  age: "Âge",
  model: "Marque et modèle",
  km_driven: "Kilométrage",
  fuel: "Carburant",
  seller_type: "Vendeur",
  transmission: "Boîte",
  owner: "Propriétaires",
  max_power_bhp: "Puissance",
  seats: "Places",
};

export const FUEL_LABELS: Record<Fuel, string> = { Petrol: "Essence", Diesel: "Diesel", CNG: "GNC", LPG: "GPL" };
export const TRANSMISSION_LABELS: Record<Transmission, string> = { Manual: "Manuelle", Automatic: "Automatique" };
export const SELLER_LABELS: Record<SellerType, string> = { Dealer: "Professionnel", Individual: "Particulier" };
export const OWNER_LABELS = ["1re main", "2e main", "3e main", "4e main +"];

export const OTHER_MODEL = "Other";

const BRAND_LABELS: Record<string, string> = { Maruti: "Suzuki", Other: "Autre marque" };
/** Display name. CarDekho's "Maruti" is sold as Suzuki in Tunisia. */
export const brandLabel = (b: string) => BRAND_LABELS[b] ?? b;

/** Logo file in /public/logos, or null for brands without one ("Other"). */
const LOGO_SLUGS: Record<string, string> = {
  Maruti: "suzuki",
  "Land Rover": "land-rover",
  "Mercedes-Benz": "mercedes-benz",
};
export const brandLogo = (b: string): string | null =>
  b === "Other" ? null : `/logos/${LOGO_SLUGS[b] ?? b.toLowerCase().replace(/\s+/g, "-")}.png`;

/** Model display name: "Other" → "Autre modèle". */
export const modelLabel = (m: string) => (m === OTHER_MODEL ? "Autre modèle" : m);

/** "Toyota" + "Corolla" → "Toyota Corolla"; brand "Other" already names the maker ("Lexus ES"). */
export const carLabel = (brand: string, model: string) => {
  if (model === OTHER_MODEL) return brand === "Other" ? "Autre marque" : `${brandLabel(brand)} (autre modèle)`;
  return brand === "Other" ? model : `${brandLabel(brand)} ${model}`;
};

export const MODEL_LABELS: Record<ModelName, string> = { linear: "Régression linéaire", lasso: "Lasso (LassoCV)" };
