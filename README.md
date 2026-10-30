# ReliefReady

Relief logistics for disaster-affected districts. People in the affected area send an SOS even without internet. The control room ranks requests, assigns vehicles and marks impact zones. Drivers follow routes that avoid reported hazards. Requests to state and national agencies are tracked until they are resolved.

| App | Users | Purpose |
|---|---|---|
| `sos.html` | People in the affected area, no sign-in | SOS by internet, SMS code, Bluetooth / Quick Share, QR, Call 112. Works offline. |
| `driver.html` | Drivers and boat crews (sign-in) | Next stops, route options checked against hazards and zones, road reports, carrying SOS out of dead zones, help requests. |
| `admin.html` | District control room (sign-in) | Live map, SOS queue, fleet, impact zones, road conditions, agency requests, SMS inbox. |
| `planner.html` | Relief officers | Allocation of limited stock under vehicle limits, with what-if recalculation. |

## Architecture

```
 Browser apps (GitHub Pages, works offline as a PWA)
   sos.html ── POST /api/public/sos ───────────┐
   driver.html ┐                               │
   admin.html  ┴─ JWT ─ GET /api/sync (5 s) ───┤
                       PUT/DELETE /api/{type} ─┤     FastAPI (Render)  ──  PostgreSQL
 SMS gateway ─────── POST /api/sms/inbound ────┘
 Maps: Esri / OpenStreetMap tiles · OSRM road routing · NASA GIBS imagery · Bhuvan WMS
```

- **Frontend:** static HTML/CSS/JS with Leaflet maps. No build step. `assets/config.js` holds the API address. If it is empty, the apps run in demo mode with data kept in the browser.
- **Backend:** Python FastAPI in `backend/`. Interactive API documentation is at `/docs`.
- **Database:** PostgreSQL in production, SQLite locally (set by `DATABASE_URL`). Tables:
  - `users`: staff and drivers, with PBKDF2-hashed PINs
  - `records`: SOS requests, stops, road reports, agency requests, vehicle positions and zones, as validated JSON with indexed `status`, `owner` and `updated_at`
- **Auth:** JWT tokens that expire after 12 hours. Roles:
  - control room: full access
  - drivers: only their own stops and position, plus new reports and help requests
  - public: create an SOS and check its status only

### API

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/health` | anyone | Health check |
| POST | `/api/auth/login` | anyone | ID + PIN → token |
| GET | `/api/sync` | signed in | All operational data |
| GET | `/api/{type}` | signed in | One collection: `sos`, `stops`, `reports`, `escalations`, `drivers`, `zones` |
| PUT | `/api/{type}/{id}` | role-checked | Create or update a record (schema-validated) |
| DELETE | `/api/{type}/{id}` | control room | Delete |
| POST | `/api/public/sos` | anyone | Submit an SOS (duplicate sends from the offline outbox are ignored) |
| GET | `/api/public/sos/{id}` | anyone | Status of one SOS only |
| POST | `/api/sms/inbound?token=…` | SMS gateway | Twilio/MSG91/Android-forwarder webhook; parses RR1 codes |
| POST | `/api/demand/estimate` | anyone | Water, food and infant kits for a group, from Sphere standards |
| GET | `/api/priority/sos` | signed in | SOS ranked by priority score |

## Run locally

```bash
# 1. API (from the repository root)
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --reload    # http://localhost:8000/docs

# 2. Website: open the repository folder with the VS Code "Live Server" extension
#    In the control room: Settings → ReliefReady API address → http://localhost:8000 → Connect
```

Run the API tests with `pip install pytest httpx` and then `pytest` in `backend/`.

Demo accounts (created automatically on first start, `SEED_DEMO=1`):

| Role | ID | PIN |
|---|---|---|
| Control room | `ADM-01` | `2026` |
| Drivers | `D-101`, `D-102`, `D-103` | `1234` |
| Boat crew | `D-104` | `1234` |

## Deployment

**Website: GitHub Pages.** Settings → Pages → Deploy from a branch → `main` / root. It's served at `https://princekhu.github.io/reliefready/`.

