import { useState } from "react";
import type { Contribution } from "../api";
import { FEATURE_LABELS, formatPct } from "../format";

interface Props {
  contributions: Contribution[];
}

/* Diverging bars: each feature's push on log(price) against the
   average car in the training set. Bar length is the log effect, so a
   +50 % push and a −33 % push (the same factor of 1.5) draw equally long. */
export function DriversChart({ contributions }: Props) {
  const [active, setActive] = useState<string | null>(null);
  const maxAbs = Math.max(0.05, ...contributions.map((c) => Math.abs(c.log_effect)));

  return (
    <figure className="panel drivers">
      <figcaption className="panel__head">
        <h3 className="panel__title">What moves this price</h3>
        <p className="panel__sub">Each input’s effect against the average car in the training data.</p>
        <ul className="legend" aria-label="Legend">
          <li>
            <span className="legend__swatch legend__swatch--up" /> Raises price
          </li>
          <li>
            <span className="legend__swatch legend__swatch--down" /> Lowers price
          </li>
        </ul>
      </figcaption>

      <ul className="drivers__list">
        {contributions.map((c) => {
          const w = (Math.abs(c.log_effect) / maxAbs) * 50;
          const up = c.log_effect >= 0;
          const label = FEATURE_LABELS[c.feature] ?? c.feature;
          return (
            <li
              key={c.feature}
              className={`drivers__row${active === c.feature ? " is-active" : ""}`}
              tabIndex={0}
              aria-label={`${label}: ${formatPct(c.pct_effect)} ${up ? "above" : "below"} the average car`}
              onPointerEnter={() => setActive(c.feature)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(c.feature)}
              onBlur={() => setActive(null)}
            >
              <span className="drivers__name">{label}</span>
              <span className="drivers__track" aria-hidden="true">
                <span
                  className={`drivers__bar drivers__bar--${up ? "up" : "down"}`}
                  style={up ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }}
                />
              </span>
              <span className="drivers__val">{formatPct(c.pct_effect)}</span>
              {active === c.feature && (
                <span className="tooltip tooltip--row" role="presentation">
                  <span className="tooltip__k">{label}</span>
                  <span className="tooltip__v">
                    ×{Math.exp(c.log_effect).toFixed(3)} on price
                  </span>
                  <span className="tooltip__s">
                    {up ? "Pushes above" : "Pulls below"} the average car by {formatPct(c.pct_effect).replace(/^[+−]/, "")}
                  </span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
