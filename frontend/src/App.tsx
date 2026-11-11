import { useCallback, useEffect, useState } from "react";
import { ApiError, getMeta, type CarInput, type Meta, type ModelName } from "./api";
import { CarForm } from "./components/CarForm";
import { DepreciationChart } from "./components/DepreciationChart";
import { DriversChart } from "./components/DriversChart";
import { Estimate } from "./components/Estimate";
import { Segmented } from "./components/Fields";
import { History, type HistoryEntry } from "./components/History";
import { ModelCard } from "./components/ModelCard";
import { formatLakhs, MODEL_LABELS } from "./format";
import { usePrediction } from "./usePrediction";

const HISTORY_KEY = "valuer.history.v1";
const THEME_KEY = "valuer.theme";
const MODEL_KEY = "valuer.model";


const readStore = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const writeStore = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or blocked storage: the page still works */
  }
};

function typicalCar(meta: Meta): CarInput {
  return {
    brand: meta.brands.includes("Maruti") ? "Maruti" : meta.brands[0],
    year: meta.ranges.year.median,
    km_driven: meta.ranges.km_driven.median,
    fuel: "Petrol",
    seller_type: "Individual",
    transmission: "Manual",
    owner: 0,
    engine_cc: 1197,
    max_power_bhp: 82,
    seats: 5,
  };
}

type Theme = "light" | "dark" | "system";

export default function App() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaError, setMetaError] = useState<ApiError | null>(null);
  const [metaTry, setMetaTry] = useState(0);
  const [car, setCar] = useState<CarInput | null>(null);
  const [model, setModel] = useState<ModelName>(() => readStore<ModelName>(MODEL_KEY, "linear"));
  const [theme, setTheme] = useState<Theme>(() => readStore<Theme>(THEME_KEY, "system"));
  const [history, setHistory] = useState<HistoryEntry[]>(() => readStore<HistoryEntry[]>(HISTORY_KEY, []));

  useEffect(() => {
    const controller = new AbortController();
    setMetaError(null);
    getMeta(controller.signal)
      .then((m) => {
        setMeta(m);
        setCar((c) => c ?? typicalCar(m));
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setMetaError(err as ApiError);
      });
    return () => controller.abort();
  }, [metaTry]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    writeStore(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => writeStore(MODEL_KEY, model), [model]);
  useEffect(() => writeStore(HISTORY_KEY, history), [history]);

  const { data, loading, error, retry } = usePrediction(car);

  const save = useCallback(() => {
    if (!data || !car) return;
    const price = data.predictions[model].price_lakhs;
    setHistory((h) =>
      [{ car, price_lakhs: price, at: Date.now() }, ...h.filter((e) => JSON.stringify(e.car) !== JSON.stringify(car))].slice(0, 8),
    );
  }, [data, car, model]);

  const isSaved = !!car && history.some((e) => JSON.stringify(e.car) === JSON.stringify(car));
  const cycleTheme = () => setTheme((t) => (t === "system" ? "dark" : t === "dark" ? "light" : "system"));

  return (
    <div className="app">
      <header className="topbar">
        <div className="brandmark">
          <span className="brandmark__name">Valuer</span>
          <span className="brandmark__sub">Used-car price model · {meta ? `${meta.rows.toLocaleString("en-IN")} CarDekho listings` : "CarDekho data"}</span>
        </div>
        <div className="topbar__tools">
          <div className="topbar__model">
            <Segmented
              label="Model"
              value={model}
              options={["linear", "lasso"] as const}
              render={(v) => (v === "linear" ? "Linear" : "Lasso")}
              onChange={setModel}
            />
          </div>
          <button type="button" className="btn btn--icon" onClick={cycleTheme} aria-label={`Theme: ${theme}. Change theme`}>
            <ThemeIcon theme={theme} />
            <span className="btn__text">{theme === "system" ? "Auto" : theme === "dark" ? "Dark" : "Light"}</span>
          </button>
        </div>
      </header>

      {!meta ? (
        <main className="state">
          {metaError ? (
            <div className="state__box" role="alert">
              <h1 className="state__title">Can’t reach the model</h1>
              <p>Start the API, then try again:</p>
              <pre className="state__code">cd backend{"\n"}.venv\Scripts\activate{"\n"}uvicorn app:app --port 8000</pre>
              <button type="button" className="btn btn--primary" onClick={() => setMetaTry((n) => n + 1)}>
                Try again
              </button>
            </div>
          ) : (
            <p className="state__loading">Loading the model…</p>
          )}
        </main>
      ) : (
        car && (
          <main className="bench">
            <aside className="bench__controls">
              <CarForm meta={meta} car={car} onChange={setCar} onReset={() => setCar(typicalCar(meta))} />
            </aside>

            <div className="bench__output">
              {error && (
                <div className="alert" role="alert">
                  <span>{error.status === 0 ? "Lost the connection to the model." : error.message}</span>
                  <button type="button" className="btn btn--link" onClick={retry}>
                    Retry
                  </button>
                </div>
              )}

              {data ? (
                <>
                  <div className="bench__top">
                    <Estimate
                      data={data}
                      model={model}
                      stale={loading}
                      action={
                        <button type="button" className="btn btn--primary" onClick={save} disabled={loading || isSaved}>
                          {isSaved ? "Saved" : "Save estimate"}
                        </button>
                      }
                    />
                    <History entries={history} current={car} onPick={setCar} onClear={() => setHistory([])} />
                  </div>

                  <div className="bench__charts">
                    <DepreciationChart
                      points={data.predictions[model].depreciation}
                      selectedYear={data.input.year}
                      metrics={meta.metrics[model]}
                      onPickYear={(year) => setCar({ ...car, year })}
                    />
                    <DriversChart contributions={data.predictions[model].contributions} />
                  </div>

                  <ModelCard meta={meta} model={model} />

                  {/* Small screens: the form comes first, so keep the answer in reach. */}
                  <a className={`pricebar${loading ? " is-stale" : ""}`} href="#estimate-title">
                    <span className="pricebar__label">Estimate</span>
                    <span className="pricebar__value">{formatLakhs(data.predictions[model].price_lakhs)} lakh</span>
                    <span className="pricebar__go">See details</span>
                  </a>
                </>
              ) : (
                !error && <p className="state__loading">Pricing your car…</p>
              )}
            </div>
          </main>
        )
      )}

      <footer className="footnote">
        <p>
          {MODEL_LABELS[model]} trained on log(price) from the CarDekho merged dataset. An estimate, not an offer.
        </p>
      </footer>
    </div>
  );
}

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === "dark")
    return (
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z" fill="currentColor" />
      </svg>
    );
  if (theme === "light")
    return (
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <circle cx="8" cy="8" r="3" fill="currentColor" />
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 2a6 6 0 0 1 0 12Z" fill="currentColor" />
    </svg>
  );
}
