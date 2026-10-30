/*
 * ReliefReady — scenario data (SIMULATED).
 * All villages, roads, numbers and names are fictional and exist only for the demo.
 *
 * Node coordinates are in a 1000 x 620 schematic map space (not lat/lng),
 * so the map works offline with no tile server.
 *
 * Edge "mode": "road" (trucks) or "river" (boats).
 * Edge "status": "open" | "risky" (+50% travel time, flagged) | "blocked" (unusable).
 */
(function (root) {
  const RESOURCES = {
    food:  { label: "Food packets",   unit: "packets", kgPer: 1.2, note: "1 packet = 1 person-day ration" },
    water: { label: "Drinking water", unit: "L",       kgPer: 1.0, note: "Bottled / jerrycan water" },
    meds:  { label: "Medical kits",   unit: "kits",    kgPer: 2.5, note: "First aid + ORS + basic medicines" }
  };

  const NODES = [
    { id: "D",  kind: "depot",    name: "Taluk Relief Depot", x: 500, y: 330 },
    { id: "J1", kind: "junction", name: "Kere Cross",         x: 330, y: 205 },
    { id: "J2", kind: "junction", name: "Temple Junction",    x: 690, y: 185 },
    { id: "J3", kind: "junction", name: "Highway Junction",   x: 655, y: 420 },
    { id: "J4", kind: "junction", name: "Ghat Foot",          x: 300, y: 430 }
  ];

  const VILLAGES = [
    { id: "V1", name: "Kalluru",    x: 125, y: 120, people: 300, infants: 14, elderly: 42, pregnant: 6, injured: 9,
      urgency: 5, daysSinceAid: 3, verified: true,  waterSource: false,
      request: { food: 300, water: 900, meds: 16 },
      note: "Cut off since Day 1. Infants need clean water for formula." },
    { id: "V2", name: "Hosapura",   x: 480, y: 70,  people: 140, infants: 5,  elderly: 20, pregnant: 2, injured: 1,
      urgency: 2, daysSinceAid: 1, verified: true,  waterSource: true,
      request: { food: 140, water: 210, meds: 4 },
      note: "Borewell still working." },
    { id: "V3", name: "Nadikere",   x: 805, y: 545, people: 220, infants: 9,  elderly: 48, pregnant: 4, injured: 6,
      urgency: 4, daysSinceAid: 2, verified: true,  waterSource: false,
      request: { food: 220, water: 660, meds: 12 },
      note: "Large elderly population in the relief camp at the school." },
    { id: "V4", name: "Bettahalli", x: 880, y: 250, people: 90,  infants: 2,  elderly: 10, pregnant: 1, injured: 0,
      urgency: 2, daysSinceAid: 0, verified: false, waterSource: true,
      request: { food: 150, water: 400, meds: 6 },
      note: "Request came by phone; not yet confirmed by a field team." },
    { id: "V5", name: "Thoreyur",   x: 170, y: 545, people: 180, infants: 8,  elderly: 30, pregnant: 3, injured: 4,
      urgency: 4, daysSinceAid: 3, verified: true,  waterSource: false,
      request: { food: 180, water: 540, meds: 9 },
      note: "Hill road reported slippery." }
  ];

  const EDGES = [
    { id: "e1",  a: "D",  b: "J1", minutes: 35,  mode: "road",  name: "SH-17",               status: "open" },
    { id: "e2",  a: "D",  b: "J2", minutes: 40,  mode: "road",  name: "Temple Road",         status: "open" },
    { id: "e3",  a: "D",  b: "J3", minutes: 30,  mode: "road",  name: "NH bypass",           status: "open" },
    { id: "e4",  a: "D",  b: "J4", minutes: 45,  mode: "road",  name: "Ghat approach",       status: "open" },
    { id: "e5",  a: "J1", b: "V1", minutes: 40,  mode: "road",  name: "Low bridge",          status: "open", hazard: "flood" },
    { id: "e6",  a: "J4", b: "V1", minutes: 120, mode: "road",  name: "Ghat road",           status: "open", hazard: "landslide" },
    { id: "e7",  a: "J1", b: "V2", minutes: 45,  mode: "road",  name: "Kere road",           status: "open" },
    { id: "e8",  a: "J2", b: "V2", minutes: 50,  mode: "road",  name: "Temple link",         status: "open" },
    { id: "e9",  a: "J3", b: "V3", minutes: 40,  mode: "road",  name: "Causeway",            status: "open", hazard: "flood" },
    { id: "e10", a: "J2", b: "V4", minutes: 35,  mode: "road",  name: "Estate road",         status: "open" },
    { id: "e11", a: "J3", b: "V4", minutes: 60,  mode: "road",  name: "Highway spur",        status: "open" },
    { id: "e12", a: "J4", b: "V5", minutes: 55,  mode: "road",  name: "Hill road",           status: "open", hazard: "landslide" },
    { id: "r1",  a: "D",  b: "V1", minutes: 110, mode: "river", name: "River route upstream",   status: "open" },
    { id: "r2",  a: "D",  b: "V3", minutes: 65,  mode: "river", name: "River route downstream", status: "open" }
  ];

  const BASE_SETTINGS = {
    weights: { urgency: 30, people: 20, vulnerable: 25, waiting: 10, isolation: 15 },
    floorPct: 30,            // every reachable village first gets this % of its request
    unverifiedFactor: 0.85,  // unverified requests are discounted, never dropped
    handlingMin: 20,         // unloading time at each stop
    trucks: { count: 1, capacityKg: 700, shiftMin: 720 },
    boats:  { count: 1, capacityKg: 200, shiftMin: 720, enabled: true }
  };

  const clone = (o) => JSON.parse(JSON.stringify(o));

  function makeScenario(id, title, story, opts) {
    const edges = clone(EDGES);
    Object.entries(opts.edgeStatus || {}).forEach(([eid, st]) => {
      const e = edges.find((x) => x.id === eid);
      if (e) e.status = st;
    });
    const villages = clone(VILLAGES).map((v) => Object.assign(v, (opts.villages || {})[v.id] || {}));
    const settings = clone(BASE_SETTINGS);
    if (opts.settings) {
      Object.entries(opts.settings).forEach(([k, val]) => {
        settings[k] = typeof val === "object" && !Array.isArray(val) ? Object.assign(settings[k] || {}, val) : val;
      });
    }
    return { id, title, story, nodes: clone(NODES), villages, edges, stock: opts.stock, settings };
  }

  const SCENARIOS = [
    makeScenario("flood-day3", "Flood, Day 3",
      "Two days of heavy rain. The low bridge to Kalluru is under water and the ghat road has a landslide, so only a boat can reach it. The causeway to Nadikere is passable but risky.",
      {
        edgeStatus: { e5: "blocked", e6: "blocked", e9: "risky" },
        stock: { food: 400, water: 600, meds: 40 }
      }),
    makeScenario("cyclone-day1", "Cyclone landfall, Day 1",
      "Fallen trees block Temple Road. River current is too strong for boats. Two trucks are available and the state sent a larger first consignment.",
      {
        edgeStatus: { e2: "blocked", e12: "risky" },
        stock: { food: 700, water: 1500, meds: 60 },
        villages: { V2: { urgency: 4, waterSource: false, request: { food: 140, water: 420, meds: 6 } }, V1: { urgency: 3 } },
        settings: { trucks: { count: 2 }, boats: { enabled: false } }
      }),
    makeScenario("landslide-day2", "Landslide, Day 2",
      "Landslides on the hill road and the estate road. Thoreyur is cut off by road and has no river access. Stock is low until tomorrow's consignment.",
      {
        edgeStatus: { e12: "blocked", e10: "blocked", e6: "blocked" },
        stock: { food: 250, water: 500, meds: 25 },
        villages: { V5: { urgency: 5, daysSinceAid: 4 } }
      })
  ];

  const api = { RESOURCES, SCENARIOS, BASE_SETTINGS };
  root.ReliefData = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
