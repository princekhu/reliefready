// Run: node tests/engine.test.js
const assert = require("assert");
require("../js/scenarios.js");
require("../js/model.js");
const E = require("../js/engine.js");
const { SCENARIOS } = globalThis.ReliefData;
const clone = (o) => JSON.parse(JSON.stringify(o));

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ✓ " + name); }
  catch (e) { console.error("  ✗ " + name + "\n    " + e.message); process.exitCode = 1; }
}

console.log("ReliefReady engine tests");

SCENARIOS.forEach((sc) => {
  const p = E.plan(clone(sc));
  test(sc.id + ": never delivers more than stock", () => {
    ["food", "water", "meds"].forEach((r) => assert.ok(p.totals[r].delivered <= sc.stock[r], r));
  });
  test(sc.id + ": never delivers more than requested", () => {
    p.villages.forEach((v) => ["food", "water", "meds"].forEach((r) =>
      assert.ok(v.resources[r].delivered <= v.resources[r].requested, v.name + " " + r)));
  });
  test(sc.id + ": every trip fits vehicle capacity and shift", () => {
    p.trips.forEach((t) => assert.ok(t.kg <= t.capacityKg + 1e-6, "trip " + t.n + " overloaded"));
    p.fleet.forEach((f) => assert.ok(f.used <= f.shiftMin, f.id + " over shift"));
  });
  test(sc.id + ": cut-off villages receive nothing", () => {
    p.villages.filter((v) => v.status === "cutoff").forEach((v) =>
      assert.strictEqual(v.resources.food.delivered + v.resources.water.delivered + v.resources.meds.delivered, 0));
  });
});

test("flood: Kalluru is reached by boat only", () => {
  const p = E.plan(clone(SCENARIOS[0]));
  const k = p.villages.find((v) => v.name === "Kalluru");
  assert.ok(k.route.reachable);
  assert.strictEqual(k.route.road, null);
  assert.ok(p.trips.some((t) => t.vehicleType === "boat" && t.stops.some((s) => s.villageId === "V1")));
});

test("twist: disabling the boat cuts Kalluru off and frees its stock for others", () => {
  const sc = clone(SCENARIOS[0]);
  const before = E.plan(sc);
  sc.settings.boats.enabled = false;
  const after = E.plan(sc);
  assert.strictEqual(after.villages.find((v) => v.id === "V1").status, "cutoff");
  const d = E.diffPlans(before, after);
  assert.ok(d.changed.length > 0);
  assert.ok(d.inputChanges.some((x) => x.startsWith("Fleet")));
});

test("twist: blocking a road changes the plan and is reported in the diff", () => {
  const sc = clone(SCENARIOS[0]);
  const before = E.plan(sc);
  sc.edges.find((e) => e.id === "e12").status = "blocked"; // Hill road to Thoreyur
  const after = E.plan(sc);
  assert.strictEqual(after.villages.find((v) => v.id === "V5").status, "cutoff");
  assert.ok(E.diffPlans(before, after).inputChanges.some((x) => x.includes("Hill road")));
});

test("demand model flags Bettahalli's inflated request", () => {
  const p = E.plan(clone(SCENARIOS[0]));
  const b = p.villages.find((v) => v.id === "V4");
  assert.ok(b.flags.some((f) => f.kind === "high"));
});

test("higher urgency weight never lowers the most urgent village's rank", () => {
  const sc = clone(SCENARIOS[0]);
  const r1 = E.plan(sc).villages.find((v) => v.id === "V1").rank;
  sc.settings.weights.urgency = 80;
  const r2 = E.plan(sc).villages.find((v) => v.id === "V1").rank;
  assert.ok(r2 <= r1);
});

test("decision brief mentions every village", () => {
  const sc = clone(SCENARIOS[0]);
  const txt = E.decisionBrief(E.plan(sc), sc);
  sc.villages.forEach((v) => assert.ok(txt.includes(v.name)));
});

console.log("\n" + passed + " passed");
