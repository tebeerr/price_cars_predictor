"""Extract a clean car model ("Corolla", "Swift Dzire", "Kia Seltos") from a listing name.

The dataset only has the full listing name ("Toyota Corolla Altis 1.8 VL CVT"),
so the model is the first word(s) after the brand, normalised so that the
same car written differently ("KWID" / "Kwid", "3 Series" / "3-Series",
"Maruti Suzuki Swift" / "Maruti Swift") ends up under one name.
"""

from __future__ import annotations

import re
from collections import Counter

import pandas as pd

# Words that sit between the brand and the model in some listing names.
_SKIP_PREFIX = {"Suzuki", "Rover", "New", "Renault", "Ssangyong"}

# Two-word models: (first word, second word) -> model name.
_TWO_WORDS = {
    ("swift", "dzire"): "Swift Dzire",
    ("wagon", "r"): "Wagon R",
    ("vitara", "brezza"): "Vitara Brezza",
    ("grand", "vitara"): "Grand Vitara",
    ("grand", "i10"): "Grand i10",
    ("elite", "i20"): "i20",
    ("santa", "fe"): "Santa Fe",
    ("grande", "punto"): "Punto",
    ("platinum", "etios"): "Etios",
    ("urban", "cruiser"): "Urban Cruiser",
    ("land", "cruiser"): "Land Cruiser",
    ("range", "rover"): "Range Rover",
    ("innova", "crysta"): "Innova Crysta",
    ("b", "class"): "B-Class",
}

# Single-word spellings of the same model.
_ALIASES = {
    "dzire": "Swift Dzire",
    "tuv": "TUV300",
    "kuv": "KUV100",
    "brv": "BR-V",
    "mu": "MU-X",
    "mux": "MU-X",
}


def _key(word: str) -> str:
    return re.sub(r"[-\s]", "", word.lower())


def raw_model(name: str, brand: str) -> str:
    """Model as written in the listing, before spelling normalisation."""
    tokens = name.split()
    maker = ""
    if brand == "Other":
        # Brand column is "Other"; the real maker is the first word (Kia, MG, Volvo…).
        maker, tokens = tokens[0], tokens[1:]
    else:
        tokens = tokens[len(brand.split()):]
    while len(tokens) > 1 and tokens[0] in _SKIP_PREFIX:
        tokens = tokens[1:]
    if not tokens:
        return maker or brand

    first = tokens[0]
    second = tokens[1] if len(tokens) > 1 else ""
    if (first.lower(), second.lower()) in _TWO_WORDS:
        model = _TWO_WORDS[(first.lower(), second.lower())]
    elif first.isdigit() and second.lower() == "series":  # BMW "3 Series"
        model = f"{first}-Series"
    else:
        model = _ALIASES.get(_key(first), first)
    return f"{maker} {model}".strip()


MIN_MAKER_LISTINGS = 5  # makers hidden in brand "Other" with at least this many listings get their own brand
BRAND_RENAMES = {"Land": "Land Rover"}


def clean_brand_and_model(df: pd.DataFrame) -> pd.DataFrame:
    """Return `brand` and `model` columns for a dataframe with the raw `name` and `brand`.

    - `model` is extracted from the listing name (see `add_model_column`).
    - Brand "Land" becomes "Land Rover".
    - Brand "Other" hid real makers (Kia, MG, Volvo…). Makers with at least
      MIN_MAKER_LISTINGS listings become a brand of their own ("Kia" / "Seltos");
      the rest stay under "Other" with the maker in the model name ("Lexus ES").
    """
    out = pd.DataFrame({"brand": df["brand"].replace(BRAND_RENAMES)}, index=df.index)
    out["model"] = add_model_column(df.assign(brand=df["brand"]))
    other = out["brand"] == "Other"
    maker = out.loc[other, "model"].str.split(n=1).str[0]
    big = maker.map(maker.value_counts()) >= MIN_MAKER_LISTINGS
    idx = maker[big].index
    out.loc[idx, "brand"] = maker[big]
    out.loc[idx, "model"] = out.loc[idx, "model"].str.split(n=1).str[1].fillna(OTHER_FALLBACK)
    return out


OTHER_FALLBACK = "Other"


def add_model_column(df: pd.DataFrame) -> pd.Series:
    """Return the normalised model for every row of a dataframe with name + brand."""
    raw = [raw_model(n, b) for n, b in zip(df["name"], df["brand"])]
    # Same model with different case / hyphens -> keep the most frequent spelling.
    spellings: dict[tuple[str, str], Counter] = {}
    for brand, m in zip(df["brand"], raw):
        spellings.setdefault((brand, _key(m)), Counter())[m] += 1
    canonical = {k: c.most_common(1)[0][0] for k, c in spellings.items()}
    return pd.Series(
        [canonical[(b, _key(m))] for b, m in zip(df["brand"], raw)],
        index=df.index,
        name="model",
    )
