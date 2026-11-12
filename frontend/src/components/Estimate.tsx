import type { ReactNode } from "react";
import type { ModelName, PredictionResponse } from "../api";
import { carLabel, formatInt, formatPct, formatTnd, formatTndNumber, MODEL_LABELS } from "../format";
import { BrandLogo } from "./BrandPicker";

interface Props {
  data: PredictionResponse;
  model: ModelName;
  stale: boolean;
  action?: ReactNode;
}

export function Estimate({ data, model, stale, action }: Props) {
  const p = data.predictions[model];
  const car = data.input;
  const otherName: ModelName = model === "linear" ? "lasso" : "linear";
  const other = data.predictions[otherName];
  const diff = ((other.price_tnd - p.price_tnd) / p.price_tnd) * 100;

  // Place the point estimate on a track spanning the 80 % band.
  const span = p.high_tnd - p.low_tnd;
  const pos = span > 0 ? ((p.price_tnd - p.low_tnd) / span) * 100 : 50;

  return (
    <section className={`estimate${stale ? " is-stale" : ""}`} aria-labelledby="estimate-title" aria-busy={stale}>
      <div className="estimate__car">
        <BrandLogo brand={car.brand} size={48} />
        <div>
          <p className="estimate__name">
            {carLabel(car.brand, car.car_model)} <span className="estimate__year">{car.year}</span>
          </p>
          <p className="estimate__specs">{formatInt(car.km_driven)} km</p>
        </div>
      </div>

      <h2 id="estimate-title" className="estimate__label">
        Prix estimé sur le marché tunisien
      </h2>
      <p className="estimate__value" aria-live="polite">
        <span className="estimate__num">{formatTndNumber(p.price_tnd)}</span>
        <span className="estimate__unit">DT</span>
      </p>

      <div
        className="band"
        role="img"
        aria-label={`Fourchette à 80 % : de ${formatTnd(p.low_tnd)} à ${formatTnd(p.high_tnd)}`}
      >
        <div className="band__track">
          <span className="band__dot" style={{ left: `${pos}%` }} />
        </div>
        <div className="band__ends">
          <span>{formatTnd(p.low_tnd)}</span>
          <span>{formatTnd(p.high_tnd)}</span>
        </div>
      </div>
      <p className="estimate__note">
        Sur des annonces tunisiennes réelles, 8 prix sur 10 tombaient dans une fourchette aussi large autour de
        l’estimation.
      </p>

      <p className="estimate__compare">
        {MODEL_LABELS[otherName]} : <strong>{formatTnd(other.price_tnd)}</strong>{" "}
        <span className="muted">({formatPct(diff)})</span>
      </p>
      {action}
    </section>
  );
}
