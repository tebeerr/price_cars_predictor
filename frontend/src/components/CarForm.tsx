import type { CarInput, Meta } from "../api";
import {
  FUEL_LABELS,
  formatInt,
  modelLabel,
  OTHER_MODEL,
  OWNER_LABELS,
  SELLER_LABELS,
  TRANSMISSION_LABELS,
} from "../format";
import { BrandPicker } from "./BrandPicker";
import { RangeField, Segmented, SelectField } from "./Fields";

/** Switch to a model and prefill the specs of a typical listing of it. */
export function withModel(meta: Meta, car: CarInput, modelName: string, brand = car.brand): CarInput {
  const info = meta.models_by_brand[brand]?.find((m) => m.name === modelName);
  if (!info) return { ...car, brand, car_model: modelName };
  return { ...car, brand, car_model: info.name, ...info.typical };
}

/** Km a Tunisian car of this year typically has (median km per year in the Tunisian listings). */
export function typicalKm(meta: Meta, year: number): number {
  const age = Math.max(0.5, meta.market_year - year);
  return Math.min(meta.ranges.km_driven.max, Math.round((meta.km_per_year * age) / 1000) * 1000);
}

interface Props {
  meta: Meta;
  car: CarInput;
  /** True while the km follows the year automatically (the user has not typed one). */
  kmAuto: boolean;
  onChange: (car: CarInput, opts?: { kmTouched?: boolean }) => void;
  onReset: () => void;
}

export function CarForm({ meta, car, kmAuto, onChange, onReset }: Props) {
  const set = <K extends keyof CarInput>(key: K, value: CarInput[K]) => onChange({ ...car, [key]: value });
  const r = meta.ranges;
  const age = meta.market_year - car.year;
  const models = meta.models_by_brand[car.brand] ?? [];
  const current = models.find((m) => m.name === car.car_model);

  const pickYear = (year: number) =>
    onChange({ ...car, year, km_driven: kmAuto ? typicalKm(meta, year) : car.km_driven });

  const modelHint =
    current?.name === OTHER_MODEL
      ? `Modèles avec moins de ${meta.min_model_listings} annonces : ${current.pooled.join(", ")}`
      : "Entre parenthèses : nombre d’annonces. Le choix du modèle remplit ses caractéristiques habituelles.";

  const summary = [
    `${formatInt(car.km_driven)} km`,
    FUEL_LABELS[car.fuel],
    TRANSMISSION_LABELS[car.transmission],
    OWNER_LABELS[car.owner],
  ].join(" · ");

  return (
    <form className="form" onSubmit={(e) => e.preventDefault()} aria-label="Votre voiture">
      <div className="form__group">
        <h2 className="form__title">Votre voiture</h2>
        <BrandPicker
          brands={meta.brands}
          value={car.brand}
          onChange={(b) => onChange(withModel(meta, car, meta.models_by_brand[b][0].name, b))}
        />
        <SelectField
          label="Modèle"
          value={car.car_model}
          options={models.map((m) => ({
            value: m.name,
            label: m.name === OTHER_MODEL ? modelLabel(m.name) : `${m.name} (${m.listings})`,
          }))}
          hint={modelHint}
          onChange={(v) => onChange(withModel(meta, car, v))}
        />
        <RangeField
          label="Année"
          value={car.year}
          min={r.year.min}
          max={r.year.max}
          step={1}
          hint={age <= 0 ? "Voiture de l’année" : `${age} an${age > 1 ? "s" : ""} en ${meta.market_year}`}
          onChange={(v) => pickYear(Math.round(v))}
        />
      </div>

      <details className="form__group details">
        <summary className="details__summary">
          <span className="details__title">Détails (optionnel)</span>
          <span className="details__values">{summary}</span>
        </summary>
        <div className="details__body">
          <RangeField
            label="Kilométrage"
            unit="km"
            value={car.km_driven}
            min={0}
            max={r.km_driven.max}
            step={1000}
            hint={
              kmAuto
                ? `Estimé : ${formatInt(meta.km_per_year)} km par an, la médiane des annonces tunisiennes`
                : "Saisi par vous"
            }
            onChange={(v) => onChange({ ...car, km_driven: Math.round(v) }, { kmTouched: true })}
          />
          <Segmented
            label="Carburant"
            value={car.fuel}
            options={meta.fuel}
            render={(v) => FUEL_LABELS[v]}
            onChange={(v) => set("fuel", v)}
          />
          <Segmented
            label="Boîte"
            value={car.transmission}
            options={meta.transmission}
            render={(v) => TRANSMISSION_LABELS[v]}
            onChange={(v) => set("transmission", v)}
          />
          <RangeField
            label="Puissance"
            unit="ch"
            value={car.max_power_bhp}
            min={r.max_power_bhp.min}
            max={r.max_power_bhp.max}
            step={0.5}
            hint={current ? `Habituel pour ce modèle : ${current.typical.max_power_bhp} ch` : undefined}
            onChange={(v) => set("max_power_bhp", v)}
          />
          <SelectField
            label="Places"
            value={String(car.seats)}
            options={meta.seats.map((s) => ({ value: String(s), label: `${s} places` }))}
            onChange={(v) => set("seats", Number(v))}
          />
          <Segmented
            label="Historique"
            value={car.owner}
            options={meta.owner}
            render={(v) => OWNER_LABELS[v] ?? v}
            onChange={(v) => set("owner", v)}
          />
          <Segmented
            label="Vendeur"
            value={car.seller_type}
            options={meta.seller_type}
            render={(v) => SELLER_LABELS[v]}
            onChange={(v) => set("seller_type", v)}
          />
        </div>
      </details>

      <button type="button" className="btn btn--quiet" onClick={onReset}>
        Revenir à une voiture type
      </button>
    </form>
  );
}
