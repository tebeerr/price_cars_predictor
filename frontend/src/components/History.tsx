import type { CarInput } from "../api";
import { carLabel, FUEL_LABELS, formatInt, formatTnd, TRANSMISSION_LABELS } from "../format";
import { BrandLogo } from "./BrandPicker";

export interface HistoryEntry {
  car: CarInput;
  price_tnd: number;
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
          Estimations enregistrées
        </h3>
        {entries.length > 0 && (
          <button type="button" className="btn btn--link" onClick={onClear}>
            Effacer
          </button>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="panel__sub">Enregistrez une estimation pour comparer plusieurs voitures. Elles restent dans ce navigateur.</p>
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
                  <BrandLogo brand={e.car.brand} size={32} />
                  <span className="history__car">
                    {carLabel(e.car.brand, e.car.car_model)} · {e.car.year}
                    <span className="history__meta">
                      {formatInt(e.car.km_driven)} km · {FUEL_LABELS[e.car.fuel]} · {TRANSMISSION_LABELS[e.car.transmission]}
                    </span>
                  </span>
                  <span className="history__price">{formatTnd(e.price_tnd)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
