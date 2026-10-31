/* ReliefReady map toolkit, shared by every map.
   Modelled on the Copernicus EMS rapid-mapping viewer: grouped layer list that doubles as the legend,
   graded crisis layers, areas of interest (AOI) drawn anywhere with an impact analysis for each,
   place search that can turn a village or taluk boundary into an AOI, scale, cursor coordinates, full screen. */
(function(){
if(!window.L || !window.RR) return;
const esc = RR.esc, rad = Math.PI/180;
const AOI_KEY = 'rr.aois';
const loadAois = () => { try{ return JSON.parse(localStorage.getItem(AOI_KEY)||'[]'); }catch(e){ return []; } };
const saveAois = a => { try{ localStorage.setItem(AOI_KEY, JSON.stringify(a)); }catch(e){} RR.emitAoi(); };
const maps = [];
RR.emitAoi = () => maps.forEach(m => m.rrDrawAois && m.rrDrawAois());
addEventListener('storage', e => { if(e.key===AOI_KEY) RR.emitAoi(); });

/* Crisis-information classes, named the way EMS products name them. */
RR.EMS = [
  {t:'flooded',  label:'Observed flood extent'},
  {t:'red',      label:'No-entry zone (destroyed / unsafe)'},
  {t:'landslide',label:'Landslide / debris flow'},
  {t:'caution',  label:'Possibly affected'},
  {t:'relief',   label:'Relief / safe area'},
  {t:'info',     label:'Mapped area (reference)'},
];

/* ---------- geometry ---------- */
RR.areaKm2 = c => { if(!c || c.length<3) return 0;
  const R = 6371.0088, lat0 = c.reduce((t,p)=>t+p[0],0)/c.length*rad; let s = 0;
  for(let i=0,j=c.length-1;i<c.length;j=i++){ const xi=c[i][1]*rad*Math.cos(lat0)*R, yi=c[i][0]*rad*R, xj=c[j][1]*rad*Math.cos(lat0)*R, yj=c[j][0]*rad*R; s += xj*yi - xi*yj; }
  return Math.abs(s/2); };
const bbox = c => { let a=90,b=180,d=-90,e=-180; c.forEach(p=>{ a=Math.min(a,p[0]); d=Math.max(d,p[0]); b=Math.min(b,p[1]); e=Math.max(e,p[1]); }); return {s:a,w:b,n:d,e}; };
const centroid = c => ({lat:c.reduce((t,p)=>t+p[0],0)/c.length, lon:c.reduce((t,p)=>t+p[1],0)/c.length});
const fmtA = k => k<1 ? (k*100).toFixed(0)+' ha' : k<10 ? k.toFixed(2)+' km²' : k.toFixed(1)+' km²';
const n0 = v => Math.round(v).toLocaleString('en-IN');

/* ---------- impact analysis for one AOI ---------- */
RR.aoiStats = coords => {
  const inA = o => o && o.lat!=null && RR.inPoly(o, coords);
  const sos = RR.store.all('sos').filter(s => s.status!=='served' && inA(s));
  const sum = k => sos.reduce((t,s)=>t+(+s[k]||0),0);
  const people = sum('people');
  const area = RR.areaKm2(coords), bb = bbox(coords), c = centroid(coords);
  // graded coverage by grid sampling (60 x 60 points)
  const zones = RR.store.all('zones').filter(z => { if(!z.coords||z.coords.length<3) return false; const b = bbox(z.coords); return !(b.s>bb.n||b.n<bb.s||b.w>bb.e||b.e<bb.w); });
  const N = 60, cov = {}; let tot = 0, inDist = 0;
  for(let i=0;i<N;i++) for(let j=0;j<N;j++){
    const p = {lat:bb.s+(i+.5)*(bb.n-bb.s)/N, lon:bb.w+(j+.5)*(bb.e-bb.w)/N};
    if(!RR.inPoly(p, coords)) continue; tot++;
    if(RR.DISTRICT && RR.inPoly(p, RR.DISTRICT.coords)) inDist++;
    const hit = new Set(); zones.forEach(z => { if(RR.inPoly(p, z.coords)) hit.add(z.type); });
    hit.forEach(t => cov[t] = (cov[t]||0)+1);
  }
  const graded = RR.EMS.filter(g => cov[g.t]).map(g => ({...g, km2:area*cov[g.t]/tot, pct:100*cov[g.t]/tot}));
  const hazards = RR.store.all('reports').filter(r => r.type!=='safe' && inA(r));
  const vehicles = RR.store.all('drivers').filter(inA);
  const nearest = RR.store.all('drivers').filter(d => d.lat!=null && !inA(d)).map(d => ({d, m:RR.dist(c, d)})).sort((a,b)=>a.m-b.m)[0];
  return {area, centre:c, inDistrict: tot ? inDist/tot : 0, sos, people, infants:sum('infants'), elderly:sum('elderly'), injured:sum('injured'),
    critical: sos.filter(s => RR.sosPriority(s)>=75).length, graded, hazards, vehicles, nearest,
    stops: RR.store.all('stops').filter(s => s.status!=='delivered' && inA(s)),
    // Sphere minimum standards, per day
    needs:{water:people*15, food:people, hygiene:Math.ceil(people/5), shelter:Math.ceil(people/5)}};
};

/* ---------- toolkit ---------- */
RR.mapTools = (map, opts={}) => {
  const el = map.getContainer(); maps.push(map);
  el.classList.add('rrmap');
  const stop = n => { L.DomEvent.disableClickPropagation(n); L.DomEvent.disableScrollPropagation(n); return n; };
  map.rrLayers = map.rrLayers || [];
  map.rrHidden = map.rrHidden || new Set();

  /* scale + coordinates */
  if(!opts.noScale) L.control.scale({imperial:false, position:'bottomleft'}).addTo(map);
  const Coord = L.Control.extend({options:{position:'bottomleft'}, onAdd(){ const d = L.DomUtil.create('div','rr-coord'); d.textContent = 'Move over the map for coordinates'; map.on('mousemove', e => d.textContent = e.latlng.lat.toFixed(5)+'° N, '+e.latlng.lng.toFixed(5)+'° E'); return d; }});
  new Coord().addTo(map);

  /* toolbar: rectangle, polygon, search, full screen */
  const ico = {
    rect:'<svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2"/></svg>',
    poly:'<svg viewBox="0 0 24 24"><path d="M5 8l7-4 7 6-3 9H7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="5" cy="8" r="1.8" fill="currentColor"/><circle cx="12" cy="4" r="1.8" fill="currentColor"/><circle cx="19" cy="10" r="1.8" fill="currentColor"/></svg>',
    search:'<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 15l5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    full:'<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    layers:'<svg viewBox="0 0 24 24"><path d="M12 3l9 5-9 5-9-5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M3 13l9 5 9-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  };
  const Tools = L.Control.extend({options:{position:'topleft'}, onAdd(){
    const box = stop(L.DomUtil.create('div','rr-tools'));
    box.innerHTML = `<button type="button" data-t="rect" title="Select an area: rectangle" aria-label="Select an area with a rectangle">${ico.rect}</button>
      <button type="button" data-t="poly" title="Select an area: polygon" aria-label="Select an area with a polygon">${ico.poly}</button>
      <button type="button" data-t="search" title="Find a place" aria-label="Find a place">${ico.search}</button>
      <button type="button" data-t="full" title="Full screen" aria-label="Full screen map">${ico.full}</button>`;
    box.onclick = e => { const b = e.target.closest('button'); if(!b) return; const t = b.dataset.t;
      if(t==='rect'||t==='poly') startDraw(t);
      else if(t==='search') toggleSearch();
      else if(t==='full'){ el.classList.toggle('rr-full'); document.body.classList.toggle('rr-noscroll', el.classList.contains('rr-full')); b.classList.toggle('on'); setTimeout(()=>map.invalidateSize(), 60); } };
    return box; }});
  new Tools().addTo(map);
  addEventListener('keydown', e => { if(e.key==='Escape' && el.classList.contains('rr-full')){ el.classList.remove('rr-full'); document.body.classList.remove('rr-noscroll'); setTimeout(()=>map.invalidateSize(), 60); } });

  /* ---------- layer list + legend ---------- */
  const bases = opts.bases || {}, reference = opts.reference || {};
  let baseOn = Object.keys(bases).find(k => map.hasLayer(bases[k])) || Object.keys(bases)[0];
  const panel = stop(L.DomUtil.create('div','rr-layers', el));
  const lbtn = stop(L.DomUtil.create('button','rr-lbtn', el)); lbtn.type='button'; lbtn.innerHTML = ico.layers+'<span>Layers &amp; legend</span>'; lbtn.setAttribute('aria-expanded','false');
  panel.hidden = true;
  lbtn.onclick = () => { panel.hidden = !panel.hidden; lbtn.setAttribute('aria-expanded', String(!panel.hidden)); if(!panel.hidden) renderPanel(); };
  const zcount = t => RR.store.all('zones').filter(z => z.type===t && z.coords && z.coords.length>2).length;
  function renderPanel(){
    if(panel.hidden) return;
    const row = (key, label, on, sw, extra='') => `<label class="rr-row"><input type="checkbox" data-k="${esc(key)}" ${on?'checked':''}>${sw}<span>${label}${extra}</span></label>`;
    const crisis = RR.EMS.map(g => { const n = zcount(g.t); return n||g.t!=='info' ? row('z:'+g.t, esc(g.label), !map.rrHidden.has(g.t), `<i class="zl zn-${g.t}"></i>`, ` <em>${n}</em>`) : ''; }).join('');
    const page = map.rrLayers.map((l,i) => row('p:'+i, esc(l.label), map.hasLayer(l.layer), l.swatch||'<i class="rr-dot"></i>')).join('');
    const aois = loadAois();
    const ref = Object.keys(reference).map(k => row('r:'+k, esc(k), map.hasLayer(reference[k]), k==='District boundary'?'<i class="zl rr-dist"></i>':'<i class="zl rr-ref"></i>')).join('');
    const op = el.style.getPropertyValue('--zop') || '';
    panel.innerHTML = `<div class="rr-lh"><b>Layers and legend</b><button type="button" class="rr-x" aria-label="Close">×</button></div>
      ${Object.keys(bases).length ? `<div class="rr-sec">Base map</div><div class="rr-bases">${Object.keys(bases).map(k => `<label><input type="radio" name="rrb${maps.indexOf(map)}" data-b="${esc(k)}" ${k===baseOn?'checked':''}>${esc(k)}</label>`).join('')}</div>`:''}
      <div class="rr-sec">Crisis information</div>${crisis}
      <label class="rr-op">Zone fill <input type="range" min="0" max="70" value="${op?Math.round(parseFloat(op)*100):22}" data-op></label>
      ${page ? `<div class="rr-sec">Operations</div>${page}`:''}
      <div class="rr-sec">Areas of interest</div>${row('aoi', 'Selected areas', map.hasLayer(aoiLay), '<i class="zl rr-aoi"></i>', ` <em>${aois.length}</em>`)}
      ${aois.length ? `<div class="rr-aoilist">${aois.map(a => `<button type="button" data-open="${esc(a.id)}">${esc(a.name)}</button>`).join('')}</div>` : '<p class="rr-note">Use the rectangle or polygon tool, or search a place, to select an area.</p>'}
      ${ref ? `<div class="rr-sec">Reference</div>${ref}`:''}
      <p class="rr-note">Situation as of ${RR.clock(Date.now())}. Zones: field reports and the August 2019 Kabini flood news reports (illustrative extent). Boundary: Census of India 2011.</p>`;
  }
  panel.addEventListener('change', e => { const t = e.target;
    if(t.dataset.b){ Object.values(bases).forEach(l => map.removeLayer(l)); bases[t.dataset.b].addTo(map); baseOn = t.dataset.b; return; }
    const k = t.dataset.k; if(!k) return;
    if(k.startsWith('z:')){ const ty = k.slice(2); t.checked ? map.rrHidden.delete(ty) : map.rrHidden.add(ty); RR.drawZones(map, map.rrZonePopup); }
    else if(k.startsWith('p:')){ const l = map.rrLayers[+k.slice(2)].layer; t.checked ? l.addTo(map) : map.removeLayer(l); }
    else if(k.startsWith('r:')){ const l = reference[k.slice(2)]; t.checked ? l.addTo(map) : map.removeLayer(l); }
    else if(k==='aoi'){ t.checked ? aoiLay.addTo(map) : map.removeLayer(aoiLay); }
  });
  panel.addEventListener('input', e => { if(e.target.dataset.op!==undefined) el.style.setProperty('--zop', (e.target.value/100).toFixed(2)); });
  panel.addEventListener('click', e => { if(e.target.closest('.rr-x')){ panel.hidden = true; lbtn.setAttribute('aria-expanded','false'); }
    const o = e.target.closest('[data-open]'); if(o){ const a = loadAois().find(x => x.id===o.dataset.open); if(a){ map.fitBounds(L.polygon(a.coords).getBounds(), {padding:[30,30]}); showAoi(a.id); } } });
  map.rrRenderPanel = renderPanel;
  RR.store.on && RR.store.on(() => renderPanel());

  /* ---------- AOI layer ---------- */
  const aoiLay = L.layerGroup().addTo(map);
  map.rrDrawAois = () => { aoiLay.clearLayers();
    loadAois().forEach(a => { const p = L.polygon(a.coords, {className:'rr-aoipoly'+(a.id===openId?' on':''), weight:2.2, fillOpacity:.06});
      p.bindTooltip(esc(a.name), {permanent:true, direction:'center', className:'rr-aoitip'});
      p.on('click', ev => { if(map.rrBusy) return; L.DomEvent.stop(ev); showAoi(a.id); }); p.addTo(aoiLay); });
    renderPanel(); if(openId) showAoi(openId, true); };

  /* ---------- drawing ---------- */
  let drawing = null;
  const hint = stop(L.DomUtil.create('div','rr-hint', el)); hint.hidden = true;
  function startDraw(mode){
    endDraw(); map.closePopup(); map.rrBusy = true; el.classList.add('rr-drawing'); map.doubleClickZoom.disable();
    drawing = {mode, pts:[], g:L.layerGroup().addTo(map), cur:null};
    hint.hidden = false; setHint();
  }
  function setHint(){ if(!drawing) return; const n = drawing.pts.length;
    hint.innerHTML = (drawing.mode==='rect' ? (n ? 'Click the opposite corner' : 'Click one corner of the area')
      : (n<3 ? `Click to add corners (${n})` : `Click the first corner or press Finish (${n} corners)`))
      + (drawing.mode==='poly' && n>=3 ? ' <button type="button" data-h="finish">Finish</button>':'')
      + (drawing.mode==='poly' && n ? ' <button type="button" data-h="undo">Undo</button>':'')
      + ' <button type="button" data-h="cancel">Cancel</button>'; }
  hint.onclick = e => { const h = e.target.dataset && e.target.dataset.h; if(!h) return;
    if(h==='cancel') endDraw(); else if(h==='undo'){ drawing.pts.pop(); paint(); setHint(); } else if(h==='finish') finish(); };
  function endDraw(){ if(!drawing) return; drawing.g.remove(); drawing = null; hint.hidden = true; el.classList.remove('rr-drawing'); map.doubleClickZoom.enable(); setTimeout(()=>{ map.rrBusy = false; }, 0); }
  const rectOf = (a,b) => [[a[0],a[1]],[a[0],b[1]],[b[0],b[1]],[b[0],a[1]]];
  function paint(){ const d = drawing; d.g.clearLayers();
    const pts = d.cur ? d.pts.concat([d.cur]) : d.pts;
    if(d.mode==='rect' && d.pts.length===1 && d.cur) L.polygon(rectOf(d.pts[0], d.cur), {className:'rr-aoipoly drawing', weight:2, fillOpacity:.08, interactive:false}).addTo(d.g);
    if(d.mode==='poly' && pts.length>1) L.polyline(pts, {className:'rr-aoiline', weight:2, dashArray:'5 4', interactive:false}).addTo(d.g);
    d.pts.forEach((p,i) => L.circleMarker(p, {radius:i===0&&d.mode==='poly'&&d.pts.length>=3?7:4.5, className:'rr-vtx', fillOpacity:1, weight:2, interactive:false}).addTo(d.g)); }
  map.on('mousemove', e => { if(!drawing || !drawing.pts.length) return; drawing.cur = [e.latlng.lat, e.latlng.lng]; paint(); });
  map.on('click', e => { if(!drawing) return; const d = drawing, ll = [+e.latlng.lat.toFixed(5), +e.latlng.lng.toFixed(5)];
    if(d.mode==='rect'){ d.pts.push(ll); if(d.pts.length===2){ const c = rectOf(d.pts[0], d.pts[1]); if(RR.areaKm2(c) < 0.0005){ d.pts.pop(); return; } return finish(c); } }
    else { if(d.pts.length>=3){ const p0 = map.latLngToContainerPoint(d.pts[0]); if(p0.distanceTo(e.containerPoint) < 14) return finish(); } d.pts.push(ll); }
    d.cur = null; paint(); setHint(); });
  map.on('dblclick', () => { if(drawing && drawing.mode==='poly' && drawing.pts.length>=3) finish(); });
  function finish(coords){ const d = drawing; if(!d) return; coords = coords || d.pts.slice(); if(coords.length<3){ RR.toast('Add at least 3 corners.'); return; }
    endDraw(); addAoi(coords); }
  function addAoi(coords, name){
    const list = loadAois(); const num = list.reduce((m,a) => Math.max(m, +(String(a.name).match(/^AOI (\d+)$/)||[])[1]||0), 0) + 1;
    const a = {id:'aoi-'+Date.now().toString(36), name:name || 'AOI '+String(num).padStart(2,'0'), coords, createdAt:Date.now()};
    list.push(a); openId = a.id; saveAois(list); if(!map.hasLayer(aoiLay)) aoiLay.addTo(map);
    map.fitBounds(L.polygon(coords).getBounds(), {padding:[40,40], maxZoom:15}); }

  /* ---------- AOI analysis card ---------- */
  let openId = null;
  const card = stop(L.DomUtil.create('div','rr-aoi', el)); card.hidden = true;
  function showAoi(id, quiet){
    const a = loadAois().find(x => x.id===id); if(!a){ card.hidden = true; openId = null; return; }
    if(openId!==id){ openId = id; map.rrDrawAois(); return; }
    const s = RR.aoiStats(a.coords);
    const bar = g => `<div class="rr-g"><i class="zl zn-${g.t}"></i><span>${esc(g.label)}</span><b class="num">${fmtA(g.km2)}</b><em class="num">${g.pct<1?'<1':g.pct.toFixed(0)}%</em><div class="rr-gb"><i class="zn-${g.t}" style="width:${Math.max(2,g.pct).toFixed(1)}%"></i></div></div>`;
    const acts = (opts.aoiActions||[]).map((x,i) => `<button type="button" class="rr-b${i===0?' pri':''}" data-x="${i}">${esc(x.label)}</button>`).join('');
    card.innerHTML = `<div class="rr-ah"><input class="rr-name" value="${esc(a.name)}" aria-label="Area name"><button type="button" class="rr-x" data-a="close" aria-label="Close">×</button></div>
      <div class="rr-meta num">${fmtA(s.area)} · centre ${s.centre.lat.toFixed(4)}, ${s.centre.lon.toFixed(4)}${RR.DISTRICT ? ` · ${s.inDistrict>.99?'inside':s.inDistrict>.01?Math.round(s.inDistrict*100)+'% inside':'outside'} ${esc((RR.DISTRICT.name||'the district').split(',')[0].replace(/ district$/i,''))} district`:''}</div>
      <div class="rr-kp"><div><b class="num${s.sos.length?' bad':''}">${s.sos.length}</b><span>open SOS${s.critical?` · ${s.critical} critical`:''}</span></div>
        <div><b class="num">${n0(s.people)}</b><span>people waiting</span></div>
        <div><b class="num${s.hazards.length?' warn':''}">${s.hazards.length}</b><span>road hazards</span></div>
        <div><b class="num">${s.vehicles.length}</b><span>vehicles inside</span></div></div>
      <div class="rr-sec">Impact grading in this area</div>
      ${s.graded.length ? s.graded.map(bar).join('') : '<p class="rr-note">No mapped impact zones inside this area.</p>'}
      ${s.people ? `<div class="rr-sec">Vulnerable people</div><p class="rr-line num">${s.infants} infants · ${s.elderly} elderly · ${s.injured} injured</p>
      <div class="rr-sec">Daily needs (Sphere minimum)</div><p class="rr-line num">${n0(s.needs.water)} L water · ${n0(s.needs.food)} food rations · ${n0(s.needs.hygiene)} hygiene kits · ${n0(s.needs.shelter)} tarpaulins</p>`:''}
      ${s.hazards.length ? `<div class="rr-sec">Road hazards</div><p class="rr-line">${s.hazards.map(h => esc((RR.HAZ[h.type]||{}).label||h.type)).join(' · ')}</p>`:''}
      <div class="rr-sec">Vehicles</div><p class="rr-line">${s.vehicles.length ? s.vehicles.map(v=>esc(v.name+' ('+(RR.VEH_LABEL[v.type]||v.type)+')')).join(', ') : 'None inside.'}${s.nearest ? ` Nearest outside: ${esc(s.nearest.d.name)}, ${RR.km(s.nearest.m)} from the centre.`:''}</p>
      ${s.stops.length ? `<p class="rr-line">${s.stops.length} pending delivery stop${s.stops.length>1?'s':''} inside.</p>`:''}
      ${opts.saveZone ? `<div class="rr-sec">Publish as impact zone</div><div class="rr-save"><select data-zt aria-label="Zone type">${RR.EMS.map(g=>`<option value="${g.t}">${esc(g.label)}</option>`).join('')}</select><button type="button" class="rr-b pri" data-a="zone">Save zone</button></div>`:''}
      <div class="rr-acts">${acts}<button type="button" class="rr-b" data-a="zoom">Zoom to</button><button type="button" class="rr-b" data-a="geo">Export GeoJSON</button><button type="button" class="rr-b danger" data-a="del">Delete</button></div>`;
    card.hidden = false; card._stats = s; card._aoi = a;
    if(!quiet) card.scrollTop = 0;
  }
  card.addEventListener('change', e => { if(e.target.classList.contains('rr-name')){ const list = loadAois(), a = list.find(x => x.id===openId); if(a){ a.name = e.target.value.trim() || a.name; saveAois(list); } } });
  card.addEventListener('click', e => { const b = e.target.closest('button'); if(!b) return; const a = card._aoi; if(!a) return;
    if(b.dataset.x!==undefined){ const x = opts.aoiActions[+b.dataset.x]; x && x.run(a, card._stats, map); return; }
    const act = b.dataset.a;
    if(act==='close'){ card.hidden = true; openId = null; map.rrDrawAois(); }
    else if(act==='zoom') map.fitBounds(L.polygon(a.coords).getBounds(), {padding:[30,30]});
    else if(act==='del'){ saveAois(loadAois().filter(x => x.id!==a.id)); card.hidden = true; openId = null; }
    else if(act==='geo'){ const s = card._stats, ring = a.coords.map(p => [p[1], p[0]]); ring.push(ring[0]);
      const gj = {type:'FeatureCollection', features:[{type:'Feature', properties:{name:a.name, area_km2:+s.area.toFixed(3), open_sos:s.sos.length, people_waiting:s.people, infants:s.infants, elderly:s.elderly, injured:s.injured, road_hazards:s.hazards.length,
        graded:Object.fromEntries(s.graded.map(g => [g.label, {km2:+g.km2.toFixed(3), pct:+g.pct.toFixed(1)}])), water_l_per_day:s.needs.water, generated:new Date().toISOString(), source:'ReliefReady'}, geometry:{type:'Polygon', coordinates:[ring]}}]};
      const url = URL.createObjectURL(new Blob([JSON.stringify(gj, null, 1)], {type:'application/geo+json'}));
      const l = document.createElement('a'); l.href = url; l.download = a.name.replace(/[^\w-]+/g,'_')+'.geojson'; document.body.appendChild(l); l.click(); l.remove(); setTimeout(()=>URL.revokeObjectURL(url), 2000); }
    else if(act==='zone'){ const t = card.querySelector('[data-zt]').value, who = (RR.session && RR.session()) || {};
      RR.store.put('zones', {name:a.name, type:t, coords:a.coords, official:false, source:'Area of interest marked in the control room on '+new Date().toLocaleString('en-IN'), createdAt:Date.now(), by:who.id||'admin'});
      RR.toast('Saved as an impact zone. SOS priority and route checks now use it.'); }
  });
  RR.store.on && RR.store.on(() => { if(openId && !card.hidden) showAoi(openId, true); });

  /* ---------- place search (OpenStreetMap Nominatim) ---------- */
  const sbox = stop(L.DomUtil.create('div','rr-search', el)); sbox.hidden = true;
  sbox.innerHTML = `<form><input type="search" placeholder="Village, town or taluk" aria-label="Find a place"><button type="submit" class="rr-b pri">Find</button></form><div class="rr-res"></div>`;
  function toggleSearch(){ sbox.hidden = !sbox.hidden; if(!sbox.hidden) sbox.querySelector('input').focus(); }
  let results = [];
  sbox.querySelector('form').onsubmit = async e => { e.preventDefault(); const q = sbox.querySelector('input').value.trim(); if(!q) return;
    const out = sbox.querySelector('.rr-res'); out.innerHTML = '<p class="rr-note">Searching…</p>';
    const vb = map.rrDistrictBounds ? map.rrDistrictBounds.pad(.3) : map.getBounds();
    try{
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&polygon_geojson=1&polygon_threshold=0.0005&limit=6&countrycodes=in&accept-language=en'
        +'&viewbox='+[vb.getWest(),vb.getNorth(),vb.getEast(),vb.getSouth()].map(v=>v.toFixed(3)).join(',')+'&q='+encodeURIComponent(q), {headers:{'Accept':'application/json'}});
      results = await r.json();
      out.innerHTML = results.length ? results.map((x,i) => { const area = x.geojson && /Polygon/.test(x.geojson.type);
        return `<div class="rr-r"><button type="button" data-go="${i}"><b>${esc(x.name || x.display_name.split(',')[0])}</b><span>${esc(x.display_name.split(',').slice(1,4).join(','))}</span></button>${area?`<button type="button" class="rr-b" data-sel="${i}" title="Use this boundary as an area of interest">Select area</button>`:`<button type="button" class="rr-b" data-box="${i}" title="Select a 2 km box around this place">Select 2 km box</button>`}</div>`; }).join('')
        : '<p class="rr-note">No place found. Try another spelling.</p>';
    }catch(err){ out.innerHTML = '<p class="rr-note">Place search needs an internet connection.</p>'; }
  };
  sbox.querySelector('.rr-res').onclick = e => { const b = e.target.closest('button'); if(!b) return;
    const x = results[+(b.dataset.go ?? b.dataset.sel ?? b.dataset.box)]; if(!x) return;
    const name = x.name || x.display_name.split(',')[0];
    if(b.dataset.go!==undefined){ const bb = x.boundingbox.map(Number); map.fitBounds([[bb[0],bb[2]],[bb[1],bb[3]]], {maxZoom:15}); }
    else if(b.dataset.sel!==undefined){ let rings = x.geojson.type==='Polygon' ? [x.geojson.coordinates[0]] : x.geojson.coordinates.map(p => p[0]);
      let ring = rings.sort((a,b)=>b.length-a.length)[0]; const step = Math.max(1, Math.ceil(ring.length/400));
      ring = ring.filter((_,i) => i%step===0).map(p => [+p[1].toFixed(5), +p[0].toFixed(5)]); addAoi(ring, name); }
    else { const la = +x.lat, lo = +x.lon, dla = 1/111, dlo = 1/(111*Math.cos(la*rad)); addAoi([[la-dla,lo-dlo],[la-dla,lo+dlo],[la+dla,lo+dlo],[la+dla,lo-dlo]].map(p=>[+p[0].toFixed(5),+p[1].toFixed(5)]), name+' (2 km)'); }
    sbox.hidden = true; };

  map.rrDrawAois();
  return map;
};

/* Register a page's own layer (SOS, vehicles, plan…) in the layer list. */
RR.addMapLayer = (map, label, layer, swatch) => { map.rrLayers = map.rrLayers || []; map.rrLayers.push({label, layer, swatch}); map.rrRenderPanel && map.rrRenderPanel(); };
})();
