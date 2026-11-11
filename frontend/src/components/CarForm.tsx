import type { CarInput, Meta } from "../api";
import { brandLabel, formatInt, OWNER_LABELS } from "../format";
import { RangeField, Segmented, SelectField } from "./Fields";

interface Props {
  meta: Meta;
  car: CarInput;
  onChange: (car: CarInput) => void;
  onReset: () => void;
}

export function CarForm({ meta, car, onChange, onReset }: Props) {
  const set = <K extends keyof CarInput>(key: K, value: CarInput[K]) => onChange({ ...car, [key]: value });
  const r = meta.ranges;
  const age = meta.reference_year - car.year;

  return (
    <form className="form" onSubmit={(e) => e.preventDefault()} aria-label="Car details">
      <div className="form__group">
        <h2 className="form__title">The car</h2>
        <SelectField
          label="Brand"
          value={car.brand}
          options={meta.brands.map((b) => ({ value: b, label: brandLabel(b) }))}
          onChange={(v) => set("brand", v)}
        />
        <RangeField
          label="Model year"
          value={car.year}
          min={r.year.min}
          max={r.year.max}
          step={1}
          hint={`${age} ${age === 1 ? "year" : "years"} old in ${meta.reference_year}, the model's reference year`}
          onChange={(v) => set("year", Math.round(v))}
        />
        <Segmented label="Fuel" value={car.fuel} options={meta.fuel} onChange={(v) => set("fuel", v)} />
        <Segmented
          label="Gearbox"
          value={car.transmission}
          options={meta.transmission}
          onChange={(v) => set("transmission", v)}
        />
      </div>

      <div className="form__group">
        <h2 className="form__title">Engine</h2>
        <RangeField
          label="Engine size"
          unit="cc"
          value={car.engine_cc}
          min={r.engine_cc.min}
          max={r.engine_cc.max}
          step={1}
          hint={`Dataset median ${formatInt(r.engine_cc.median)} cc`}
          onChange={(v) => set("engine_cc", Math.round(v))}
        />
        <RangeField
          label="Max power"
          unit="bhp"
          value={car.max_power_bhp}
          min={r.max_power_bhp.min}
          max={r.max_power_bhp.max}
          step={0.5}
          hint={`Dataset median ${r.max_power_bhp.median} bhp`}
          onChange={(v) => set("max_power_bhp", v)}
        />
        <SelectField
          label="Seats"
          value={String(car.seats)}
          options={meta.seats.map((s) => ({ value: String(s), label: `${s} seats` }))}
          onChange={(v) => set("seats", Number(v))}
        />
      </div>

      <div className="form__group">
        <h2 className="form__title">History</h2>
        <RangeField
          label="Kilometres driven"
          unit="km"
          value={car.km_driven}
          min={0}
          max={r.km_driven.max}
          step={1000}
          hint={`Dataset median ${formatInt(r.km_driven.median)} km`}
          onChange={(v) => set("km_driven", Math.round(v))}
        />
        <Segmented
          label="Owner"
          value={car.owner}
          options={meta.owner}
          render={(v) => OWNER_LABELS[v] ?? v}
          onChange={(v) => set("owner", v)}
        />
        <Segmented
          label="Sold by"
          value={car.seller_type}
          options={meta.seller_type}
          onChange={(v) => set("seller_type", v)}
        />
      </div>

      <button type="button" className="btn btn--quiet" onClick={onReset}>
        Reset to a typical car
      </button>
    </form>
  );
}
