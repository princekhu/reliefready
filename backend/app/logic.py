"""Domain logic shared with the web apps: SOS short code, priority score, supply estimates."""
import json
import re
import time
from pathlib import Path
from datetime import datetime, timezone

NEEDS = {"R": "rescue", "M": "medical", "W": "water", "F": "food", "B": "infant", "S": "shelter"}

SOS_RE = re.compile(
    r"RR1\s+(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\s+P(\d+)\s+I(\d+)\s+E(\d+)\s+J(\d+)\s+N([A-Z]*)\s+T(\d{10})"
    r"(?:\s+C(\d+))?(?:\s*\|\s*(.*))?",
    re.S,
)


def decode_sos(text: str) -> list[dict]:
    """Parse one or more RR1 codes (as sent by SMS, Bluetooth share or QR)."""
    out = []
    for part in re.split(r"(?=RR1\s)", text or ""):
        m = SOS_RE.search(part)
        if not m:
            continue
        ts = m.group(8)
        try:
            created = datetime(2000 + int(ts[0:2]), int(ts[2:4]), int(ts[4:6]), int(ts[6:8]), int(ts[8:10]),
                               tzinfo=timezone.utc).timestamp() * 1000
        except ValueError:
            created = time.time() * 1000
        lat, lon = float(m.group(1)), float(m.group(2))
        out.append({
            "lat": lat or None, "lon": lon or None,
            "people": int(m.group(3)), "infants": int(m.group(4)), "elderly": int(m.group(5)), "injured": int(m.group(6)),
            "needs": [NEEDS[c] for c in m.group(7) if c in NEEDS],
            "createdAt": created, "phone": m.group(9) or "", "place": (m.group(10) or "").strip()[:200],
            "note": "", "code": m.group(0).strip()[:200],
        })
    return out


def sos_priority(s: dict, now_ms: float | None = None) -> int:
    """0-100. Same weights as the web apps: need type 40, people 25, vulnerable share 20, waiting time 15."""
    now_ms = now_ms or time.time() * 1000
    needs = s.get("needs") or []
    u = 1 if "rescue" in needs else .85 if "medical" in needs else .6 if "water" in needs else .4
    if (s.get("injured") or 0) > 0:
        u = max(u, .9)
    people = s.get("people") or 0
    vul = min(1, ((s.get("infants") or 0) + (s.get("elderly") or 0) + (s.get("injured") or 0)) / people / .35) if people else 0
    wait = min(1, (now_ms - (s.get("createdAt") or now_ms)) / (12 * 3600e3))
    return round(100 * (.4 * u + .25 * min(1, people / 60) + .2 * vul + .15 * wait))


# Sphere Handbook (2018) minimum standards used for relief planning
SPHERE = {
    "drinking_water_l": 3.0,      # survival drinking water per person per day (2.5-3 L)
    "total_water_l": 15.0,        # drinking + cooking + hygiene per person per day
    "kcal": 2100,                 # energy requirement per person per day
    "food_packet_kcal": 2100,     # one ration packet assumed to cover one person-day
}


def estimate_supplies(people: int, infants: int = 0, elderly: int = 0, injured: int = 0, days: int = 1) -> dict:
    people, days = max(0, people), max(1, days)
    return {
        "drinking_water_l": round(people * SPHERE["drinking_water_l"] * days),
        "total_water_l": round(people * SPHERE["total_water_l"] * days),
        "food_packets": round(people * SPHERE["kcal"] / SPHERE["food_packet_kcal"] * days),
        "infant_kits": max(0, infants) * days,
        "first_aid_kits": 1 if injured > 0 else 0,
        "basis": "Sphere Handbook 2018 minimum standards: 3 L drinking water and 15 L total water per person per day, 2,100 kcal per person per day.",
    }


# ---------------------------------------------------------------- ML demand model
# Linear regression trained by ml/train_demand_model.py, which also writes this file.
_MODEL_PATHS = [Path(__file__).parent / "demand_model.json", Path(__file__).resolve().parents[2] / "ml" / "model.json"]
DEMAND_MODEL = next((json.loads(p.read_text(encoding="utf-8")) for p in _MODEL_PATHS if p.exists()), None)


def predict_demand(people: int, infants: int = 0, elderly: int = 0, pregnant: int = 0, injured: int = 0,
                   safe_water_source: bool = False, days_since_aid: int = 0) -> dict | None:
    """Daily food packets, water litres and medical kits for one location, from the trained model."""
    if not DEMAND_MODEL:
        return None
    ws = 1 if safe_water_source else 0
    x = {"people": people, "infants": infants, "elderly": elderly, "pregnant": pregnant, "injured": injured,
         "water_source": ws, "days_since_aid": days_since_aid,
         "people_x_water_source": people * ws, "people_x_days": people * days_since_aid}
    out = {}
    for target, t in DEMAND_MODEL["targets"].items():
        v = t["intercept"] + sum(c * x.get(f, 0) for f, c in t["coef"].items())
        out[target] = max(0, round(v))
    return out


def model_info() -> dict | None:
    if not DEMAND_MODEL:
        return None
    return {"name": DEMAND_MODEL.get("name"), "type": DEMAND_MODEL.get("type"),
            "trained_on": DEMAND_MODEL.get("trained_on"), "data_is_synthetic": DEMAND_MODEL.get("data_is_synthetic"),
            "features": DEMAND_MODEL.get("features"),
            "metrics": {t: v["metrics"] for t, v in DEMAND_MODEL["targets"].items()}}
