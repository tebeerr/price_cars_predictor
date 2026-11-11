import type { ReactNode } from "react";
import type { ModelName, PredictionResponse } from "../api";
import { formatInr, formatLakhs, formatPct, MODEL_LABELS } from "../format";

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
  const diff = ((other.price_lakhs - p.price_lakhs) / p.price_lakhs) * 100;

  // Place the point estimate on a track spanning the 80 % band.
  const span = p.high_lakhs - p.low_lakhs;
  const pos = span > 0 ? ((p.price_lakhs - p.low_lakhs) / span) * 100 : 50;

  return (
    <section className={`estimate${stale ? " is-stale" : ""}`} aria-labelledby="estimate-title" aria-busy={stale}>
      <h2 id="estimate-title" className="estimate__label">
        Estimated selling price
      </h2>
      <p className="estimate__value" aria-live="polite">
        <span className="estimate__num">{formatLakhs(p.price_lakhs)}</span>
        <span className="estimate__unit">lakh</span>
      </p>
      <p className="estimate__inr">{formatInr(p.price_lakhs)}</p>

      <div className="band" role="img" aria-label={`80% band from ${formatLakhs(p.low_lakhs)} to ${formatLakhs(p.high_lakhs)} lakh`}>
        <div className="band__track">
          <span className="band__dot" style={{ left: `${pos}%` }} />
        </div>
        <div className="band__ends">
          <span>{formatLakhs(p.low_lakhs)}</span>
          <span>{formatLakhs(p.high_lakhs)}</span>
        </div>
      </div>
      <p className="estimate__note">
        For 8 in 10 held-out test cars, the real price landed inside a band this wide around the estimate.
      </p>

      <p className="estimate__compare">
        {MODEL_LABELS[otherName]} says <strong>{formatLakhs(other.price_lakhs)} lakh</strong>{" "}
        <span className="muted">({formatPct(diff)})</span>
      </p>
      {action}
    </section>
  );
}