**API and database: Render (free tier).**
1. Sign in at render.com with GitHub.
2. Go to **New → Blueprint** and select this repository. `render.yaml` creates the `reliefready-api` web service and the `reliefready-db` PostgreSQL database, and generates `SECRET_KEY` and `SMS_WEBHOOK_TOKEN`.
3. When it's live, open `https://reliefready-api.onrender.com/docs` to check that it works.
4. Put that address in `assets/config.js` (`window.RR_API_URL = 'https://reliefready-api.onrender.com';`), then commit and push.

Free Render services sleep after 15 minutes without traffic, so the first request takes about 30–50 seconds. Open `/api/health` a minute before a demo. The free PostgreSQL database expires after 30 days, so upgrade the plan, or use Neon or Supabase and set `DATABASE_URL`, for longer use.

**SMS line.** Point your SMS provider's inbound webhook to
`https://reliefready-api.onrender.com/api/sms/inbound?token=<SMS_WEBHOOK_TOKEN>`.

## Priority and supply calculations

- **SOS priority (0–100):**
  - need type: 40%, with rescue and medical first
  - people: 25%
  - share of infants, elderly and injured: 20%
  - waiting time: 15%
  - +12 if the SOS is inside a red, landslide or flooded zone
- **Supply estimates** follow the Sphere Handbook (2018) minimum standards: 3 L drinking water and 15 L total water per person per day, and 2,100 kcal per person per day. Every number can be traced to a published standard.
- **Allocation planner:**
  1. Every reachable location first gets an equity floor, a share of its request.
  2. The remaining stock goes out in priority order.
  3. Throughout, it respects stock, vehicle capacity, driving hours and blocked routes.
- **ML demand model (`ml/`):** trained on `ml/data/synthetic_villages.csv`, which is **synthetic** data. To train on real data, replace it with:
  - Census 2011 village Primary Census Abstract (population, children 0–6)
  - district relief-camp registers (people per camp per day)
  - IMD rainfall

## Map layers and government data

- **Base maps:** Esri World Street Map (English labels, the default), Esri satellite with labels, OpenTopoMap terrain, OpenStreetMap (local-language labels), and NASA GIBS MODIS daily imagery.
- **Impact zones** (control room → Impact zones): red / no entry, landslide, flooded, caution, relief, reference. Each zone records its source.
- **Government data in the demo:**
  - The area mapped by the NRSC/ISRO rapid-mapping product for the 30 July 2024 Chooralmala landslide (International Charter 1029): 11°29′–11°30′N, 76°9′–76°9′45″E. [Source PDF](https://bhuvan-app1.nrsc.gov.in/disaster/usrtasks/landslide/doc/Charter_1029_VAP_7_6Aug2024.pdf)
  - A debris-flow corridor drawn from ISRO's reported headscarp (11.46544, 76.13576) and 8 km runout ([reported here](https://eos.org/thelandslideblog/wayanad-landslides)). It is approximate, not an official boundary.
  - Bhuvan (ISRO) WMS layers can be added in Settings ([how to use Bhuvan WMS](https://bhuvan.nrsc.gov.in/wiki/index.php/How_to_use_WMS_services)).
- Other demo zones are labelled illustrative.

## Offline SOS

1. **Internet:** sent immediately. With no signal it is queued and sent automatically when signal returns.
2. **SMS:** one 160-character code: `RR1 lat,lon P<people> I<infants> E<elderly> J<injured> N<needs> T<yymmddhhmm> [C<phone>] | note`.
3. **Bluetooth / Nearby Share / WhatsApp hand-off:** to a phone that has signal.
4. **QR:** drivers scan it offline and upload it when they reach coverage.
5. **Call 112 / 1077** and a flashing screen with an audible SOS signal.

A service worker caches the apps so they open with no network after the first visit.

Map data © OpenStreetMap contributors · Esri · NASA EOSDIS GIBS · NRSC/ISRO. Routing: OSRM.
