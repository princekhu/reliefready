import os
import tempfile

os.environ["DATABASE_URL"] = "sqlite:///" + os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["SECRET_KEY"] = "test-secret"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)
client.__enter__()  # run startup (creates tables, seeds demo data)


def token(uid, pin):
    r = client.post("/api/auth/login", json={"id": uid, "pin": pin})
    assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["token"]}


def test_login_rejects_wrong_pin():
    assert client.post("/api/auth/login", json={"id": "ADM-01", "pin": "0000"}).status_code == 401


def test_sync_requires_sign_in():
    assert client.get("/api/sync").status_code == 401


def test_admin_sees_seeded_data():
    data = client.get("/api/sync", headers=token("ADM-01", "2026")).json()["data"]
    assert len(data["sos"]) >= 3 and len(data["zones"]) >= 5 and len(data["drivers"]) == 4


def test_public_sos_and_status():
    r = client.post("/api/public/sos", json={"lat": 11.5, "lon": 76.1, "people": 12, "needs": ["water"], "place": "Test"})
    assert r.status_code == 201
    sid = r.json()["id"]
    assert client.get(f"/api/public/sos/{sid}").json()["status"] == "new"
    # duplicate send from the offline outbox is ignored
    assert client.post("/api/public/sos", json={"id": sid, "people": 12}).json()["status"] == "duplicate"


def test_sms_webhook_parses_code():
    body = "RR1 12.03500,76.30500 P42 I5 E9 J3 NRMW T2610301830 | Tumbasogu temple"
    r = client.post("/api/sms/inbound", data={"From": "+919876543210", "Body": body})
    assert r.json()["parsed"] == 1


def test_driver_cannot_edit_other_drivers_stop():
    h = token("D-102", "1234")
    stop = {"driverId": "D-101", "name": "x", "lat": 11.5, "lon": 76.1, "status": "pending"}
    assert client.put("/api/stops/st-1", json=stop, headers=h).status_code == 403


def test_driver_can_report_road():
    h = token("D-101", "1234")
    r = client.put("/api/reports/hz-test", json={"lat": 11.6, "lon": 76.1, "type": "flooded", "note": "test"}, headers=h)
    assert r.status_code == 200 and r.json()["by"] == "D-101"


def test_invalid_zone_rejected():
    h = token("ADM-01", "2026")
    r = client.put("/api/zones/z-bad", json={"name": "bad", "type": "red", "coords": [[1, 2]]}, headers=h)
    assert r.status_code == 422


def test_estimate_uses_model_and_sphere():
    r = client.post("/api/demand/estimate", json={"people": 100, "infants": 4, "requested": {"water": 2000}}).json()
    assert r["sphere"]["drinking_water_l"] == 300 and r["sphere"]["total_water_l"] == 1500
    assert 250 < r["model"]["water"] < 450 and 80 < r["model"]["food"] < 130 and r["model"]["meds"] >= 3
    assert r["flags"] and r["flags"][0]["item"] == "water"


def test_model_info():
    r = client.get("/api/demand/model").json()
    assert r["data_is_synthetic"] is True and r["metrics"]["water"]["r2"] > 0.9


def test_national_incidents_and_resources():
    h = token("ADM-01", "2026")
    data = client.get("/api/sync", headers=h).json()["data"]
    assert len(data["incidents"]) >= 10 and len(data["resources"]) >= 40
    assert {i["calamity"] for i in data["incidents"]} >= {"flood", "cyclone", "earthquake", "landslide", "drought", "heatwave", "fire", "coldwave"}
    r = client.put("/api/incidents/inc-test", headers=h, json={"id": "inc-test", "name": "Test flood", "calamity": "flood", "lat": 25.6, "lon": 85.1, "people": 900})
    assert r.status_code == 200, r.text
    bad = client.put("/api/incidents/inc-bad", headers=h, json={"id": "inc-bad", "name": "x", "calamity": "meteor", "lat": 1, "lon": 1})
    assert bad.status_code == 422
    # drivers cannot create national incidents
    assert client.put("/api/incidents/inc-d", headers=token("D-101", "1234"), json={"id": "inc-d", "name": "x", "calamity": "flood", "lat": 1, "lon": 1}).status_code == 403


def test_new_collections_seed_into_existing_database():
    from app.db import Record, SessionLocal
    from app.main import seed_if_empty
    db = SessionLocal()
    db.query(Record).filter(Record.collection == "resources").delete(); db.commit()
    sos_before = db.query(Record).filter(Record.collection == "sos").count()
    db.close()
    seed_if_empty()
    db = SessionLocal()
    assert db.query(Record).filter(Record.collection == "resources").count() >= 40
    assert db.query(Record).filter(Record.collection == "sos").count() == sos_before   # live data untouched
    db.close()
