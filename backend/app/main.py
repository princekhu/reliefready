"""ReliefReady API.

Run locally:   uvicorn app.main:app --reload        (from the backend/ folder)
API docs:      http://localhost:8000/docs
"""
import json
import os
import time
import uuid
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy.orm import Session

from .db import Record, User, get_db, init_db, SessionLocal, engine
from .logic import decode_sos, estimate_supplies, model_info, predict_demand, sos_priority
from .security import hash_pin, make_token, read_token, verify_pin

COLLECTIONS = ("sos", "stops", "reports", "escalations", "drivers", "zones", "incidents", "resources")
SMS_TOKEN = os.getenv("SMS_WEBHOOK_TOKEN", "")
ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]

@asynccontextmanager
async def lifespan(_app):
    init_db()
    if os.getenv("SEED_DEMO", "1") == "1":
        seed_if_empty()
    yield


app = FastAPI(
    lifespan=lifespan,
    title="ReliefReady API",
    version="1.0.0",
    description="Relief logistics: SOS intake, driver assignments, road conditions, impact zones and escalation to authorities.",
)
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_methods=["*"], allow_headers=["*"])


# ---------------------------------------------------------------- schemas
class Loose(BaseModel):
    model_config = ConfigDict(extra="allow")


class SosIn(Loose):
    id: str | None = None
    lat: float | None = Field(None, ge=-90, le=90)
    lon: float | None = Field(None, ge=-180, le=180)
    place: str = Field("", max_length=200)
    people: int = Field(1, ge=0, le=100000)
    infants: int = Field(0, ge=0)
    elderly: int = Field(0, ge=0)
    injured: int = Field(0, ge=0)
    needs: list[Literal["rescue", "medical", "water", "food", "infant", "shelter"]] = []
    note: str = Field("", max_length=500)
    phone: str = Field("", max_length=20)
    channel: Literal["app", "sms", "relay"] = "app"
    createdAt: float | None = None


class StopIn(Loose):
    driverId: str
    name: str = Field(..., max_length=200)
    lat: float
    lon: float
    items: dict = {}
    order: int = 1
    status: Literal["pending", "enroute", "delivered", "unreachable"] = "pending"


class ReportIn(Loose):
    lat: float
    lon: float
    type: Literal["bridge", "landslide", "flooded", "blocked", "damaged", "safe"]
    note: str = Field("", max_length=300)


class EscalationIn(Loose):
    to: str
    type: str
    place: str = ""
    urgency: Literal["Critical", "High", "Medium"] = "High"
    status: Literal["sent", "acknowledged", "dispatched", "resolved"] = "sent"


class DriverIn(Loose):
    name: str = ""
    lat: float | None = None
    lon: float | None = None


class ZoneIn(Loose):
    name: str = Field(..., max_length=200)
    type: Literal["red", "landslide", "flooded", "caution", "relief", "info"]
    coords: list[list[float]] = Field(..., min_length=3)


class IncidentIn(Loose):
    """An affected zone anywhere in India: one calamity, its affected people and status."""
    name: str = Field(..., max_length=200)
    calamity: Literal["flood", "cyclone", "earthquake", "landslide", "drought", "heatwave", "fire", "coldwave"]
    lat: float
    lon: float
    people: int = Field(0, ge=0)
    status: Literal["active", "contained", "resolved"] = "active"


class ResourceIn(Loose):
    """A worker team, supplier truck, boat, helicopter or other asset that can be sent to an incident."""
    name: str = Field(..., max_length=200)
    type: Literal["truck", "boat", "helicopter", "tanker", "ndrf", "medical", "volunteers", "jcb", "firetender"]
    lat: float
    lon: float
    units: int = Field(1, ge=0)
    status: Literal["available", "assigned", "offline"] = "available"


SCHEMAS = {"sos": SosIn, "stops": StopIn, "reports": ReportIn, "escalations": EscalationIn, "drivers": DriverIn, "zones": ZoneIn,
           "incidents": IncidentIn, "resources": ResourceIn}


class LoginIn(BaseModel):
    id: str
    pin: str


class EstimateIn(BaseModel):
    people: int = Field(..., ge=0)
    infants: int = Field(0, ge=0)
    elderly: int = Field(0, ge=0)
    pregnant: int = Field(0, ge=0)
    injured: int = Field(0, ge=0)
    safe_water_source: bool = False
    days_since_aid: int = Field(0, ge=0, le=30)
    days: int = Field(1, ge=1, le=30)
    requested: dict | None = Field(None, description="Optional {food, water, meds} to check against the model")


# ---------------------------------------------------------------- helpers
def now_ms() -> float:
    return time.time() * 1000


