import { useEffect, useMemo, useRef, useState } from "react";
import type { CurvePoint, ModelMetrics } from "../api";
import { formatTnd, formatTndShort } from "../format";

interface Props {
  points: CurvePoint[];
  selectedYear: number;
  metrics: ModelMetrics;
  onPickYear: (year: number) => void;
}

const H = 240;
const M = { top: 26, right: 16, bottom: 28, left: 44 };

function niceTicks(max: number, count = 4): number[] {
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(+v.toFixed(6));
  if (ticks[ticks.length - 1] < max) ticks.push(+(ticks[ticks.length - 1] + step).toFixed(6));
  return ticks;
}

export function DepreciationChart({ points, selectedYear, metrics, onPickYear }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(260, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const lo = Math.exp(metrics.residual_q10);
  const hi = Math.exp(metrics.residual_q90);

  const geo = useMemo(() => {
    const innerW = width - M.left - M.right;
    const innerH = H - M.top - M.bottom;
    const years = points.map((p) => p.year);
    const x0 = Math.min(...years);
    const x1 = Math.max(...years);
    const yTicks = niceTicks(Math.max(...points.map((p) => p.price_tnd * hi)));
    const yMax = yTicks[yTicks.length - 1];
    const x = (yr: number) => M.left + ((yr - x0) / Math.max(1, x1 - x0)) * innerW;
    const y = (v: number) => M.top + innerH - (v / yMax) * innerH;
    const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.year).toFixed(1)},${y(p.price_tnd).toFixed(1)}`).join("");
    const upper = points.map((p, i) => `${i ? "L" : "M"}${x(p.year).toFixed(1)},${y(p.price_tnd * hi).toFixed(1)}`).join("");
    const lower = [...points].reverse().map((p) => `L${x(p.year).toFixed(1)},${y(p.price_tnd * lo).toFixed(1)}`).join("");
    const step = innerW / Math.max(1, points.length - 1);
    const xTickEvery = step < 28 ? (step < 16 ? 4 : 2) : 1;
    return { x, y, line, band: `${upper}${lower}Z`, yTicks, innerW, step, xTickEvery };
  }, [points, width, hi, lo]);

  const activeYear = hover ?? selectedYear;
  const active = points.find((p) => p.year === activeYear) ?? points[points.length - 1];
  const sel = points.find((p) => p.year === selectedYear);

  const yearAt = (clientX: number, svg: SVGSVGElement) => {
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * width;
    const i = Math.round((px - M.left) / geo.step);
    return points[Math.min(points.length - 1, Math.max(0, i))].year;
  };

  const tipLeft = Math.min(Math.max(geo.x(active.year), 70), width - 70);

  return (
    <figure className="panel chart">
      <figcaption className="panel__head">
        <h3 className="panel__title">Same car, other model years</h3>
        <p className="panel__sub">Predicted price if everything else stayed equal. Shaded: 80% band.</p>
      </figcaption>

      <div className="chart__plot" ref={wrapRef}>
        <svg
          width={width}
          height={H}
          viewBox={`0 0 ${width} ${H}`}
          role="img"
          aria-label={`Predicted price by model year, from ${formatTnd(points[0].price_tnd)} in ${points[0].year} to ${formatTnd(points[points.length - 1].price_tnd)} in ${points[points.length - 1].year}. Use left and right arrows to inspect years; Enter to apply.`}
          tabIndex={0}
          onPointerMove={(e) => setHover(yearAt(e.clientX, e.currentTarget))}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => onPickYear(yearAt(e.clientX, e.currentTarget))}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            const i = points.findIndex((p) => p.year === activeYear);
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              const next = Math.min(points.length - 1, Math.max(0, i + (e.key === "ArrowLeft" ? -1 : 1)));
              setHover(points[next].year);
            } else if (e.key === "Enter" && hover != null) {
              onPickYear(hover);
            }
          }}
        >
          {geo.yTicks.map((t) => (
            <g key={t}>
              <line className="chart__grid" x1={M.left} x2={width - M.right} y1={geo.y(t)} y2={geo.y(t)} />
              <text className="chart__tick" x={M.left - 8} y={geo.y(t)} dy="0.32em" textAnchor="end">
                {formatTndShort(t)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            (i % geo.xTickEvery === 0 && points.length - 1 - i >= geo.xTickEvery) || i === points.length - 1 ? (
              <text key={p.year} className="chart__tick" x={geo.x(p.year)} y={H - 8} textAnchor="middle">
                {geo.step < 40 ? `’${String(p.year).slice(2)}` : p.year}
              </text>
            ) : null,
          )}
          <text className="chart__tick" x={M.left - 8} y={10} textAnchor="end">
            DT
          </text>

          <path className="chart__band" d={geo.band} />
          <path className="chart__line" d={geo.line} />

          <line className="chart__cross" x1={geo.x(active.year)} x2={geo.x(active.year)} y1={M.top} y2={H - M.bottom} />
          {sel && (
            <circle className="chart__dot chart__dot--sel" cx={geo.x(sel.year)} cy={geo.y(sel.price_tnd)} r={5} />
          )}
          {hover != null && hover !== selectedYear && (
            <circle className="chart__dot" cx={geo.x(active.year)} cy={geo.y(active.price_tnd)} r={4} />
          )}
        </svg>

        <div className="tooltip" style={{ left: tipLeft }} aria-hidden="true">
          <span className="tooltip__k">
            {active.year}
            {active.year === selectedYear ? " · your car" : ""}
          </span>
          <span className="tooltip__v">{formatTnd(active.price_tnd)}</span>
        </div>
      </div>

      <details className="chart__table">
        <summary>View as table</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col">Price (DT)</th>
              <th scope="col">80% band</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.year} aria-current={p.year === selectedYear ? "true" : undefined}>
                <td>{p.year}</td>
                <td>{formatTnd(p.price_tnd)}</td>
                <td>
                  {formatTnd(p.price_tnd * lo)} – {formatTnd(p.price_tnd * hi)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
