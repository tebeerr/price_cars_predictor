import type { ReactNode } from "react";
import type { ModelName, PredictionResponse } from "../api";
import { formatPct, formatTnd, formatTndNumber, MODEL_LABELS } from "../format";

interface Props {
  data: PredictionResponse;
  model: ModelName;
  stale: boolean;
  action?: ReactNode;
}

export function Estimate({ data, model, stale, action }: Props) {
  const p = data.predictions[model];
  const otherName: ModelName = model === "linear" ? "lasso" : "linear";
  const other = data.predictions[otherName];
  const diff = ((other.price_tnd - p.price_tnd) / p.price_tnd) * 100;

  // Place the point estimate on a track spanning the 80 % band.
  const span = p.high_tnd - p.low_tnd;
  const pos = span > 0 ? ((p.price_tnd - p.low_tnd) / span) * 100 : 50;

  return (
    <section className={`estimate${stale ? " is-stale" : ""}`} aria-labelledby="estimate-title" aria-busy={stale}>
      <h2 id="estimate-title" className="estimate__label">
        Estimated selling price
      </h2>
      <p className="estimate__value" aria-live="polite">
        <span className="estimate__num">{formatTndNumber(p.price_tnd)}</span>
        <span className="estimate__unit">DT</span>
      </p>
      <p className="estimate__cur">Tunisian dinars</p>

      <div className="band" role="img" aria-label={`80% band from ${formatTnd(p.low_tnd)} to ${formatTnd(p.high_tnd)}`}>
        <div className="band__track">
          <span className="band__dot" style={{ left: `${pos}%` }} />
        </div>
        <div className="band__ends">
          <span>{formatTnd(p.low_tnd)}</span>
          <span>{formatTnd(p.high_tnd)}</span>
        </div>
      </div>
      <p className="estimate__note">
        For 8 in 10 held-out test cars, the real price landed inside a band this wide around the estimate.
      </p>

      <p className="estimate__compare">
        {MODEL_LABELS[otherName]} says <strong>{formatTnd(other.price_tnd)}</strong>{" "}
        <span className="muted">({formatPct(diff)})</span>
      </p>
      {action}
    </section>
  );
}
