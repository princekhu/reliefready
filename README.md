# ReliefReady

**Get relief to the right places, even when the network is gone.**
Anvathon 2026 · Domain 5 (Disaster Management and Resilience) · Problem Statement 3

One system from the person trapped on a roof to the truck on the road:

| App | Who | What it does |
|---|---|---|
| `sos.html` | People in the affected area (no sign-in) | SOS that works offline: internet, SMS code, Bluetooth / Quick Share hand-off, QR for rescuers, Call 112, screen-flash + whistle signal. English and Hindi. |
| `driver.html` | Aid vehicle drivers (sign-in) | Next stops, safe route options on OpenStreetMap, road condition reports, add where to serve next, carry SOS out of dead zones, request help from authorities. |
| `admin.html` | District control room (sign-in) | Live SOS feed and map, priority scoring, assign to drivers, road conditions, tracked requests to SDMA / NDRF / air support with situation report, SMS inbox. |
| `planner.html` | Relief officers | Allocation planner: priority ranking, stock + vehicle constraints, fulfilled / partial / unmet with shortfall reasons, what-if recalculation. |
| `index.html` | Everyone | Hub, how offline SOS works, comparison with existing tools. |

Demo data: Wayanad, Kerala. Real place names and coordinates, illustrative needs.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Open the driver app and the control room in two tabs of the same browser: changes sync live between them.

### Demo accounts

| Role | ID | PIN |
|---|---|---|
| Control room | `ADM-01` | `2026` |
| Driver (truck, pickup, jeep) | `D-101`, `D-102`, `D-103` | `1234` |
| Boat crew | `D-104` | `1234` |

Prototype sign-in only. Production should use phone OTP (e.g. Firebase Auth) with district-issued roles.

## Deploy (public link)

GitHub Pages: push this folder, then **Settings → Pages → Deploy from branch → main / root**. The site is live at `https://<user>.github.io/<repo>/`. HTTPS is required for GPS, the camera and offline mode, and GitHub Pages provides it.

## How the offline SOS works

Browsers cannot form a Bluetooth mesh or place calls without a network, so the SOS uses the paths that work on every ordinary phone:

1. **Internet**: sent immediately; if there is no data it is stored in an outbox and sent automatically on the `online` event.
2. **SMS**: the whole request is packed into one 160-character code, readable even with weak 2G signal:
   `RR1 lat,lon P<people> I<infants> E<elderly> J<injured> N<needs> T<yymmddhhmm UTC> [C<phone>] | landmark. note`
   Needs: R rescue, M medical, W water, F food, B infant, S shelter. The control room's SMS inbox parses it.
3. **Bluetooth / Nearby Share / WhatsApp**: Web Share API hands the code to a nearby phone with no network; whoever reaches signal forwards it.
4. **QR**: drivers scan it offline in the driver app and upload when they reach signal (store-and-forward, "data mules").
5. **Call 112 / 1077** and a full-screen **SOS light + 3 kHz whistle** pattern for searchers.

A service worker (`sw.js`) caches every page so the apps open with no network after the first visit, and the manifest makes them installable.

## Safe routing

`RR.route()` asks OSRM (OpenStreetMap road network) for up to three alternatives, then checks each route against live road reports within 350 m. Bridge down, flooding and debris count as unsafe; landslides and damage count as caution. The safest, then fastest, option is shown first. If every option is unsafe, the driver is prompted to request a boat, airlift or bridge team. Offline, it falls back to a straight-line estimate.

## Escalation to higher authorities

Control room and drivers can raise requests (boat, airlift, medical evacuation, rescue team, bridge clearing, supplies) to the district control room, State EOC, NDRF, Fire & Rescue, Health, air support or army engineers. Each request carries a timeline (sent → acknowledged → dispatched → resolved). **Forward higher** moves it up the chain when nobody answers, and **Copy situation report** gives text for the official channel.

## Map layers and government data

- **Impact zones** (control room → Impact zones): red / no entry, landslide, flooded, caution, relief, reference. Drawn on the map; stored with a source line.
  - Road routes crossing red, landslide or flooded zones are marked unsafe (boats may cross flooded zones).
  - SOS requests inside an impact zone get +12 priority; each zone shows people, SOS, stops, hazards and vehicles inside it.
- **Government data in the demo**
  - NRSC/ISRO rapid-mapping product for the 30 July 2024 Chooralmala landslide (International Charter 1029): the mapped area 11°29′–11°30′N, 76°9′–76°9′45″E. [Source PDF](https://bhuvan-app1.nrsc.gov.in/disaster/usrtasks/landslide/doc/Charter_1029_VAP_7_6Aug2024.pdf)
  - Debris-flow corridor drawn from ISRO's reported headscarp (11.46544, 76.13576) and 8 km runout ([reported here](https://eos.org/thelandslideblog/wayanad-landslides)). Approximate, not an official boundary.
  - Bhuvan (ISRO) WMS layers, e.g. flood hazard, can be added in Settings using the URL and layer id from the Bhuvan Thematic Services portal ([how to use Bhuvan WMS](https://bhuvan.nrsc.gov.in/wiki/index.php/How_to_use_WMS_services)).
- **Base maps** (layers button): OpenStreetMap, Esri World Imagery satellite, OpenTopoMap terrain, NASA GIBS MODIS daily true-colour image (date set in Settings).

Other demo zones are labelled “illustrative” in their source line.

## Code map

- `assets/common.js`: config, demo accounts, seed data, store (localStorage + BroadcastChannel, swappable for Firebase/Supabase), offline outbox, SOS code encode/decode, priority score, Leaflet map, OSRM safe routing.
- `assets/common.css`: shared design tokens, light and dark.
- `assets/leaflet.*`, `qrcode.js`, `jsQR.js`: bundled libraries, so everything works offline.

## Limits and next steps

- **Bluetooth mesh and offline voice**: needs a small Android companion app (Nearby Connections over BLE + Wi-Fi Direct) that reuses the RR1 code.
- **No tower at all**: LoRa mesh radios (Meshtastic) with a gateway at the control room that feeds RR1 codes into the SMS inbox.
- **Back end**: replace the local store with Firebase/Supabase for multi-device sync; connect an SMS gateway number.
- OSRM's public demo server is for testing only; self-host it for production use.

Map data © OpenStreetMap contributors. Routing: OSRM.
