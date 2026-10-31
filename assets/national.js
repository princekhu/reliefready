/* ReliefReady national operations: needs per calamity, matching nearest available workers and vehicles, dispatch and shortfall requests. */
(function(){
if(!window.RR) return;
const TRIPS_PER_DAY = 2;          // a truck or tanker can usually do two round trips a day
const ROAD = 1.35;                // road distance is about 35% longer than straight-line distance
RR.MAX_HOURS = {road:36, air:8};  // units further away than this are not counted; the gap goes to the Centre instead

/* What one incident needs for `days` days, from its calamity playbook. */
RR.incidentNeeds = (inc, days) => {
  const C = RR.CALAMITY[inc.calamity]; if(!C) return {supplies:[], crews:[], kgDay:0};
  days = Math.max(1, days || inc.days || 3);
  const base = {people:+inc.people||0, stranded:+inc.stranded||0, injured:+inc.injured||0};
  const tankerWater = C.crews.some(c => c[0]==='tanker');
  const supplies = C.supplies.map(([k, amt, kind]) => { const qty = Math.ceil(amt*base.people*(kind==='daily'?days:1)); return {k, qty, kind, perDay:kind==='daily'?Math.ceil(amt*base.people):0, kg:qty*RR.SUPPLY[k].kg, byTanker:tankerWater && k==='water'}; });
  const waterDay = supplies.filter(s => s.byTanker).reduce((t,s)=>t+s.perDay, 0);
  const kgDay = supplies.filter(s => !s.byTanker).reduce((t,s)=>t+(s.kind==='daily'?s.perDay*RR.SUPPLY[s.k].kg:s.kg/days), 0);
  const crews = [];
  C.crews.forEach(([type, per, b, min]) => {
    let n;
    if(type==='tanker') n = Math.max(min, Math.ceil(waterDay/(RR.RES.tanker.cap*TRIPS_PER_DAY)));
    else if(type==='truck') return;
    else { const v = base[b]||0; n = v>0 ? Math.max(min, per ? Math.ceil(v/per) : 0) : 0; }
    if(n>0) crews.push({type, n, why: type==='tanker' ? `${RR.fmtN(waterDay)} L of water a day` : `1 per ${RR.fmtN(per)} ${b==='people'?'people affected':b==='stranded'?'people stranded':'injured'}${min>1?', at least '+min:''}`});
  });
  const trucks = kgDay>0 ? Math.max(1, Math.ceil(kgDay/(RR.RES.truck.cap*TRIPS_PER_DAY))) : 0;
  if(trucks) crews.push({type:'truck', n:trucks, why:`${RR.fmtN(Math.round(kgDay))} kg of supplies a day, 2 trips per truck`});
  return {days, supplies, crews, kgDay, waterDay};
};
RR.fmtN = n => Math.round(n).toLocaleString('en-IN');

/* Every unit that can be sent: national resource pools plus the district's own drivers. */
RR.resourcePool = () => {
  const pool = RR.store.all('resources').filter(r => r.status!=='offline' && r.lat!=null);
  RR.store.all('drivers').filter(d => d.lat!=null).forEach(d => pool.push({id:'drv:'+d.id, type:d.type==='boat'?'boat':'truck', name:d.name+' · '+(d.vehicle||RR.VEH_LABEL[d.type]||'vehicle'), lat:d.lat, lon:d.lon, units:1, owner:'District fleet', assigned:{}, driver:true}));
  return pool;
};
const usedElsewhere = (r, incId) => Object.entries(r.assigned||{}).reduce((t,[k,v]) => t + (k===incId?0:(+v||0)), 0);
RR.freeUnits = (r, incId) => Math.max(0, (+r.units||0) - usedElsewhere(r, incId));
RR.travel = (r, inc) => { const km = RR.dist(r, inc)/1000, T = RR.RES[r.type]||{speed:30}; const dkm = T.air ? km : km*ROAD; return {km:dkm, hours:dkm/T.speed}; };
RR.etaText = h => h < 1 ? Math.max(5, Math.round(h*60/5)*5)+' min' : h < 48 ? (h<10?h.toFixed(1):Math.round(h))+' h' : Math.round(h/24)+' days';

/* Nearest-first matching of available units to what the incident needs. */
RR.planIncident = (inc, days) => {
  const need = RR.incidentNeeds(inc, days), pool = RR.resourcePool();
  const rows = need.crews.map(c => {
    const cands = pool.filter(r => r.type===c.type).map(r => ({r, free:RR.freeUnits(r, inc.id), mine:+((r.assigned||{})[inc.id])||0, ...RR.travel(r, inc)}))
      .filter(x => x.free>0 && x.hours <= (RR.RES[c.type].air ? RR.MAX_HOURS.air : RR.MAX_HOURS.road)).sort((a,b) => (b.mine>0)-(a.mine>0) || a.hours-b.hours);
    let left = c.n; const picks = [];
    for(const x of cands){ if(left<=0) break; const u = Math.min(left, x.free); picks.push({...x, units:u}); left -= u; }
    const got = c.n-left;
    return {...c, got, gap:left, picks, eta: picks.length ? Math.max(...picks.map(p=>p.hours)) : null, dispatched: picks.filter(p=>p.mine>0).reduce((t,p)=>t+Math.min(p.units,p.mine),0)};
  });
  const tot = rows.reduce((t,r)=>t+r.n,0), got = rows.reduce((t,r)=>t+r.got,0);
  return {need, rows, coverage: tot ? got/tot : 1, gaps: rows.filter(r=>r.gap>0), firstEta: rows.length && rows.every(r=>r.eta!=null) ? Math.max(...rows.map(r=>r.eta)) : null};
};

/* Mark the planned units as sent to this incident (district drivers are told through their stop list instead). */
RR.dispatchPlan = (inc, plan) => {
  let n = 0;
  plan.rows.forEach(row => row.picks.forEach(p => { if(p.r.driver) return;
    const cur = RR.store.get('resources', p.r.id); if(!cur) return;
    const assigned = Object.assign({}, cur.assigned||{}); assigned[inc.id] = p.units; n += p.units;
    RR.store.patch('resources', cur.id, {assigned, status:'assigned'}); }));
  RR.store.patch('incidents', inc.id, {dispatchedAt:Date.now(), days:plan.need.days});
  return n;
};
RR.releaseIncident = inc => {
  RR.store.all('resources').forEach(r => { if(r.assigned && r.assigned[inc.id]!=null){ const a = Object.assign({}, r.assigned); delete a[inc.id];
    RR.store.patch('resources', r.id, {assigned:a, status:Object.keys(a).length?'assigned':'available'}); } });
};
RR.requestShortfall = (inc, plan) => {
  const S = RR.session()||{}, C = RR.CALAMITY[inc.calamity];
  const list = plan.gaps.map(g => `${g.gap} × ${RR.RES[g.type].label}`).join('; ');
  const doc = {from:'national', by:S.id||'admin', to:'NDMA / MHA National Emergency Response Centre', type:'Additional resources',
    place:`${inc.district}, ${inc.state}`, lat:inc.lat, lon:inc.lon, people:+inc.people||0, urgency:(inc.severity||3)>=4?'Critical':'High',
    note:`${C.label}: ${inc.name}. ${RR.fmtN(inc.people)} people affected${inc.stranded?', '+RR.fmtN(inc.stranded)+' stranded':''}${inc.injured?', '+RR.fmtN(inc.injured)+' injured':''}. Nearest available units are not enough. Still needed: ${list}.`,
    status:'sent', createdAt:Date.now(), incidentId:inc.id, timeline:[{t:Date.now(), s:'sent', n:'Sent from national operations'}]};
  RR.store.put('escalations', doc); return doc;
};

/* District under a point, using the bundled boundaries. */
RR.districtAt = (lat, lon) => {
  const D = window.RR_INDIA; if(!D) return null; const p = {lat, lon};
  const inRing = ring => RR.inPoly(p, ring.map(c => [c[1], c[0]]));
  for(const f of D.districts.features){ const g = f.geometry; const polys = g.type==='Polygon' ? [g.coordinates] : g.coordinates;
    if(polys.some(pl => inRing(pl[0]))) return {district:f.properties.d, state:f.properties.s, feature:f}; }
  return null;
};
RR.districtFeature = (name, state) => { const D = window.RR_INDIA; if(!D) return null; const n = String(name||'').toLowerCase();
  return D.districts.features.find(f => f.properties.d.toLowerCase()===n && (!state || f.properties.s.toLowerCase()===String(state).toLowerCase()))
    || D.districts.features.find(f => f.properties.d.toLowerCase()===n) || null; };

/* Small icons for calamities (24x24 line icons). */
RR.CAL_ICON = {
  flood:'<path d="M3 15c2 0 2-1.5 4.5-1.5S9.5 15 12 15s2.5-1.5 4.5-1.5S19 15 21 15M3 19c2 0 2-1.5 4.5-1.5S9.5 19 12 19s2.5-1.5 4.5-1.5S19 19 21 19M6 11V6l6-3 6 3v5"/>',
  cyclone:'<path d="M20 7c-4-3-11-2-13 3s3 9 7 7 3-7-1-7M4 17c4 3 11 2 13-3"/>',
  earthquake:'<path d="M2 12h4l2-6 3 12 3-9 2 3h6"/>',
  landslide:'<path d="M3 20h18L13 6l-3 5-2-2z"/><circle cx="16" cy="16" r="1.4"/><circle cx="12" cy="17" r="1"/>',
  drought:'<circle cx="12" cy="8" r="3.5"/><path d="M12 1.5v2M5.5 8h-2M20.5 8h-2M4 21l3-5 3 3 4-6 3 3 3-4"/>',
  heatwave:'<path d="M12 3v11"/><circle cx="12" cy="17" r="3.5"/><path d="M15.5 6h3M15.5 9h3"/>',
  fire:'<path d="M12 21c4 0 7-2.6 7-6.5 0-4.5-4-6-4-10.5-3 2-4 4.5-4 7-1.5-1-2-2.5-2-4C6.5 9 5 11.5 5 14.5 5 18.4 8 21 12 21z"/>',
  coldwave:'<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 4l3 2 3-2M9 20l3-2 3 2"/>',
};
RR.calIcon = (k, size=18) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${RR.CAL_ICON[k]||''}</svg>`;
})();
