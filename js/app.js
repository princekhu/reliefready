/* ReliefReady — UI controller. Reads state, calls ReliefEngine, renders. */
(function () {
  "use strict";
  const E = window.ReliefEngine;
  const D = window.ReliefData;
  const M = window.DEMAND_MODEL;
  const R = D.RESOURCES;
  const RES_SHOW = ["water", "food", "meds"];
  const $ = (id) => document.getElementById(id);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pct = (x) => Math.round(x * 100) + "%";
  const STATUS_LABEL = { fulfilled: "Fulfilled", partial: "Partial", unmet: "Unmet", cutoff: "Cut off" };
  const STATUS_VAR = { fulfilled: "--ok", partial: "--warn", unmet: "--bad", cutoff: "--cut" };
  const SVGNS = "http://www.w3.org/2000/svg";

  const state = { scenarioId: D.SCENARIOS[0].id, scenario: null, baseline: null, current: null, selected: null, mode: "road", addPoint: null, newCount: 0 };

  /* ---------- scenario lifecycle ---------- */
  function loadScenario(id) {
    state.scenarioId = id;
    state.scenario = clone(D.SCENARIOS.find((s) => s.id === id));
    state.selected = null;
    state.addPoint = null;
    $("addForm").hidden = true;
    state.current = E.plan(state.scenario, M);
    state.baseline = state.current;
    syncControls();
    renderAll();
  }

  function recompute() {
    state.current = E.plan(state.scenario, M);
    renderAll();
  }

  /* ---------- controls ---------- */
  function syncControls() {
    const s = state.scenario;
    $("scTitle").textContent = s.title;
    $("scStory").textContent = s.story;
    ["food", "water", "meds"].forEach((r) => { $("stock-" + r).value = s.stock[r]; });
    $("truckCount").value = String(s.settings.trucks.count);
    $("boatOn").checked = !!s.settings.boats.enabled;
    $("floorPct").value = s.settings.floorPct;
    $("floorOut").textContent = s.settings.floorPct + "%";
    renderWeights();
  }

  function bindControls() {
    const sel = $("scenarioSel");
    D.SCENARIOS.forEach((s) => { const o = document.createElement("option"); o.value = s.id; o.textContent = s.title; sel.appendChild(o); });
    sel.addEventListener("change", () => loadScenario(sel.value));
    ["food", "water", "meds"].forEach((r) => {
      $("stock-" + r).addEventListener("change", (e) => {
        state.scenario.stock[r] = Math.max(0, Math.round(Number(e.target.value) || 0));
        e.target.value = state.scenario.stock[r];
        recompute();
      });
    });
    $("truckCount").addEventListener("change", (e) => { state.scenario.settings.trucks.count = Number(e.target.value); recompute(); });
    $("boatOn").addEventListener("change", (e) => { state.scenario.settings.boats.enabled = e.target.checked; recompute(); });
    $("floorPct").addEventListener("input", (e) => { state.scenario.settings.floorPct = Number(e.target.value); $("floorOut").textContent = e.target.value + "%"; recompute(); });
    $("modeRoad").addEventListener("click", () => setMode("road"));
    $("modeAdd").addEventListener("click", () => setMode("add"));
    $("resetBtn").addEventListener("click", () => loadScenario(state.scenarioId));
    $("resetWeights").addEventListener("click", () => { state.scenario.settings.weights = clone(D.BASE_SETTINGS.weights); renderWeights(); recompute(); });
    $("copyBrief").addEventListener("click", copyBrief);
    window.addEventListener("hashchange", route);
  }

  function setMode(m) {
    state.mode = m;
    $("modeRoad").classList.toggle("on", m === "road");
    $("modeAdd").classList.toggle("on", m === "add");
    $("map").classList.toggle("adding", m === "add");
    $("mapHint").textContent = m === "road"
      ? "Click a road to cycle it open → risky → blocked. The plan recalculates instantly."
      : "Click an empty spot on the map to place a new affected area. It connects to the nearest junction by road.";
    if (m === "road") { $("addForm").hidden = true; state.addPoint = null; renderMap(); }
  }

  function renderWeights() {
    const w = state.scenario.settings.weights;
    $("weights").innerHTML = E.FACTORS.map((f) =>
      '<label class="field"><span>' + esc(f.label) + '</span><span class="row"><input type="range" min="0" max="50" step="5" id="w-' + f.key + '" value="' + w[f.key] + '"><output class="num" id="wo-' + f.key + '">' + w[f.key] + "</output></span></label>"
    ).join("") + '<p class="hint" style="margin:0">Weights are relative: only their proportions matter. Raise “Vulnerable share” to favour villages with infants and elderly.</p>';
    E.FACTORS.forEach((f) => {
      $("w-" + f.key).addEventListener("input", (e) => {
        w[f.key] = Number(e.target.value);
        $("wo-" + f.key).textContent = e.target.value;
        recompute();
      });
    });
  }

  /* ---------- render all ---------- */
  function renderAll() {
    renderMap();
    renderKpis();
    renderDiff();
    renderList();
    renderGantt();
    renderGap();
    renderHow();
    $("briefText").textContent = E.decisionBrief(state.current, state.scenario);
  }

  /* ---------- map ---------- */
  function el(tag, attrs, text) {
    const n = document.createElementNS(SVGNS, tag);
    let style = "";
    Object.entries(attrs || {}).forEach(([k, v]) => {
      // CSS variables only resolve reliably through style, not SVG presentation attributes
      if (typeof v === "string" && v.includes("var(")) style += k + ":" + v + ";";
      else n.setAttribute(k, v);
    });
    if (style) n.setAttribute("style", style);
    if (text != null) n.textContent = text;
    return n;
  }
  function pos(id) {
    const s = state.scenario;
    return s.nodes.find((n) => n.id === id) || s.villages.find((v) => v.id === id);
  }

  function renderMap() {
    const svg = $("map");
    svg.innerHTML = "";
    const s = state.scenario, cur = state.current;
    const vres = {};
    cur.villages.forEach((v) => { vres[v.id] = v; });

    // grid
    const grid = el("g", { opacity: "0.5" });
    for (let x = 50; x < 1000; x += 50) grid.appendChild(el("line", { x1: x, y1: 0, x2: x, y2: 620, stroke: "var(--line)", "stroke-width": x % 250 === 0 ? 1.2 : 0.5 }));
    for (let y = 50; y < 620; y += 50) grid.appendChild(el("line", { x1: 0, y1: y, x2: 1000, y2: y, stroke: "var(--line)", "stroke-width": y % 250 === 0 ? 1.2 : 0.5 }));
    svg.appendChild(grid);
    // river (drawn through the boat route nodes)
    svg.appendChild(el("path", { d: "M 20 40 C 70 90, 90 120, 130 135 S 300 290, 420 330 S 520 345, 560 380 S 740 500, 810 548 S 930 610, 1000 620",
      fill: "none", stroke: "var(--water-soft)", "stroke-width": 26, "stroke-linecap": "round" }));
    svg.appendChild(el("text", { x: 300, y: 300, class: "map-sub", fill: "var(--water)", transform: "rotate(28 300 300)" }, "Kabini river"));

    // highlight routes of selected village's trips
    const hi = new Set();
    if (state.selected) cur.trips.filter((t) => t.stops.some((x) => x.villageId === state.selected)).forEach((t) => t.routeEdges.forEach((e) => hi.add(e)));

    // edges
    s.edges.forEach((e) => {
      const a = pos(e.a), b = pos(e.b);
      if (!a || !b) return;
      const g = el("g", { class: "edge-g" });
      const river = e.mode === "river";
      let color = river ? "var(--water)" : "var(--ink-3)";
      let dash = river ? "2 6" : "";
      if (e.status === "risky") { color = "var(--warn)"; dash = "10 6"; }
      if (e.status === "blocked") { color = "var(--bad)"; dash = river ? "2 6" : ""; }
      if (hi.has(e.id)) g.appendChild(el("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: "var(--accent)", "stroke-width": 11, "stroke-linecap": "round", opacity: "0.45" }));
      g.appendChild(el("line", { class: "edge-line", x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: color, "stroke-width": e.status === "blocked" ? 3 : 4,
        "stroke-dasharray": dash, "stroke-linecap": "round", opacity: e.status === "blocked" ? 0.85 : 1 }));
      const hit = el("line", { class: "edge-hit", x1: a.x, y1: a.y, x2: b.x, y2: b.y, tabindex: "0", role: "button",
        "aria-label": e.name + ", " + e.status + ". Activate to change." });
      hit.appendChild(el("title", {}, e.name + " · " + e.minutes + " min · " + e.status + " — click to change"));
      const cycle = () => {
        if (state.mode !== "road") return;
        e.status = e.status === "open" ? "risky" : e.status === "risky" ? "blocked" : "open";
        recompute();
      };
      hit.addEventListener("click", (ev) => { ev.stopPropagation(); cycle(); });
      hit.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); cycle(); } });
      g.appendChild(hit);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (e.status === "blocked") {
        g.appendChild(el("circle", { cx: mx, cy: my, r: 11, fill: "var(--bad)" }));
        g.appendChild(el("path", { d: `M ${mx - 5} ${my - 5} L ${mx + 5} ${my + 5} M ${mx + 5} ${my - 5} L ${mx - 5} ${my + 5}`, stroke: "var(--surface)", "stroke-width": 2.5, "stroke-linecap": "round", "pointer-events": "none" }));
        g.appendChild(el("text", { x: mx, y: my + 26, "text-anchor": "middle", class: "map-sub", fill: "var(--bad)", "pointer-events": "none" }, e.name));
      } else {
        const mins = Math.round(e.minutes * (e.status === "risky" ? 1.5 : 1));
        g.appendChild(el("text", { x: mx, y: my - 8, "text-anchor": "middle", class: "map-sub", "pointer-events": "none" }, mins + "m" + (river ? " ⛴" : "")));
      }
      svg.appendChild(g);
    });

    // junctions + depot
    s.nodes.forEach((n) => {
      if (n.kind === "depot") {
        svg.appendChild(el("rect", { x: n.x - 16, y: n.y - 16, width: 32, height: 32, rx: 3, fill: "var(--ink)", stroke: "var(--accent)", "stroke-width": 3 }));
        svg.appendChild(el("text", { x: n.x, y: n.y + 5, "text-anchor": "middle", fill: "var(--paper)", "font-family": "var(--f-display)", "font-size": 15, "font-weight": 700 }, "D"));
        svg.appendChild(el("text", { x: n.x + 24, y: n.y - 18, class: "map-label" }, n.name));
      } else {
        svg.appendChild(el("circle", { cx: n.x, cy: n.y, r: 5, fill: "var(--surface)", stroke: "var(--ink-2)", "stroke-width": 2 }));
        svg.appendChild(el("text", { x: n.x + 9, y: n.y + 16, class: "map-sub" }, n.name));
      }
    });

    // villages
    s.villages.forEach((v) => {
      const r = vres[v.id];
      const rad = 10 + Math.sqrt(v.people) * 0.9;
      const g = el("g", { class: "village-g", tabindex: "0", role: "button", "aria-label": v.name + ", " + STATUS_LABEL[r.status] + ", rank " + r.rank });
      if (state.selected === v.id) g.appendChild(el("circle", { cx: v.x, cy: v.y, r: rad + 7, fill: "none", stroke: "var(--accent)", "stroke-width": 3 }));
      g.appendChild(el("circle", { cx: v.x, cy: v.y, r: rad, fill: "var(" + STATUS_VAR[r.status] + ")", stroke: "var(--surface)", "stroke-width": 3,
        "stroke-dasharray": r.status === "cutoff" ? "4 3" : "" }));
      g.appendChild(el("text", { x: v.x, y: v.y + 6, "text-anchor": "middle", fill: "var(--surface)", "font-family": "var(--f-display)", "font-size": 18, "font-weight": 700 }, "#" + r.rank));
      const lx = v.x > 820 ? v.x - rad - 6 : v.x + rad + 6;
      const anchor = v.x > 820 ? "end" : "start";
      g.appendChild(el("text", { x: lx, y: v.y - 2, class: "map-label", "text-anchor": anchor }, v.name));
      g.appendChild(el("text", { x: lx, y: v.y + 13, class: "map-sub", "text-anchor": anchor }, v.people + " ppl · " + pct(r.coverage)));
      const pick = () => { state.selected = state.selected === v.id ? null : v.id; renderMap(); renderList(); };
      g.addEventListener("click", (ev) => { ev.stopPropagation(); pick(); });
      g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pick(); } });
      svg.appendChild(g);
    });

    if (state.addPoint) {
      svg.appendChild(el("circle", { cx: state.addPoint.x, cy: state.addPoint.y, r: 14, fill: "var(--accent)", opacity: 0.8 }));
      svg.appendChild(el("text", { x: state.addPoint.x, y: state.addPoint.y + 5, "text-anchor": "middle", fill: "var(--accent-ink)", "font-weight": 700 }, "+"));
    }
  }

  function svgPoint(evt) {
    const svg = $("map");
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: Math.round(Math.max(30, Math.min(970, p.x))), y: Math.round(Math.max(30, Math.min(590, p.y))) };
  }

  /* ---------- add affected area (uses the demand model) ---------- */
  function openAddForm(p) {
    state.addPoint = p;
    renderMap();
    const s = state.scenario;
    const near = s.nodes.slice().sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    const minutes = Math.max(15, Math.round(Math.hypot(near.x - p.x, near.y - p.y) / 3.2));
    const f = $("addForm");
    f.innerHTML =
      "<h4>New affected area</h4>" +
      fld("na-name", "Name", "text", "New Colony " + (state.newCount + 1)) +
      fld("na-people", "People", "number", 160) +
      fld("na-infants", "Infants", "number", 6) +
      fld("na-elderly", "Elderly", "number", 20) +
      fld("na-pregnant", "Pregnant", "number", 2) +
      fld("na-injured", "Injured", "number", 3) +
      '<label class="field"><span>Urgency 1–5</span><select id="na-urgency"><option>1</option><option>2</option><option selected>3</option><option>4</option><option>5</option></select></label>' +
      '<div class="field"><span>Water source</span><label class="check"><input type="checkbox" id="na-ws"> Safe source works</label></div>' +
      '<div class="actions"><span class="hint" id="na-est"></span></div>' +
      '<div class="actions"><span class="hint">Connects to ' + esc(near.name) + " by road, about " + minutes + ' min.</span></div>' +
      '<div class="actions"><button class="btn primary" type="submit">Add and re-plan</button><button class="btn" type="button" id="na-cancel">Cancel</button></div>';
    f.hidden = false;
    const read = () => ({
      name: ($("na-name").value || "New area").trim(), people: num("na-people"), infants: num("na-infants"), elderly: num("na-elderly"),
      pregnant: num("na-pregnant"), injured: num("na-injured"), urgency: Number($("na-urgency").value), waterSource: $("na-ws").checked, daysSinceAid: 2
    });
    const showEst = () => {
      const est = E.estimateDemand(read(), M);
      $("na-est").innerHTML = "Model estimate for one day (used as the request): <b class='num'>" + est.water + " L water · " + est.food + " food · " + est.meds + " kits</b>";
    };
    f.querySelectorAll("input,select").forEach((i) => i.addEventListener("input", showEst));
    showEst();
    $("na-cancel").onclick = () => { f.hidden = true; state.addPoint = null; renderMap(); };
    f.onsubmit = (ev) => {
      ev.preventDefault();
      const v = read();
      state.newCount++;
      const id = "N" + state.newCount;
      const est = E.estimateDemand(v, M);
      Object.assign(v, { id, x: p.x, y: p.y, verified: false, request: { food: est.food, water: est.water, meds: est.meds }, note: "Added during planning. Request from the demand model." });
      s.villages.push(v);
      s.edges.push({ id: "en" + state.newCount, a: near.id, b: id, minutes, mode: "road", name: v.name + " road", status: "open" });
      f.hidden = true; state.addPoint = null;
      setMode("road");
      state.selected = id;
      recompute();
    };
  }
  function fld(id, label, type, val) {
    return '<label class="field"><span>' + label + '</span><input id="' + id + '" type="' + type + '" value="' + esc(val) + '"' + (type === "number" ? ' min="0"' : "") + "></label>";
  }
  function num(id) { return Math.max(0, Math.round(Number($(id).value) || 0)); }

  /* ---------- KPIs ---------- */
  function renderKpis() {
    const c = state.current, sm = c.summary;
    const kpi = (k, v, s) => '<div class="kpi"><div class="k">' + k + '</div><div class="v num">' + v + '</div><div class="s">' + s + "</div></div>";
    $("kpis").innerHTML =
      kpi("People fully served", sm.peopleFullyServed + "<small style='font-size:16px;color:var(--ink-3)'> / " + sm.peopleTotal + "</small>",
        sm.counts.fulfilled + " fulfilled · " + sm.counts.partial + " partial · " + (sm.counts.unmet + sm.counts.cutoff) + " unmet or cut off") +
      kpi("Water delivered", pct(c.totals.water.coverage), c.totals.water.delivered + " of " + c.totals.water.requested + " L requested") +
      kpi("Food delivered", pct(c.totals.food.coverage), c.totals.food.delivered + " of " + c.totals.food.requested + " packets requested") +
      kpi("Worst-served village", sm.worstVillage ? pct(sm.worstVillage.coverage) : "–",
        (sm.worstVillage ? esc(sm.worstVillage.name) : "") + (sm.peopleCutOff ? " · " + sm.peopleCutOff + " people cut off" : ""));
  }

  /* ---------- diff vs baseline ---------- */
  function renderDiff() {
    const d = E.diffPlans(state.baseline, state.current);
    const box = $("diffPanel");
    if (!d.inputChanges.length && !d.changed.length) {
      box.innerHTML = '<div class="panel-h"><h3>Changes since baseline</h3></div><div class="panel-b"><p class="hint" style="margin:0">No changes yet. Block a road, add an area, or change stock and fleet. Every effect on the plan will be listed here.</p></div>';
      box.style.borderColor = "var(--line)";
      return;
    }
    box.style.borderColor = "";
    const fmtDelta = (n, unit) => n === 0 ? "" : '<span class="' + (n > 0 ? "up" : "down") + ' num">' + (n > 0 ? "+" : "−") + Math.abs(n) + " " + unit + "</span>";
    const rows = d.changed.map((r) => {
      const st = r.isNew ? "new → " + STATUS_LABEL[r.statusAfter] : r.statusBefore === r.statusAfter ? STATUS_LABEL[r.statusAfter] : STATUS_LABEL[r.statusBefore] + " → <b>" + STATUS_LABEL[r.statusAfter] + "</b>";
      const rk = r.rankBefore === r.rankAfter || r.isNew ? "#" + r.rankAfter : "#" + r.rankBefore + " → #" + r.rankAfter;
      const deltas = RES_SHOW.map((k) => fmtDelta(r.deltas[k], R[k].unit === "L" ? "L" : k === "food" ? "food" : "kits")).filter(Boolean).join("<br>");
      return "<tr><td><b>" + esc(r.name) + "</b><br><span class='hint'>" + rk + "</span></td><td>" + st + "<br><span class='hint num'>" + pct(r.coverageBefore) + " → " + pct(r.coverageAfter) + "</span></td><td>" + (deltas || "–") + "</td></tr>";
    }).join("");
    box.innerHTML = '<div class="panel-h"><h3>Changes since baseline</h3><button class="btn small" id="setBase" type="button">Make this the baseline</button></div>' +
      '<div class="panel-b"><div class="inputs"><b>You changed:</b> ' + (d.inputChanges.length ? d.inputChanges.map(esc).join(" · ") : "priority settings") + "</div>" +
      (d.changed.length ? '<div class="table-scroll"><table><thead><tr><th>Village</th><th>Status · coverage</th><th>Delivered change</th></tr></thead><tbody>' + rows + "</tbody></table></div>" : '<p class="hint" style="margin:0">The plan did not change.</p>') + "</div>";
    $("setBase").addEventListener("click", () => { state.baseline = state.current; renderDiff(); });
  }

  /* ---------- village list ---------- */
  function renderList() {
    const s = state.scenario, floor = s.settings.floorPct / 100;
    $("vlist").innerHTML = state.current.villages.map((v) => {
      const src = s.villages.find((x) => x.id === v.id);
      const bars = RES_SHOW.map((r) => {
        const x = v.resources[r];
        return '<span class="lbl">' + (r === "water" ? "Water" : r === "food" ? "Food" : "Med kits") + '</span>' +
          '<span class="bar" title="Floor marker at ' + Math.round(floor * 100) + '%"><span class="fill" style="width:' + Math.min(100, x.coverage * 100) + '%"></span>' +
          (floor > 0 ? '<span class="floor" style="left:' + floor * 100 + '%"></span>' : "") + "</span>" +
          '<span class="val">' + x.delivered + "/" + x.requested + (x.short ? ' <span class="down">−' + x.short + "</span>" : "") + "</span>";
      }).join("");
      const parts = v.score.parts.map((p) =>
        "<span>" + esc(p.label) + " <span class='hint num'>(" + p.value.toFixed(2) + " × w" + p.weight + ")</span></span><span class='bar'><span class='fill' style='width:" + Math.min(100, p.points * 2) + "%'></span></span><span class='num'>" + p.points.toFixed(1) + "</span>"
      ).join("");
      const flags = v.flags.map((f) => '<div class="flag"><b>Check request · </b>' + esc(f.text) + "</div>").join("");
      return '<article class="vcard' + (state.selected === v.id ? " sel" : "") + '" data-status="' + v.status + '" data-id="' + v.id + '" tabindex="0">' +
        '<div class="vhead"><span class="rank">' + v.rank + '</span><div><div class="vname">' + esc(v.name) + ' <span class="chip ' + v.status + '">' + STATUS_LABEL[v.status] + "</span></div>" +
        '<div class="vmeta">' + src.people + " people · " + src.infants + " infants · " + src.elderly + " elderly · urgency " + src.urgency + "/5" + (src.verified ? "" : " · <b>unverified</b>") + "</div></div>" +
        '<div class="score"><b>' + v.score.score.toFixed(1) + "</b><small>priority</small></div></div>" +
        '<div class="bars">' + bars + "</div>" +
        '<ul class="reasons">' + v.reasons.map((r) => "<li>" + esc(r) + "</li>").join("") + "</ul>" + flags +
        '<details class="why"><summary>Why this score</summary><div class="why-grid">' + parts + "</div>" +
        (v.score.verifiedFactor < 1 ? "<p class='hint' style='margin:4px 0 0'>Total × " + v.score.verifiedFactor + " because the request is unverified.</p>" : "") +
        (src.note ? "<p class='hint' style='margin:4px 0 0'>Field note: " + esc(src.note) + "</p>" : "") + "</details></article>";
    }).join("");
    $("vlist").querySelectorAll(".vcard").forEach((c) => {
      const pick = (ev) => {
        if (ev.target.closest("details")) return;
        state.selected = state.selected === c.dataset.id ? null : c.dataset.id;
        renderMap(); renderList();
      };
      c.addEventListener("click", pick);
      c.addEventListener("keydown", (ev) => { if (ev.key === "Enter") pick(ev); });
    });
  }

  /* ---------- timeline ---------- */
  function renderGantt() {
    const c = state.current;
    const maxShift = Math.max(...c.fleet.map((f) => f.shiftMin), 60);
    let ax = "";
    for (let h = 0; h <= maxShift / 60; h += 2) ax += '<span style="left:' + (h * 60 / maxShift) * 100 + '%">' + h + "h</span>";
    $("axis").innerHTML = ax;
    if (!c.fleet.length) {
      $("gantt").innerHTML = '<p class="hint">No vehicles available. Add a truck or the boat above.</p>';
      $("tripList").innerHTML = "";
      return;
    }
    $("gantt").innerHTML = c.fleet.map((f) => {
      const bars = c.trips.filter((t) => t.vehicle === f.id).map((t) =>
        '<div class="trip ' + t.round + '" style="left:' + (t.start / maxShift) * 100 + "%;width:" + ((t.end - t.start) / maxShift) * 100 + '%" title="Trip ' + t.n + ": " +
        esc(t.stops.map((x) => x.villageName).join(" → ")) + " · " + t.kg + ' kg">T' + t.n + " · " + esc(t.stops.map((x) => x.villageName).join(", ")) + "</div>"
      ).join("");
      return '<div class="gantt-row"><div class="who">' + f.id + "<small class='num'>" + Math.round(f.used / 60 * 10) / 10 + "h / " + f.shiftMin / 60 + "h</small></div><div class=\"track\">" + bars + "</div></div>";
    }).join("");
    const load = (o) => RES_SHOW.filter((r) => o[r]).map((r) => o[r] + (r === "water" ? " L" : r === "food" ? " food" : " kits")).join(", ");
    $("tripList").innerHTML = c.trips.length ? c.trips.map((t) =>
      "<li><b>T" + t.n + "</b><span>" + t.vehicle + ", leaves +" + E.fmtMin(t.start) + ", " + t.kg + "/" + t.capacityKg + " kg. " +
      t.stops.map((x) => esc(x.villageName) + " ~+" + E.fmtMin(x.arrive) + " (" + load(x.load) + ")").join(" → ") +
      (t.risky.length ? " <span class='chip partial'>risky: " + esc(t.risky.join(", ")) + "</span>" : "") + "</span></li>"
    ).join("") : "<li><span></span><span class='hint'>No trips possible with the current access and vehicles.</span></li>";
  }

  /* ---------- gap ---------- */
  function renderGap() {
    const g = state.current.gap;
    const items = [];
    RES_SHOW.forEach((r) => { if (g.resources[r] > 0) items.push("<li><b class='num'>" + g.resources[r] + " " + R[r].unit + "</b> more " + R[r].label.toLowerCase() + "</li>"); });
    if (g.extraVehicleMinutes > 0) items.push("<li><b class='num'>" + (g.extraVehicleMinutes / 60).toFixed(1) + " vehicle-hours</b> more transport (about " + g.extraTrips + " trips), beyond today's free time</li>");
    g.needsAccess.forEach((n) => items.push("<li><b>" + esc(n) + "</b> needs access: clear a road, or send a boat or air drop</li>"));
    $("gapBox").innerHTML = items.length
      ? '<p class="hint" style="margin-top:0">To meet every request in full, the district needs to ask for:</p><ul class="gap-list">' + items.join("") + "</ul>"
      : "<p style='margin:0'>Every request can be met with current stock and vehicles.</p>";
  }

  /* ---------- how it works (live numbers) ---------- */
  function renderHow() {
    const w = state.scenario.settings.weights;
    const tot = E.FACTORS.reduce((a, f) => a + w[f.key], 0) || 1;
    $("formula").textContent = "score = 100 × ( " + E.FACTORS.map((f) => w[f.key] + "·" + f.key).join(" + ") + " ) ÷ " + tot +
      "\nif request unverified:  score × " + state.scenario.settings.unverifiedFactor + "\n(weights update live from the Plan tab)";
    if (!M || $("mlBox").dataset.done) return;
    const t = M.targets;
    const coefRows = Object.entries(t.water.coef).filter(([, c]) => Math.abs(c) > 0.01)
      .map(([k, c]) => "<tr><td class='num'>" + k + "</td><td class='num'>" + c.toFixed(3) + "</td></tr>").join("");
    $("mlBox").innerHTML =
      "<p style='margin-top:0'>Trained in Python (scikit-learn) on " + esc(M.trained_on) + ", 80/20 train-test split. Coefficients are exported to the website, so predictions run in the browser.</p>" +
      "<table class='plain'><thead><tr><th>Predicts (per day)</th><th>R² (test)</th><th>Mean abs. error</th></tr></thead><tbody>" +
      ["water", "food", "meds"].map((k) => "<tr><td>" + R[k].label + "</td><td class='num'>" + t[k].metrics.r2.toFixed(3) + "</td><td class='num'>" + t[k].metrics.mae + " " + R[k].unit + " (" + t[k].metrics.mape_pct + "%)</td></tr>").join("") +
      "</tbody></table><p class='hint'>Water model coefficients (litres per unit):</p><div class='table-scroll'><table class='plain'><tbody><tr><td class='num'>intercept</td><td class='num'>" + t.water.intercept.toFixed(2) + "</td></tr>" + coefRows + "</tbody></table></div>" +
      "<p class='hint'>Training data is synthetic, generated from our written planning assumptions plus 8% noise. The high R² shows the model learned those assumptions, not real-world accuracy. Swap in real district relief records and retrain with one command.</p>";
    $("mlBox").dataset.done = "1";
  }

  /* ---------- brief ---------- */
  function copyBrief() {
    const txt = $("briefText").textContent;
    const done = (m) => { $("copyToast").textContent = m; setTimeout(() => { $("copyToast").textContent = ""; }, 2500); };
    try {
      navigator.clipboard.writeText(txt).then(() => done("Copied"), () => selectBrief(done));
    } catch (e) { selectBrief(done); }
  }
  function selectBrief(done) {
    const r = document.createRange(); r.selectNodeContents($("briefText"));
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    done("Text selected. Press Ctrl+C to copy.");
  }

  /* ---------- tabs ---------- */
  function route() {
    const tab = ["plan", "how", "brief"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "plan";
    document.querySelectorAll("[data-view]").forEach((v) => { v.hidden = v.dataset.view !== tab; });
    document.querySelectorAll(".tabs a").forEach((a) => { if (a.dataset.tab === tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  }

  /* ---------- boot ---------- */
  bindControls();
  $("map").addEventListener("click", (ev) => { if (state.mode === "add") openAddForm(svgPoint(ev)); });
  route();
  loadScenario(state.scenarioId);
})();
