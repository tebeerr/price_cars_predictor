import { useEffect, useId, useState, type ReactNode } from "react";

/* Segmented control built on native radios: arrow keys, focus and
   form semantics come for free. */
export function Segmented<T extends string | number>(props: {
  label: string;
  value: T;
  options: readonly T[];
  render?: (v: T) => ReactNode;
  onChange: (v: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="field">
      <legend className="field__label">{props.label}</legend>
      <div className="segmented" style={{ ["--count" as string]: props.options.length }}>
        {props.options.map((opt) => (
          <label key={String(opt)} className="segmented__item">
            <input
              type="radio"
              name={name}
              checked={opt === props.value}
              onChange={() => props.onChange(opt)}
            />
            <span>{props.render ? props.render(opt) : String(opt)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SelectField(props: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  hint?: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  const hintId = useId();
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {props.label}
      </label>
      <div className="select">
        <select
          id={id}
          value={props.value}
          aria-describedby={props.hint ? hintId : undefined}
          onChange={(e) => props.onChange(e.target.value)}
        >
          {props.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg aria-hidden="true" viewBox="0 0 12 12" width="12" height="12">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
      {props.hint && (
        <p className="field__hint" id={hintId}>
          {props.hint}
        </p>
      )}
    </div>
  );
}

/* Slider + typed number, kept in sync. The text box holds a draft so the
   user can type "12" on the way to "120000" without it snapping back. */
export function RangeField(props: {
  label: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  hint?: string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  const hintId = useId();
  const [draft, setDraft] = useState(String(props.value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setDraft(String(props.value));
    setInvalid(false);
  }, [props.value]);

  const commit = (raw: string) => {
    const n = Number(raw.replace(/[,\s]/g, ""));
    if (raw.trim() === "" || !Number.isFinite(n) || n < props.min || n > props.max) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    props.onChange(n);
  };

  const pct = ((props.value - props.min) / (props.max - props.min)) * 100;

  return (
    <div className={`field${invalid ? " field--invalid" : ""}`}>
      <div className="field__head">
        <label className="field__label" htmlFor={id}>
          {props.label}
        </label>
        <div className="numbox">
          <input
            id={id}
            inputMode="decimal"
            value={draft}
            aria-invalid={invalid}
            aria-describedby={hintId}
            onChange={(e) => {
              setDraft(e.target.value);
              const n = Number(e.target.value.replace(/[,\s]/g, ""));
              if (Number.isFinite(n) && n >= props.min && n <= props.max && e.target.value.trim() !== "") {
                setInvalid(false);
                props.onChange(n);
              }
            }}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commit((e.target as HTMLInputElement).value)}
          />
          {props.unit && <span className="numbox__unit">{props.unit}</span>}
        </div>
      </div>
      <input
        type="range"
        className="slider"
        aria-label={`${props.label} (curseur)`}
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        style={{ ["--fill" as string]: `${pct}%` }}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
      <p className="field__hint" id={hintId}>
        {invalid ? `Saisissez une valeur entre ${props.min} et ${props.max}.` : props.hint}
      </p>
    </div>
  );
}
