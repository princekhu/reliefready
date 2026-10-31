"""
ReliefReady - Demand Estimation Model
=====================================

What it does
------------
Predicts how much food, drinking water and medical kits a village needs for ONE day,
from its population profile. The website uses this model to:

  1. Auto-fill the request when a coordinator adds a new affected area.
  2. Flag requests that look much higher or lower than expected, so a human checks them.

The model never changes the allocation by itself. It only advises.

Honest note on data
-------------------
We do not have real historical relief records, so we generate SYNTHETIC training data
from written planning assumptions (listed in ASSUMPTIONS below) plus random noise.
The model therefore learns our assumptions, not ground truth. To make it real,
replace `generate_synthetic_data()` with past relief distribution records
(for example district disaster-management logs) and retrain. Nothing else changes.

Why linear regression
---------------------
Every prediction must be explainable to a coordinator: "need = 3.0 L x people + ...".
Coefficients are exported to JavaScript and shown on the website.

Run
---
    pip install -r ml/requirements.txt
    python ml/train_demand_model.py

Outputs
-------
    ml/data/synthetic_villages.csv   training data
    ml/model.json                    coefficients + metrics
    js/model.js                      same, loaded by the website
    backend/app/demand_model.json    same, loaded by the API
"""

import json
from pathlib import Path

import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

SEED = 42
N_ROWS = 3000
ROOT = Path(__file__).resolve().parent.parent

# Planning assumptions used to generate synthetic data (per day).
# These are our team's assumptions for the demo, loosely informed by humanitarian
# planning practice (a few litres of drinking water per person per day as a survival
# minimum). Replace them with your district's own norms.
ASSUMPTIONS = {
    "water_L_per_person": 3.0,
    "water_extra_L_per_infant": 1.5,
    "water_extra_L_per_elderly": 1.0,
    "water_extra_L_per_injured": 1.0,
    "water_factor_if_safe_source": 0.55,
    "food_packets_per_person": 1.0,
    "food_backlog_per_day_without_aid": 0.04,
    "meds_kits_per_30_people": 1.0,
    "meds_kits_per_2_injured": 1.0,
    "meds_kits_per_4_pregnant": 1.0,
    "meds_kits_per_10_infants": 1.0,
    "noise_pct": 0.08,
}

FEATURES = [
    "people", "infants", "elderly", "pregnant", "injured",
    "water_source", "days_since_aid",
    "people_x_water_source", "people_x_days",
]
TARGETS = ["food", "water", "meds"]


def generate_synthetic_data(n: int, rng: np.random.Generator):
    a = ASSUMPTIONS
    people = rng.integers(30, 1200, n)
    infants = np.round(people * rng.uniform(0.02, 0.07, n))
    elderly = np.round(people * rng.uniform(0.06, 0.25, n))
    pregnant = np.round(people * rng.uniform(0.005, 0.03, n))
    injured = np.round(people * rng.uniform(0.0, 0.05, n))
    water_source = rng.integers(0, 2, n)
    days = rng.integers(0, 6, n)

    water = (a["water_L_per_person"] * people
             + a["water_extra_L_per_infant"] * infants
             + a["water_extra_L_per_elderly"] * elderly
             + a["water_extra_L_per_injured"] * injured)
    water = water * np.where(water_source == 1, a["water_factor_if_safe_source"], 1.0)

    food = a["food_packets_per_person"] * people * (1 + a["food_backlog_per_day_without_aid"] * days)

    meds = (people / 30 * a["meds_kits_per_30_people"]
            + injured / 2 * a["meds_kits_per_2_injured"]
            + pregnant / 4 * a["meds_kits_per_4_pregnant"]
            + infants / 10 * a["meds_kits_per_10_infants"])

    def noisy(v):
        return np.maximum(0, v * (1 + rng.normal(0, a["noise_pct"], n)))

    X = np.column_stack([
        people, infants, elderly, pregnant, injured, water_source, days,
        people * water_source, people * days,
    ]).astype(float)
    Y = {"food": noisy(food), "water": noisy(water), "meds": noisy(meds)}
    return X, Y


def main():
    rng = np.random.default_rng(SEED)
    X, Y = generate_synthetic_data(N_ROWS, rng)

    data_dir = ROOT / "ml" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    header = ",".join(FEATURES + TARGETS)
    table = np.column_stack([X] + [Y[t] for t in TARGETS])
    np.savetxt(data_dir / "synthetic_villages.csv", table, delimiter=",", header=header,
               comments="", fmt="%.3f")

    model_out = {
        "name": "ReliefReady daily demand estimator",
        "type": "linear_regression",
        "trained_on": f"{N_ROWS} synthetic villages (seed {SEED})",
        "data_is_synthetic": True,
        "features": FEATURES,
        "assumptions": ASSUMPTIONS,
        "targets": {},
    }

    print(f"Training on {N_ROWS} synthetic villages\n")
    for t in TARGETS:
        X_tr, X_te, y_tr, y_te = train_test_split(X, Y[t], test_size=0.2, random_state=SEED)
        m = LinearRegression().fit(X_tr, y_tr)
        pred = m.predict(X_te)
        r2 = r2_score(y_te, pred)
        mae = mean_absolute_error(y_te, pred)
        mape = float(np.mean(np.abs(pred - y_te) / np.maximum(y_te, 1)) * 100)
        model_out["targets"][t] = {
            "intercept": round(float(m.intercept_), 5),
            "coef": {f: round(float(c), 5) for f, c in zip(FEATURES, m.coef_)},
            "metrics": {"r2": round(r2, 4), "mae": round(mae, 2), "mape_pct": round(mape, 2),
                        "test_rows": int(len(y_te))},
        }
        print(f"{t:6s}  R2={r2:.3f}  MAE={mae:8.2f}  MAPE={mape:5.2f}%")

    (ROOT / "ml" / "model.json").write_text(json.dumps(model_out, indent=2))
    # same model for the API server (Render deploys only the backend/ folder)
    (ROOT / "backend" / "app" / "demand_model.json").write_text(json.dumps(model_out, indent=2))
    js = ("// AUTO-GENERATED by ml/train_demand_model.py - do not edit by hand.\n"
          "(function (root) {\n  const model = " + json.dumps(model_out, indent=2) + ";\n"
          "  root.DEMAND_MODEL = model;\n"
          "  if (typeof module !== 'undefined' && module.exports) module.exports = model;\n"
          "})(typeof window !== 'undefined' ? window : globalThis);\n")
    (ROOT / "js" / "model.js").write_text(js)
    print("\nSaved ml/model.json, js/model.js and backend/app/demand_model.json")


if __name__ == "__main__":
    main()
