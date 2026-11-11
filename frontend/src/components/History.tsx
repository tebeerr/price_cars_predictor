import type { CarInput } from "../api";
import { brandLabel, formatInt, formatLakhs } from "../format";

export interface HistoryEntry {
  car: CarInput;
  price_lakhs: number;
  at: number;
}

interface Props {
  entries: HistoryEntry[];
  current: CarInput;
  onPick: (car: CarInput) => void;
  onClear: () => void;
}

export function History({ entries, current, onPick, onClear }: Props) {
  const currentKey = JSON.stringify(current);
  return (
    <section className="panel history" aria-labelledby="history-title">
      <div className="panel__head panel__head--row">
        <h3 className="panel__title" id="history-title">
          Saved estimates
        </h3>
        {entries.length > 0 && (
          <button type="button" className="btn btn--link" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="panel__sub">Save an estimate to compare cars side by side. Saved cars stay in this browser.</p>
      ) : (
        <ol className="history__list">
          {entries.map((e) => {
            const isCurrent = JSON.stringify(e.car) === currentKey;
            return (
              <li key={e.at}>
                <button
                  type="button"
                  className={`history__item${isCurrent ? " is-current" : ""}`}
                  onClick={() => onPick(e.car)}
                  aria-current={isCurrent ? "true" : undefined}
                >
                  <span className="history__car">
                    {brandLabel(e.car.brand)} · {e.car.year}
                    <span className="history__meta">
                      {formatInt(e.car.km_driven)} km · {e.car.fuel} · {e.car.transmission}
                    </span>
                  </span>
                  <span className="history__price">{formatLakhs(e.price_lakhs)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