def current_user(authorization: str | None = Header(None), db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Sign in required")
    claims = read_token(authorization.split(" ", 1)[1])
    user = claims and db.get(User, claims["sub"])
    if not user:
        raise HTTPException(401, "Session expired. Sign in again.")
    return user


def public_user(u: User) -> dict:
    return {"id": u.id, "role": u.role, "name": u.name, "vehicle": u.vehicle, "type": u.vehicle_type}


def save(db: Session, col: str, doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = doc.get("id") or f"{col[:3]}-{uuid.uuid4().hex[:10]}"
    doc["updatedAt"] = now_ms()
    rec = db.get(Record, (col, doc["id"]))
    owner = doc.get("driverId") if col == "stops" else doc["id"] if col == "drivers" else doc.get("by", "")
    if rec:
        rec.data, rec.status, rec.owner = doc, str(doc.get("status", "")), owner or ""
    else:
        db.add(Record(collection=col, id=doc["id"], data=doc, status=str(doc.get("status", "")), owner=owner or ""))
    db.commit()
    return doc


def check_write(user: User, col: str, doc: dict, existing: dict | None):
    """Admins write everything. Drivers write their own stops and position, and create reports, SOS relays and help requests."""
    if user.role == "admin":
        return
    if col == "stops" and doc.get("driverId") == user.id and (not existing or existing.get("driverId") == user.id):
        return
    if col == "drivers" and doc.get("id") == user.id:
        return
    if col in ("reports", "escalations") and not existing:
        return
    if col == "sos" and (not existing or set(doc) <= set(existing) | {"status", "updatedAt"}):
        return
    raise HTTPException(403, "Your role cannot change this record")


# ---------------------------------------------------------------- startup / seed
def seed_if_empty():
    db = SessionLocal()
    try:
        seed = json.loads((Path(__file__).parent / "seed.json").read_text(encoding="utf-8"))
        full = db.query(User).count() == 0 or os.getenv("RESEED") == "1"
        if full:
            if os.getenv("RESEED") == "1":
                db.query(Record).delete(); db.query(User).delete(); db.commit()
            for a in seed["accounts"]:
                db.add(User(id=a["id"], role=a["role"], name=a["name"], pin_hash=hash_pin(a["pin"]),
                            vehicle=a.get("vehicle", ""), vehicle_type=a.get("type", "truck")))
        # Collections added in later versions are seeded on their own when still empty, without touching live data.
        cols = [c for c in seed["data"] if full or db.query(Record).filter(Record.collection == c).count() == 0]
        if cols:
            t = now_ms()
            for col in cols:
                for d in seed["data"][col]:
                    d = dict(d)
                    for k in ("createdAt", "lastSeen"):
                        if k + "Offset" in d:
                            d[k] = t + d.pop(k + "Offset") * 1000
                    if "timeline" in d:
                        d["timeline"] = [{"t": t + x["tOffset"] * 1000, "s": x["s"], "n": x["n"]} for x in d["timeline"]]
                    save(db, col, d)
            db.commit()
    finally:
        db.close()


# ---------------------------------------------------------------- routes
@app.get("/api/health", tags=["system"])
def health(db: Session = Depends(get_db)):
    """Shows which database the server is using and how many records it holds."""
    try:
        counts = {c: db.query(Record).filter(Record.collection == c).count() for c in COLLECTIONS}
        users, db_ok = db.query(User).count(), True
    except Exception:
        counts, users, db_ok = {}, 0, False
    return {"ok": db_ok, "time": now_ms(), "database": engine.dialect.name,
            "persistent": engine.dialect.name == "postgresql", "users": users, "records": counts}


@app.post("/api/auth/login", tags=["auth"])
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id.ilike(body.id.strip())).first()
    if not user or not verify_pin(body.pin.strip(), user.pin_hash):
        raise HTTPException(401, "That ID and PIN do not match a registered account.")
    return {"token": make_token(user.id, user.role), "user": public_user(user)}


@app.get("/api/auth/me", tags=["auth"])
def me(user: User = Depends(current_user)):
    return public_user(user)


@app.get("/api/sync", tags=["records"])
def sync(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Everything a signed-in user needs to render the dashboard or driver app."""
    out = {c: [] for c in COLLECTIONS}
    for r in db.query(Record).all():
        if r.collection in out:
            out[r.collection].append(r.data)
    return {"time": now_ms(), "data": out}


@app.get("/api/{col}", tags=["records"])
def list_records(col: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if col not in COLLECTIONS:
        raise HTTPException(404, "Unknown collection")
    rows = [r.data for r in db.query(Record).filter(Record.collection == col).all()]
    if col == "sos":
        rows.sort(key=lambda s: -sos_priority(s))
    return rows


@app.put("/api/{col}/{rid}", tags=["records"])
def upsert(col: str, rid: str, body: dict, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if col not in COLLECTIONS:
        raise HTTPException(404, "Unknown collection")
    body["id"] = rid
    try:
        SCHEMAS[col].model_validate(body)
    except ValidationError as e:
        raise HTTPException(422, [{"field": ".".join(map(str, x["loc"])), "error": x["msg"]} for x in e.errors()])
    rec = db.get(Record, (col, rid))
    check_write(user, col, body, rec.data if rec else None)
    if not rec and col in ("reports", "escalations"):
        body.setdefault("by", user.id)
    return save(db, col, body)


@app.delete("/api/{col}/{rid}", tags=["records"])
def delete(col: str, rid: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(403, "Only the control room can delete records")
    rec = db.get(Record, (col, rid))
    if rec:
        db.delete(rec); db.commit()
    return {"deleted": rid}


# ----- public endpoints for people in the affected area (no sign-in)
@app.post("/api/public/sos", tags=["public"], status_code=201)
def public_sos(body: SosIn, db: Session = Depends(get_db)):
    doc = body.model_dump()
    doc["id"] = doc.get("id") or f"sos-{uuid.uuid4().hex[:10]}"
    if db.get(Record, ("sos", doc["id"])):          # retried send from the offline outbox
        return {"id": doc["id"], "status": "duplicate"}
    doc["status"] = "new"
    doc["createdAt"] = doc.get("createdAt") or now_ms()
    save(db, "sos", doc)
    return {"id": doc["id"], "status": "new", "priority": sos_priority(doc)}


@app.get("/api/public/sos/{rid}", tags=["public"])
def public_sos_status(rid: str, db: Session = Depends(get_db)):
    """Status only, so a person can follow their own request without seeing anyone else's."""
    rec = db.get(Record, ("sos", rid))
    if not rec:
        raise HTTPException(404, "Request not found")
    return {"id": rid, "status": rec.data.get("status", "new"), "updatedAt": rec.data.get("updatedAt")}


@app.post("/api/sms/inbound", tags=["public"])
async def sms_inbound(request: Request, token: str = "", db: Session = Depends(get_db)):
    """Webhook for an SMS gateway (Twilio, MSG91, or an Android SMS-forwarder). Accepts JSON or form posts."""
    if SMS_TOKEN and token != SMS_TOKEN:
        raise HTTPException(403, "Bad webhook token")
    if "json" in request.headers.get("content-type", ""):
        payload = await request.json()
    else:
        payload = dict(await request.form())
    text = payload.get("Body") or payload.get("body") or payload.get("message") or payload.get("text") or ""
    sender = payload.get("From") or payload.get("from") or payload.get("sender") or ""
    created = []
    for s in decode_sos(text):
        s.update(id=f"sos-{uuid.uuid4().hex[:10]}", channel="sms", status="new", phone=s["phone"] or str(sender)[-10:])
        save(db, "sos", s)
        created.append(s["id"])
    return {"created": created, "parsed": len(created)}


@app.post("/api/demand/estimate", tags=["planning"])
def demand_estimate(body: EstimateIn):
    """Daily need for one location: the trained demand model's prediction, the Sphere minimum standard,
    and, if `requested` is given, a flag for any quantity more than 35% away from the model."""
    pred = predict_demand(body.people, body.infants, body.elderly, body.pregnant, body.injured,
                          body.safe_water_source, body.days_since_aid)
    if pred:
        pred = {k: v * body.days for k, v in pred.items()}
    flags = []
    if pred and body.requested:
        for k, v in body.requested.items():
            if k in pred and pred[k] and abs(float(v) - pred[k]) / pred[k] > 0.35:
                flags.append({"item": k, "requested": v, "expected": pred[k],
                              "note": "higher than expected" if float(v) > pred[k] else "lower than expected"})
    return {"model": pred, "flags": flags,
            "sphere": estimate_supplies(body.people, body.infants, body.elderly, body.injured, body.days),
            "model_info": model_info()}


@app.get("/api/demand/model", tags=["planning"])
def demand_model():
    """The trained model: features, test accuracy and whether its training data is synthetic."""
    return model_info() or {"available": False}


@app.get("/api/priority/sos", tags=["planning"])
def ranked_sos(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = [r.data for r in db.query(Record).filter(Record.collection == "sos").all() if r.data.get("status") != "served"]
    return sorted(({"id": s["id"], "place": s.get("place"), "priority": sos_priority(s)} for s in rows), key=lambda x: -x["priority"])
