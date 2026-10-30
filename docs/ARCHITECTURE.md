# Architecture

## System overview

```mermaid
flowchart LR
    subgraph Offline["Offline (Python)"]
        G[Synthetic data generator] --> T[Train linear regression<br/>scikit-learn]
        T --> MJ[model.json + js/model.js]
    end
    subgraph Browser["Browser (static site, no server)"]
        S[scenarios.js<br/>villages · roads · stock · fleet] --> E
        MJ --> E
        E[engine.js<br/>plan · diff · brief] --> UI[app.js<br/>map · cards · timeline · KPIs]
        UI -- user edits: road status,<br/>new area, stock, fleet, weights --> S
    end
```

## Planning pipeline (engine.js → `plan()`)

```mermaid
flowchart TD
    A[Scenario] --> B[Dijkstra from depot<br/>road graph + river graph]
    B --> C{Any vehicle can go<br/>and return in its shift?}
    C -- no --> X[Cut off]
    C -- yes --> D[Priority score]
    D --> E1[Stock round 1:<br/>survival floor, equal % for all]
    E1 --> E2[Stock round 2:<br/>remaining by priority]
    E2 --> F1[Trips round 1: deliver floors]
    F1 --> F2[Trips round 2: deliver priority share]
    F2 --> F3[Top-up: leftover stock into spare<br/>capacity, then free vehicle time]
    F3 --> O[Outcomes + reasons + gap]
    X --> O
```

## Trip building (greedy multi-stop)

```mermaid
flowchart TD
    S([Start]) --> P{Highest-priority village with<br/>remaining need that some vehicle<br/>can reach and return from?}
    P -- no --> END([Round done])
    P -- yes --> L[Pick the vehicle with the shortest round trip.<br/>Load meds → water → food up to capacity]
    L --> N{Capacity left AND another waiting<br/>village fits in the shift<br/>incl. the return leg?}
    N -- yes --> ADD[Add stop, load it] --> N
    N -- no --> R[Return to depot, book vehicle time] --> P
```

## Twist loop

```mermaid
sequenceDiagram
    actor C as Coordinator
    participant UI as app.js
    participant E as engine.js
    C->>UI: Click road (open → risky → blocked)
    UI->>E: plan(updated scenario)
    E-->>UI: new plan
    UI->>E: diffPlans(baseline, new)
    E-->>UI: input changes + per-village deltas
    UI-->>C: map, cards, timeline, "Changes since baseline"
```

## Data model

```js
village  = { id, name, x, y, people, infants, elderly, pregnant, injured,
             urgency /*1-5*/, daysSinceAid, verified, waterSource,
             request: { food, water, meds } }
edge     = { id, a, b, minutes, mode: "road" | "river", name,
             status: "open" | "risky" | "blocked", hazard? }
stock    = { food, water, meds }
settings = { weights, floorPct, unverifiedFactor, handlingMin,
             trucks: { count, capacityKg, shiftMin },
             boats:  { count, capacityKg, shiftMin, enabled } }
```

## Plan result (simplified)

```js
{
  villages: [{ id, name, rank, score: { score, parts[] }, status, coverage,
               resources: { water: { requested, delivered, short, ... }, ... },
               reasons[], flags[], estimate }],
  trips:    [{ n, round, vehicle, start, end, kg, stops: [{ villageName, arrive, load }] }],
  totals, summary, gap, fleet, inputs
}
```
