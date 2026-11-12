import { useId } from "react";
import { brandLabel, brandLogo } from "../format";

interface Props {
  brands: string[];
  value: string;
  onChange: (brand: string) => void;
}

/* Grid of brand logos built on native radios: arrow keys move between
   brands and the group reads as one choice to screen readers. */
export function BrandPicker({ brands, value, onChange }: Props) {
  const name = useId();
  return (
    <fieldset className="field">
      <legend className="field__label">Marque</legend>
      <div className="brands">
        {brands.map((b) => {
          const logo = brandLogo(b);
          return (
            <label key={b} className="brands__item" title={brandLabel(b)}>
              <input type="radio" name={name} checked={b === value} onChange={() => onChange(b)} />
              <span className="brands__tile">
                <span className="brands__logo" aria-hidden="true">
                  {logo ? <img src={logo} alt="" loading="lazy" /> : <CarIcon />}
                </span>
                <span className="brands__name">{brandLabel(b)}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function BrandLogo({ brand, size = 40 }: { brand: string; size?: number }) {
  const logo = brandLogo(brand);
  return (
    <span className="logo-chip" style={{ width: size, height: size }} aria-hidden="true">
      {logo ? <img src={logo} alt="" /> : <CarIcon />}
    </span>
  );
}

function CarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 16V11.5L7 7h10l2 4.5V16" />
      <path d="M3.5 16h17v2.5h-17z" />
      <circle cx="7.5" cy="16" r="1.6" />
      <circle cx="16.5" cy="16" r="1.6" />
      <path d="M5 11.5h14" />
    </svg>
  );
}
