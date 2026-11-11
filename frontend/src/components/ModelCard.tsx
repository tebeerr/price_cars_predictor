import type { Meta, ModelName } from "../api";
import { formatInt, MODEL_LABELS } from "../format";

interface Props {
  meta: Meta;
  model: ModelName;
}

const ROWS: { key: "r2_log" | "r2_lakhs" | "mae_lakhs"; label: string; fmt: (v: number) => string }[] = [
  { key: "r2_log", label: "R² on log price", fmt: (v) => v.toFixed(3) },
  { key: "r2_lakhs", label: "R² on price", fmt: (v) => v.toFixed(3) },
  { key: "mae_lakhs", label: "Mean abs. error", fmt: (v) => `${v.toFixed(2)} lakh` },
];

export function ModelCard({ meta, model }: Props) {
  const names: ModelName[] = ["linear", "lasso"];
  const lasso = meta.metrics.lasso;

  return (
    <section className="panel model" aria-labelledby="model-title">
      <div className="panel__head">
        <h3 className="panel__title" id="model-title">
          How far to trust it
        </h3>
        <p className="panel__sub">
          Scores on {formatInt(meta.test_rows)} held-out cars (20% split), after training on{" "}
          {formatInt(meta.train_rows)}.
        </p>
      </div>

      <div className="model__scroll">
        <table className="model__table">
          <thead>
            <tr>
              <th scope="col">Test set</th>
              {names.map((n) => (
                <th scope="col" key={n} className={n === model ? "is-current" : undefined}>
                  {MODEL_LABELS[n]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.key}>
                <th scope="row">{r.label}</th>
                {names.map((n) => (
                  <td key={n} className={n === model ? "is-current" : undefined}>
                    {r.fmt(meta.metrics[n].test[r.key])}
                    <span className="model__train">train {r.fmt(meta.metrics[n].train[r.key])}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="model__foot">
        Both fit log(price) on standardised inputs. LassoCV picked α = {lasso.alpha?.toPrecision(2)} and kept{" "}
        {lasso.non_zero_coefficients} of {meta.metrics.linear.non_zero_coefficients} coefficients. Prices are in
        lakh (1 lakh = ₹1,00,000); age is measured from {meta.reference_year}.
      </p>
    </section>
  );
}
