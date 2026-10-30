/*
 * ReliefReady — allocation engine.
 * Pure functions, no DOM. Runs in the browser (window.ReliefEngine) and in Node (require).
 *
 * Pipeline:  routes -> reachability -> priority score -> stock allocation
 *            -> vehicle trip scheduling -> top-up -> outcomes, gaps, diff, brief
 */
(function (root) {
  "use strict";

  const RES = ["meds", "water", "food"]; // loading order: most critical first

  /* ---------- 1. Demand model (trained in ml/train_demand_model.py) ---------- */
  function featureVector(v) {
    const ws = v.waterSource ? 1 : 0;
    return {
      people: v.people, infants: v.infants, elderly: v.elderly, pregnant: v.pregnant,
      injured: v.injured, water_source: ws, days_since_aid: v.daysSinceAid,
      people_x_water_source: v.people * ws, people_x_days: v.people * v.daysSinceAid
    };
  }

  function estimateDemand(v, model) {
    if (!model) return null;
    const f = featureVector(v);
    const out = {};
    Object.entries(model.targets).forEach(([t, m]) => {
      let y = m.intercept;
      Object.entries(m.coef).forEach(([k, c]) => { y += c * (f[k] || 0); });
      out[t] = Math.max(0, Math.round(y));
    });
    return out;
  }

  /* ---------- 2. Routing: Dijkstra over open edges for one mode ---------- */
  function shortestPaths(scenario, mode, fromId) {
    const ids = scenario.nodes.map((n) => n.id).concat(scenario.villages.map((v) => v.id));
    const dist = {}, prev = {}, done = {};
    ids.forEach((id) => { dist[id] = Infinity; });
    dist[fromId] = 0;
    const usable = scenario.edges.filter((e) => e.mode === mode && e.status !== "blocked");
    while (true) {
      let u = null;
      ids.forEach((id) => { if (!done[id] && dist[id] < Infinity && (u === null || dist[id] < dist[u])) u = id; });
      if (u === null) break;
      done[u] = true;
      usable.forEach((e) => {
        if (e.a !== u && e.b !== u) return;
        const w = e.a === u ? e.b : e.a;
        const cost = e.minutes * (e.status === "risky" ? 1.5 : 1);
        if (dist[u] + cost < dist[w]) { dist[w] = dist[u] + cost; prev[w] = { node: u, edge: e }; }
      });
    }
    const routeTo = (target) => {
      if (dist[target] === Infinity) return null;
      const edges = [];
      let cur = target;
      while (prev[cur]) { edges.unshift(prev[cur].edge); cur = prev[cur].node; }
      return {
        minutes: Math.round(dist[target]),
        edgeIds: edges.map((e) => e.id),
        risky: edges.filter((e) => e.status === "risky").map((e) => e.name)
      };
    };
    return routeTo;
  }

  /* ---------- 3. Fleet ---------- */
  function buildFleet(settings) {
    const fleet = [];
    for (let i = 0; i < settings.trucks.count; i++) {
      fleet.push({ id: "Truck " + (i + 1), type: "truck", mode: "road",
        capacityKg: settings.trucks.capacityKg, shiftMin: settings.trucks.shiftMin, used: 0 });
    }
    if (settings.boats.enabled) {
      for (let i = 0; i < settings.boats.count; i++) {
        fleet.push({ id: "Boat " + (i + 1), type: "boat", mode: "river",
          capacityKg: settings.boats.capacityKg, shiftMin: settings.boats.shiftMin, used: 0 });
      }
    }
    return fleet;
  }

  /* ---------- 4. Priority score ---------- */
  const FACTORS = [
    { key: "urgency",    label: "Urgency reported" },
    { key: "people",     label: "People affected" },
    { key: "vulnerable", label: "Vulnerable share" },
    { key: "waiting",    label: "Days without aid" },
    { key: "isolation",  label: "Isolation" }
  ];

  function vulnerableRatio(v) {
    return Math.min(1, (v.infants + v.elderly + v.pregnant + v.injured) / Math.max(1, v.people));
  }

  function scoreVillages(scenario, routes) {
    const w = scenario.settings.weights;
    const totalW = FACTORS.reduce((s, f) => s + (w[f.key] || 0), 0) || 1;
    const maxP = Math.max(...scenario.villages.map((v) => v.people));
    const maxVr = Math.max(...scenario.villages.map(vulnerableRatio)) || 1;
    const out = {};
    scenario.villages.forEach((v) => {
      const road = routes[v.id].road;
      const iso = !road ? 1 : road.risky.length ? 0.5 : 0;
      const comp = {
        urgency: v.urgency / 5,
        people: Math.log(1 + v.people) / Math.log(1 + maxP),
        vulnerable: vulnerableRatio(v) / maxVr,
        waiting: Math.min(v.daysSinceAid / 5, 1),
        isolation: iso
      };
      const parts = FACTORS.map((f) => ({
        key: f.key, label: f.label, value: comp[f.key], weight: w[f.key] || 0,
        points: (100 * (w[f.key] || 0) * comp[f.key]) / totalW
      }));
      let score = parts.reduce((s, p) => s + p.points, 0);
      const factor = v.verified ? 1 : scenario.settings.unverifiedFactor;
      score *= factor;
      out[v.id] = { score: Math.round(score * 10) / 10, parts, verifiedFactor: factor };
    });
    return out;
  }

  /* ---------- 5. Main planner ---------- */
  function plan(scenario, model) {
    const s = scenario.settings;
    const R = (root.ReliefData && root.ReliefData.RESOURCES) || scenario.resources;
    const kg = (load) => RES.reduce((sum, r) => sum + (load[r] || 0) * R[r].kgPer, 0);

    const roadFrom = shortestPaths(scenario, "road", "D");
    const riverFrom = shortestPaths(scenario, "river", "D");
    const fleet = buildFleet(s);
    const hasMode = { road: fleet.some((f) => f.mode === "road"), river: fleet.some((f) => f.mode === "river") };

    // Routes + reachability
    const routes = {};
    scenario.villages.forEach((v) => {
      const road = roadFrom(v.id), river = riverFrom(v.id);
      const options = [];
      if (road && hasMode.road) options.push({ mode: "road", route: road });
      if (river && hasMode.river) options.push({ mode: "river", route: river });
      const feasible = options.filter((o) => fleet.some((f) => f.mode === o.mode && 2 * o.route.minutes + s.handlingMin <= f.shiftMin));
      routes[v.id] = { road, river, options: feasible, reachable: feasible.length > 0 };
    });

    const scores = scoreVillages(scenario, routes);
    const ranked = scenario.villages.slice().sort((a, b) => scores[b.id].score - scores[a.id].score);
    const rankOf = {};
    ranked.forEach((v, i) => { rankOf[v.id] = i + 1; });
    const eligible = ranked.filter((v) => routes[v.id].reachable);

    // 5a. Stock allocation: survival floor (equal % for all), then priority fill
    const target = {}, floorGiven = {};
    scenario.villages.forEach((v) => { target[v.id] = { food: 0, water: 0, meds: 0 }; floorGiven[v.id] = { food: 0, water: 0, meds: 0 }; });
    const floorScale = {};
    RES.forEach((r) => {
      let stock = scenario.stock[r] || 0;
      const wants = eligible.map((v) => (s.floorPct / 100) * (v.request[r] || 0));
      const sumF = wants.reduce((a, b) => a + b, 0);
      const scale = sumF > 0 ? Math.min(1, stock / sumF) : 1;
      floorScale[r] = scale;
      eligible.forEach((v, i) => {
        const give = Math.min(v.request[r] || 0, Math.floor(wants[i] * scale));
        target[v.id][r] += give; floorGiven[v.id][r] = give; stock -= give;
      });
      eligible.forEach((v) => {
        const give = Math.min((v.request[r] || 0) - target[v.id][r], stock);
        if (give > 0) { target[v.id][r] += give; stock -= give; }
      });
    });

    // 5b. Trip scheduling: multi-stop trips, served in three rounds
    //     round 1 = survival floor for everyone, round 2 = priority share, round 3 = top-up
    const trips = [];
    const delivered = {};
    scenario.villages.forEach((v) => { delivered[v.id] = { food: 0, water: 0, meds: 0 }; });
    const vById = {};
    scenario.villages.forEach((v) => { vById[v.id] = v; });

    const pathCache = {};
    function between(mode, a, b) {
      const k = mode + ":" + a;
      if (!pathCache[k]) pathCache[k] = shortestPaths(scenario, mode, a);
      return pathCache[k](b);
    }

    function loadFor(need, capLeftKg) {
      const load = { food: 0, water: 0, meds: 0 };
      let cap = capLeftKg;
      RES.forEach((r) => {
        const n = Math.min(need[r] || 0, Math.floor(cap / R[r].kgPer));
        if (n > 0) { load[r] = n; cap -= n * R[r].kgPer; }
      });
      return load;
    }

    function runRound(round, remaining) {
      // remaining: {villageId: {r: amount}} still to deliver in this round
      let guard = 0;
      while (guard++ < 200) {
        // first village in priority order that some vehicle can still reach and return from
        let pick = null;
        for (const v of eligible) {
          if (kg(remaining[v.id]) <= 0) continue;
          for (const f of fleet) {
            const r = between(f.mode, "D", v.id);
            if (!r) continue;
            const rt = 2 * r.minutes + s.handlingMin;
            if (f.used + rt <= f.shiftMin && (!pick || rt < pick.rt)) pick = { v, f, rt };
          }
          if (pick) break;
        }
        if (!pick) return;
        const f = pick.f;
        const trip = { n: trips.length + 1, round, vehicle: f.id, vehicleType: f.type, capacityKg: f.capacityKg,
          start: f.used, stops: [], routeEdges: [], risky: [], load: { food: 0, water: 0, meds: 0 } };
        let cur = "D", t = 0, capLeft = f.capacityKg;
        const addStop = (v, leg) => {
          const load = loadFor(remaining[v.id], capLeft);
          t += leg.minutes + s.handlingMin;
          trip.routeEdges.push(...leg.edgeIds);
          trip.risky.push(...leg.risky);
          trip.stops.push({ villageId: v.id, villageName: v.name, arrive: f.used + t - s.handlingMin, load });
          RES.forEach((r) => { remaining[v.id][r] -= load[r]; delivered[v.id][r] += load[r]; trip.load[r] += load[r]; });
          capLeft -= kg(load);
          cur = v.id;
        };
        addStop(pick.v, between(f.mode, "D", pick.v.id));
        // add more stops while capacity and shift time allow
        let more = true;
        while (more && capLeft >= 1) {
          more = false;
          for (const c of eligible) {
            if (trip.stops.some((x) => x.villageId === c.id) || kg(remaining[c.id]) <= 0) continue;
            const leg = between(f.mode, cur, c.id), back = between(f.mode, c.id, "D");
            if (!leg || !back) continue;
            if (f.used + t + leg.minutes + s.handlingMin + back.minutes > f.shiftMin) continue;
            if (kg(loadFor(remaining[c.id], capLeft)) <= 0) continue;
            addStop(c, leg); more = true; break;
          }
        }
        const back = between(f.mode, cur, "D");
        t += back.minutes;
        trip.routeEdges.push(...back.edgeIds);
        trip.risky = Array.from(new Set(trip.risky));
        trip.end = f.used + t;
        trip.kg = Math.round(kg(trip.load) * 10) / 10;
        f.used = trip.end;
        trips.push(trip);
      }
    }

    const copy = (o) => ({ food: o.food, water: o.water, meds: o.meds });
    const r1 = {}, r2 = {};
    scenario.villages.forEach((v) => {
      r1[v.id] = copy(floorGiven[v.id]);
      r2[v.id] = { food: target[v.id].food - floorGiven[v.id].food, water: target[v.id].water - floorGiven[v.id].water, meds: target[v.id].meds - floorGiven[v.id].meds };
    });
    runRound("floor", r1);
    runRound("priority", r2);

    // 5c. Top-up: stock that could not be delivered (vehicle time ran out) goes to whoever can still be served
    const leftover = () => {
      const o = {};
      RES.forEach((r) => { o[r] = (scenario.stock[r] || 0) - scenario.villages.reduce((sum, v) => sum + delivered[v.id][r], 0); });
      return o;
    };
    // first: spare capacity on trips already planned (costs no extra time)
    trips.forEach((t) => {
      let capLeft = t.capacityKg - kg(t.load);
      t.stops.forEach((st) => {
        const v = vById[st.villageId];
        const left = leftover();
        RES.forEach((r) => {
          const unmet = (v.request[r] || 0) - delivered[v.id][r];
          const n = Math.min(unmet, left[r], Math.floor(capLeft / R[r].kgPer));
          if (n > 0) { st.load[r] += n; t.load[r] += n; delivered[v.id][r] += n; capLeft -= n * R[r].kgPer; left[r] -= n; st.toppedUp = true; }
        });
      });
      t.kg = Math.round(kg(t.load) * 10) / 10;
    });
    // then: new trips with remaining vehicle time, shared out by priority
    const r3 = {};
    let pool = leftover();
    eligible.forEach((v) => {
      r3[v.id] = {};
      RES.forEach((r) => {
        const n = Math.max(0, Math.min((v.request[r] || 0) - delivered[v.id][r], pool[r]));
        r3[v.id][r] = n; pool[r] -= n;
      });
    });
    scenario.villages.forEach((v) => { if (!r3[v.id]) r3[v.id] = { food: 0, water: 0, meds: 0 }; });
    runRound("top-up", r3);

    // 6. Outcomes
    const left = leftover();
    const villageResults = ranked.map((v) => {
      const rt = routes[v.id];
      const res = {};
      let covSum = 0, covN = 0;
      RES.forEach((r) => {
        const req = v.request[r] || 0;
        const d = delivered[v.id][r];
        res[r] = { requested: req, target: target[v.id][r], floor: floorGiven[v.id][r], delivered: d,
          short: Math.max(0, req - d), coverage: req ? d / req : 1 };
        if (req) { covSum += res[r].coverage; covN++; }
      });
      const coverage = covN ? covSum / covN : 1;
      let status = !rt.reachable ? "cutoff" : coverage >= 0.999 ? "fulfilled" : coverage > 0 ? "partial" : "unmet";

      const reasons = [];
      if (!rt.reachable) {
        const why = [];
        if (!rt.road) why.push("every road route is blocked");
        else if (!hasMode.road) why.push("no truck is available");
        if (!rt.river) why.push("it has no river access");
        else if (!hasMode.river) why.push("no boat is available");
        if (rt.road && hasMode.road && !rt.options.find((o) => o.mode === "road")) why.push("the road trip is longer than a vehicle shift");
        reasons.push("Cannot be reached: " + why.join(", ") + ".");
      } else {
        const modes = rt.options.map((o) => o.mode);
        if (!modes.includes("road") && modes.includes("river")) reasons.push("Road access is cut; supplies go by boat (" + rt.river.minutes + " min one way).");
        if (rt.road && rt.road.risky.length) reasons.push("Road route crosses a risky stretch (" + rt.road.risky.join(", ") + "), so travel time is +50%.");
        const timeShort = RES.filter((r) => res[r].delivered < res[r].target);
        if (timeShort.length) reasons.push("Vehicles ran out of shift time before its share of " + timeShort.map((r) => R[r].label.toLowerCase()).join(", ") + " could be delivered.");
        const outOf = RES.filter((r) => res[r].short > 0 && left[r] <= 0);
        if (outOf.length) {
          const higher = rankOf[v.id] - 1;
          reasons.push("Stock ran out for " + outOf.map((r) => R[r].label.toLowerCase()).join(" and ") +
            (higher > 0 ? " after the " + higher + " higher-priority village" + (higher > 1 ? "s were" : " was") + " served." : "."));
        }
        if (status === "fulfilled") reasons.push("Full request delivered.");
      }
      const est = estimateDemand(v, root.DEMAND_MODEL || model);
      const flags = [];
      if (est) {
        RES.forEach((r) => {
          if (!est[r]) return;
          const ratio = (v.request[r] || 0) / est[r];
          if (ratio > 1.4) flags.push({ r, kind: "high", ratio, text: R[r].label + " request is " + ratio.toFixed(1) + "x the model estimate (" + est[r] + " " + R[r].unit + "). Verify before the next round." });
          else if (ratio < 0.6) flags.push({ r, kind: "low", ratio, text: R[r].label + " request is well below the model estimate (" + est[r] + " " + R[r].unit + "). The village may be under-reporting." });
        });
      }
      if (!v.verified) reasons.push("Request not yet verified by a field team, so its score is reduced by " + Math.round((1 - s.unverifiedFactor) * 100) + "%.");
      return { id: v.id, name: v.name, people: v.people, rank: rankOf[v.id], score: scores[v.id], status, coverage,
        resources: res, reasons, estimate: est, flags, route: rt };
    });

    // 7. Summary, fairness, gap analysis
    const totals = {};
    RES.forEach((r) => {
      const requested = scenario.villages.reduce((sum, v) => sum + (v.request[r] || 0), 0);
      const del = scenario.villages.reduce((sum, v) => sum + delivered[v.id][r], 0);
      totals[r] = { stock: scenario.stock[r] || 0, requested, delivered: del, leftover: left[r], short: requested - del,
        coverage: requested ? del / requested : 1 };
    });
    const peopleTotal = scenario.villages.reduce((a, v) => a + v.people, 0);
    const worst = villageResults.reduce((m, v) => (!m || v.coverage < m.coverage ? v : m), null);
    const belowFloor = villageResults.filter((v) => v.coverage < s.floorPct / 100 - 1e-9);

    const gap = { resources: {}, extraVehicleMinutes: 0, extraTrips: 0, needsAccess: [] };
    RES.forEach((r) => { gap.resources[r] = Math.max(0, totals[r].short); });
    villageResults.forEach((vr) => {
      if (vr.status === "cutoff") { gap.needsAccess.push(vr.name); return; }
      const shortLoad = {};
      RES.forEach((r) => { shortLoad[r] = vr.resources[r].short; });
      const shortKg = kg(shortLoad);
      if (shortKg <= 0) return;
      const opt = vr.route.options.slice().sort((a, b) => a.route.minutes - b.route.minutes)[0];
      const cap = opt.mode === "road" ? s.trucks.capacityKg : s.boats.capacityKg;
      const tripsNeeded = Math.ceil(shortKg / cap);
      gap.extraTrips += tripsNeeded;
      gap.extraVehicleMinutes += tripsNeeded * (2 * opt.route.minutes + s.handlingMin);
    });
    const freeMinutes = fleet.reduce((a, f) => a + (f.shiftMin - f.used), 0);
    gap.extraVehicleMinutes = Math.max(0, gap.extraVehicleMinutes - freeMinutes);

    return {
      scenarioId: scenario.id,
      createdAt: new Date().toISOString(),
      villages: villageResults,
      trips,
      fleet: fleet.map((f) => ({ id: f.id, type: f.type, used: f.used, shiftMin: f.shiftMin, capacityKg: f.capacityKg,
        trips: trips.filter((t) => t.vehicle === f.id).length })),
      totals,
      floorScale,
      summary: {
        peopleTotal,
        peopleFullyServed: villageResults.filter((v) => v.status === "fulfilled").reduce((a, v) => a + v.people, 0),
        peopleCutOff: villageResults.filter((v) => v.status === "cutoff").reduce((a, v) => a + v.people, 0),
        worstVillage: worst ? { name: worst.name, coverage: worst.coverage } : null,
        peopleBelowFloor: belowFloor.reduce((a, v) => a + v.people, 0),
        counts: ["fulfilled", "partial", "unmet", "cutoff"].reduce((o, k) => { o[k] = villageResults.filter((v) => v.status === k).length; return o; }, {})
      },
      gap,
      inputs: {
        stock: Object.assign({}, scenario.stock),
        edges: scenario.edges.reduce((o, e) => { o[e.id] = { status: e.status, name: e.name }; return o; }, {}),
        villages: scenario.villages.map((v) => v.id),
        villageNames: scenario.villages.reduce((o, v) => { o[v.id] = v.name; return o; }, {}),
        fleet: fleet.map((f) => f.id)
      }
    };
  }

  /* ---------- 8. Diff between two plans ---------- */
  function diffPlans(base, cur) {
    const R = (root.ReliefData && root.ReliefData.RESOURCES) || {};
    const inputChanges = [];
    Object.entries(cur.inputs.edges).forEach(([id, e]) => {
      const b = base.inputs.edges[id];
      if (b && b.status !== e.status) inputChanges.push(e.name + ": " + b.status + " → " + e.status);
    });
    RES.forEach((r) => {
      if (base.inputs.stock[r] !== cur.inputs.stock[r]) inputChanges.push((R[r] ? R[r].label : r) + " stock: " + base.inputs.stock[r] + " → " + cur.inputs.stock[r]);
    });
    cur.inputs.villages.filter((id) => !base.inputs.villages.includes(id)).forEach((id) => inputChanges.push("New affected area added: " + cur.inputs.villageNames[id]));
    if (base.inputs.fleet.join() !== cur.inputs.fleet.join()) inputChanges.push("Fleet: " + base.inputs.fleet.join(", ") + " → " + cur.inputs.fleet.join(", "));

    const rows = cur.villages.map((v) => {
      const b = base.villages.find((x) => x.id === v.id);
      const deltas = {};
      RES.forEach((r) => { deltas[r] = v.resources[r].delivered - (b ? b.resources[r].delivered : 0); });
      return { id: v.id, name: v.name, isNew: !b, statusBefore: b ? b.status : null, statusAfter: v.status,
        rankBefore: b ? b.rank : null, rankAfter: v.rank, coverageBefore: b ? b.coverage : 0, coverageAfter: v.coverage, deltas };
    });
    const changed = rows.filter((r) => r.isNew || r.statusBefore !== r.statusAfter || r.rankBefore !== r.rankAfter || RES.some((k) => r.deltas[k] !== 0));
    return { inputChanges, rows, changed };
  }

  /* ---------- 9. Plain-language decision brief ---------- */
  function decisionBrief(result, scenario) {
    const R = (root.ReliefData && root.ReliefData.RESOURCES) || {};
    const pct = (x) => Math.round(x * 100) + "%";
    const fmtLoad = (o) => RES.filter((r) => o[r]).map((r) => r === "water" ? o[r] + " L water" : r === "food" ? o[r] + " food packets" : o[r] + " medical kits").join(", ") || "nothing";
    const L = [];
    L.push("RELIEF DISTRIBUTION PLAN — " + scenario.title.toUpperCase());
    L.push("Prepared by ReliefReady (decision support; final call rests with the coordinator)");
    L.push("");
    L.push("SITUATION");
    L.push(scenario.story);
    L.push("Stock at depot: " + fmtLoad(scenario.stock) + ".");
    L.push("Vehicles: " + result.fleet.map((f) => f.id + " (" + f.capacityKg + " kg)").join(", ") + ".");
    L.push("");
    L.push("PRIORITY ORDER");
    result.villages.forEach((v) => {
      const top = v.score.parts.slice().sort((a, b) => b.points - a.points).slice(0, 2).map((p) => p.label.toLowerCase());
      L.push(v.rank + ". " + v.name + " — score " + v.score.score + " (" + v.people + " people; driven by " + top.join(" and ") + ")");
    });
    L.push("");
    L.push("DISPATCH");
    if (!result.trips.length) L.push("No trips possible with current access and vehicles.");
    result.trips.forEach((t) => {
      L.push("Trip " + t.n + " (" + t.vehicle + ", leaves +" + fmtMin(t.start) + ", back +" + fmtMin(t.end) + "):");
      t.stops.forEach((st) => L.push("    → " + st.villageName + " at ~+" + fmtMin(st.arrive) + ": " + fmtLoad(st.load)));
    });
    L.push("");
    L.push("OUTCOME");
    result.villages.forEach((v) => {
      const st = { fulfilled: "FULFILLED", partial: "PARTIAL", unmet: "UNMET", cutoff: "CUT OFF" }[v.status];
      const shorts = RES.filter((r) => v.resources[r].short > 0).map((r) => fmtLoad({ [r]: v.resources[r].short }));
      L.push("• " + v.name + ": " + st + " (" + pct(v.coverage) + " of request)" + (shorts.length ? " — short " + shorts.join(", ") : ""));
      v.reasons.filter((x) => x !== "Full request delivered.").forEach((x) => L.push("    " + x));
    });
    L.push("");
    L.push("FAIRNESS");
    L.push("Every reachable village first received an equal " + scenario.settings.floorPct + "% share (scaled down if stock was short), before the rest was given by priority.");
    if (result.summary.worstVillage) L.push("Worst-served village: " + result.summary.worstVillage.name + " at " + pct(result.summary.worstVillage.coverage) + ".");
    L.push("");
    L.push("WHAT WE NEED TO MEET ALL REQUESTS");
    const g = result.gap;
    const needs = RES.filter((r) => g.resources[r] > 0).map((r) => g.resources[r] + " more " + R[r].unit + " of " + R[r].label.toLowerCase());
    L.push(needs.length ? "Stock: " + needs.join("; ") + "." : "Stock: enough.");
    if (g.extraVehicleMinutes > 0) L.push("Transport: about " + (g.extraVehicleMinutes / 60).toFixed(1) + " more vehicle-hours (" + g.extraTrips + " trips).");
    if (g.needsAccess.length) L.push("Access: " + g.needsAccess.join(", ") + " cannot be reached. Clear a road or arrange a boat/air drop.");
    return L.join("\n");
  }

  function fmtMin(m) {
    const h = Math.floor(m / 60), mm = Math.round(m % 60);
    return h + "h" + String(mm).padStart(2, "0");
  }

  const api = { plan, diffPlans, decisionBrief, estimateDemand, shortestPaths, FACTORS, RES, fmtMin };
  root.ReliefEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
