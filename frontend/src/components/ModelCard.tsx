import type { Meta, ModelName } from "../api";
import { formatInt, MODEL_LABELS } from "../format";

interface Props {
  meta: Meta;
  model: ModelName;
}

const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")} %`;
const r2 = (v: number) => v.toFixed(3).replace(".", ",");

export function ModelCard({ meta, model }: Props) {
  const names: ModelName[] = ["linear", "lasso"];
  const tn = meta.metrics[model].tunisia;

  const rows: { label: string; value: (n: ModelName) => string; sub?: (n: ModelName) => string }[] = [
    {
      label: "Erreur médiane, annonces tunisiennes",
      value: (n) => pct(meta.metrics[n].tunisia.median_ape),
      sub: (n) => `taux de change seul : ${pct(meta.metrics[n].tunisia.naive_median_ape)}`,
    },
    {
      label: "R² sur le prix (CarDekho, test)",
      value: (n) => r2(meta.metrics[n].test.r2_price),
      sub: (n) => `entraînement ${r2(meta.metrics[n].train.r2_price)}`,
    },
    {
      label: "R² sur log(prix) (CarDekho, test)",
      value: (n) => r2(meta.metrics[n].test.r2_log),
      sub: (n) => `entraînement ${r2(meta.metrics[n].train.r2_log)}`,
    },
  ];

  return (
    <section className="panel model" aria-labelledby="model-title">
      <div className="panel__head">
        <h3 className="panel__title" id="model-title">
          Quelle confiance accorder à l’estimation
        </h3>
        <p className="panel__sub">
          Le modèle apprend la valeur relative des voitures sur {formatInt(meta.rows)} annonces CarDekho (Inde), puis
          il est calibré sur {tn.listings} annonces tunisiennes réelles.
        </p>
      </div>

      <div className="model__scroll">
        <table className="model__table">
          <thead>
            <tr>
              <th scope="col">Mesure</th>
              {names.map((n) => (
                <th scope="col" key={n} className={n === model ? "is-current" : undefined}>
                  {MODEL_LABELS[n]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                {names.map((n) => (
                  <td key={n} className={n === model ? "is-current" : undefined}>
                    {r.value(n)}
                    {r.sub && <span className="model__train">{r.sub(n)}</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="model__foot">
        L’erreur tunisienne est mesurée en retirant chaque modèle de voiture du calibrage avant de le prédire (
        {tn.car_models.join(", ")}). Les prix tunisiens sont environ 2 fois plus élevés qu’en Inde pour une voiture
        récente, et jusqu’à 6 fois pour une voiture ancienne : la calibration en tient compte. Annonces relevées sur
        autoprix.tn et automobile.tn en novembre {meta.market_year}. Les prix réels varient selon l’état, les options et
        la négociation.
      </p>
    </section>
  );
}
