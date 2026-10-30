/* ReliefReady shared layer: config, seed data, store, sign-in, SOS code, map + safe routing. */
(function(){
'use strict';
const RR = window.RR = {};

/* ---------- Config ---------- */
RR.CONFIG = {
  district: 'Wayanad, Kerala',
  smsGateway: '+919000000000',          // replace with your SMS gateway long-code before deployment
  controlRoom: '1077',                  // district emergency operations centre (toll-free in India)
  emergency: '112',
  osrm: 'https://router.project-osrm.org',
  tiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  hazardRadiusM: 350,
};
try{ const c = JSON.parse(localStorage.getItem('rr.config')||'null'); if(c) Object.assign(RR.CONFIG, c); }catch(e){}
RR.saveConfig = patch => { Object.assign(RR.CONFIG, patch); try{ localStorage.setItem('rr.config', JSON.stringify({smsGateway:RR.CONFIG.smsGateway})); }catch(e){} };

/* ---------- Demo accounts (replace with phone OTP / SSO in production) ---------- */
RR.ACCOUNTS = [
  {id:'ADM-01', role:'admin',  name:'District control room', pin:'2026', post:'Kalpetta EOC'},
  {id:'D-101',  role:'driver', name:'Ravi Kumar',  pin:'1234', vehicle:'Truck KL-12 4471', type:'truck', cap:500},
  {id:'D-102',  role:'driver', name:'Anjali Menon',pin:'1234', vehicle:'Pickup KL-12 8810', type:'truck', cap:300},
  {id:'D-103',  role:'driver', name:'Faisal P.',   pin:'1234', vehicle:'4x4 Jeep KL-73 2205', type:'jeep', cap:250},
  {id:'D-104',  role:'driver', name:'Shibu Thomas',pin:'1234', vehicle:'Rescue boat KL-BT 07', type:'boat', cap:400},
];
RR.session = () => { try{ return JSON.parse(localStorage.getItem('rr.session')||'null'); }catch(e){ return null; } };
RR.signIn = (id, pin, role) => {
  const a = RR.ACCOUNTS.find(x => x.id.toLowerCase() === String(id).trim().toLowerCase() && x.pin === String(pin).trim());
  if(!a) return {error:'That ID and PIN do not match a registered account.'};
  if(role && a.role !== role) return {error: role==='admin' ? 'This account is a driver account. Use the driver app.' : 'This is a control-room account. Use the admin console.'};
  const s = {id:a.id, role:a.role, name:a.name, vehicle:a.vehicle||'', type:a.type||'truck', cap:a.cap||0, at:Date.now()};
  try{ localStorage.setItem('rr.session', JSON.stringify(s)); }catch(e){}
  return {session:s};
};
RR.signOut = () => { try{ localStorage.removeItem('rr.session'); }catch(e){} location.reload(); };

/* ---------- Seed: Wayanad, Kerala (real places, illustrative needs) ---------- */
const now = Date.now(), H = 3600e3;
RR.DEPOT = {name:'Kalpetta collection centre', lat:11.6085, lon:76.0830};
RR.seed = () => ({
  sos: {
    'sos-1':{id:'sos-1',code:'',createdAt:now-5.2*H,lat:11.4772,lon:76.1480,place:'Mundakkai, near the estate school',people:42,infants:5,elderly:9,injured:3,needs:['rescue','medical','water'],note:'Bridge to Chooralmala gone. Families on the school terrace.',phone:'',channel:'sms',status:'new'},
    'sos-2':{id:'sos-2',code:'',createdAt:now-3.1*H,lat:11.7392,lon:76.0751,place:'Panamaram, river-side colony',people:60,infants:4,elderly:11,injured:0,needs:['water','food','infant'],note:'Ground floors flooded. Drinking water finished.',phone:'',channel:'app',status:'assigned',assignedTo:'D-102'},
    'sos-3':{id:'sos-3',code:'',createdAt:now-1.4*H,lat:11.5501,lon:76.0412,place:'Vythiri, Lakkidi road',people:18,infants:1,elderly:4,injured:1,needs:['food','medical'],note:'Elderly woman needs insulin.',phone:'',channel:'relay',status:'new'},
  },
  stops: {
    'st-1':{id:'st-1',driverId:'D-101',name:'Meppadi relief camp (GHSS)',lat:11.5548,lon:76.1337,items:{water:300,food:200,infant:6},order:1,status:'pending',note:'Camp register at the school office.',source:'admin'},
    'st-2':{id:'st-2',driverId:'D-101',name:'Chooralmala',lat:11.4880,lon:76.1395,items:{water:150,food:100,infant:4},order:2,status:'pending',note:'Check bridge status before leaving Meppadi.',source:'admin'},
    'st-3':{id:'st-3',driverId:'D-102',name:'Panamaram river-side colony',lat:11.7392,lon:76.0751,items:{water:270,food:180,infant:4},order:1,status:'enroute',note:'From SOS sos-2.',source:'sos',sosId:'sos-2'},
    'st-5':{id:'st-5',driverId:'D-104',name:'Panamaram flooded houses (ward 6)',lat:11.7440,lon:76.0805,items:{water:200,food:120,infant:3},order:1,status:'pending',note:'Road under water. Boat only.',source:'admin'},
    'st-4':{id:'st-4',driverId:'D-103',name:'Vythiri PHC',lat:11.5496,lon:76.0418,items:{water:80,food:60,infant:0},order:1,status:'pending',note:'',source:'admin'},
  },
  reports: {
    'hz-1':{id:'hz-1',lat:11.4905,lon:76.1410,type:'bridge',note:'Chooralmala–Mundakkai bridge washed away. No vehicle crossing.',by:'D-101',createdAt:now-6*H},
    'hz-2':{id:'hz-2',lat:11.7290,lon:76.0790,type:'flooded',note:'Panamaram puzha over the road, ~60 cm water.',by:'D-102',createdAt:now-2*H},
    'hz-3':{id:'hz-3',lat:11.5895,lon:76.1010,type:'landslide',note:'Small slip, one lane open. Slow.',by:'D-103',createdAt:now-4*H},
    'hz-4':{id:'hz-4',lat:11.5800,lon:76.0640,type:'safe',note:'NH 766 Kalpetta–Vythiri clear, police checkpoint.',by:'D-103',createdAt:now-1*H},
  },
  escalations: {
    'esc-1':{id:'esc-1',from:'admin',by:'ADM-01',to:'NDRF',type:'Rescue team',place:'Mundakkai',lat:11.4772,lon:76.1480,people:42,urgency:'Critical',note:'42 people cut off by bridge collapse, 3 injured. Need rope-bridge crossing team.',status:'acknowledged',createdAt:now-4.5*H,timeline:[{t:now-4.5*H,s:'sent',n:'Sent to NDRF 4th Bn control'},{t:now-4*H,s:'acknowledged',n:'Team being mobilised from Kalpetta'}]},
  },
  drivers: {
    'D-101':{id:'D-101',name:'Ravi Kumar',vehicle:'Truck KL-12 4471',type:'truck',lat:11.6085,lon:76.0830,lastSeen:now-20*60e3,status:'loading'},
    'D-102':{id:'D-102',name:'Anjali Menon',vehicle:'Pickup KL-12 8810',type:'truck',lat:11.7010,lon:76.0790,lastSeen:now-6*60e3,status:'on the road'},
    'D-103':{id:'D-103',name:'Faisal P.',vehicle:'4x4 Jeep KL-73 2205',type:'jeep',lat:11.5800,lon:76.0640,lastSeen:now-12*60e3,status:'on the road'},
    'D-104':{id:'D-104',name:'Shibu Thomas',vehicle:'Rescue boat KL-BT 07',type:'boat',lat:11.7330,lon:76.0700,lastSeen:now-9*60e3,status:'on the water'},
  },
});
RR.COLS = ['sos','stops','reports','escalations','drivers'];

/* ---------- Store: browser storage, synced across tabs ---------- */
const KEY = 'rr.data.v2';
const store = RR.store = {data:null, mode:'local', db:null, fns:new Set()};
function loadLocal(){
  try{ const d = JSON.parse(localStorage.getItem(KEY)||'null'); if(d && d.sos) return d; }catch(e){}
  return RR.seed();
}
function saveLocal(){ try{ localStorage.setItem(KEY, JSON.stringify(store.data)); }catch(e){} }
let bc = null; try{ bc = new BroadcastChannel('rr-sync'); }catch(e){}
function emit(local){ store.fns.forEach(f => { try{ f(); }catch(e){ console.error(e); } }); if(local && bc) try{ bc.postMessage('changed'); }catch(e){} }
store.data = loadLocal();
if(bc) bc.onmessage = () => { if(store.mode==='local'){ store.data = loadLocal(); emit(false); } };
window.addEventListener('storage', e => { if(e.key===KEY && store.mode==='local'){ store.data = loadLocal(); emit(false); } });
store.on = fn => { store.fns.add(fn); return () => store.fns.delete(fn); };
store.all = col => Object.values(store.data[col]||{});
store.get = (col,id) => (store.data[col]||{})[id];
const clean = o => JSON.parse(JSON.stringify(o));
store.put = (col, doc) => {
  if(!doc.id) doc.id = col.slice(0,3)+'-'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
  store.data[col] = store.data[col]||{}; store.data[col][doc.id] = clean(doc);
  saveLocal(); emit(true);
  if(store.db) store.db.collection(col).doc(doc.id).set(clean(doc)).catch(err => RR.toast('Not saved to the shared log: '+(err&&err.code||'error')));
  return doc;
};
store.patch = (col, id, patch) => { const d = store.get(col,id); if(!d) return; return store.put(col, Object.assign({}, d, patch)); };
store.del = (col, id) => { if(store.data[col]) delete store.data[col][id]; saveLocal(); emit(true); if(store.db) store.db.collection(col).doc(id).delete().catch(()=>{}); };
store.reset = () => { store.data = RR.seed(); saveLocal(); emit(true); };

/* ---------- Connectivity + offline outbox ---------- */
RR.online = () => navigator.onLine !== false;
RR.netBadge = el => {
  const set = () => { const on = RR.online(); el.textContent = on ? 'Online' : 'Offline'; el.classList.toggle('off', !on); };
  set(); window.addEventListener('online', set); window.addEventListener('offline', set);
};
const OUT = 'rr.outbox';
RR.outbox = {
  all(){ try{ return JSON.parse(localStorage.getItem(OUT)||'[]'); }catch(e){ return []; } },
  add(item){ const a = this.all(); a.push(item); try{ localStorage.setItem(OUT, JSON.stringify(a)); }catch(e){} },
  flush(){
    if(!RR.online()) return 0;
    const a = this.all(); if(!a.length) return 0;
    a.forEach(it => store.put(it.col, it.doc));
    try{ localStorage.setItem(OUT,'[]'); }catch(e){}
    return a.length;
  }
};
window.addEventListener('online', () => { const n = RR.outbox.flush(); if(n) RR.toast(n+' queued message'+(n>1?'s':'')+' sent'); });

/* ---------- SOS short code (fits one SMS, survives copy/paste, Bluetooth share or QR) ---------- */
const NEEDS = RR.NEEDS = [
  {k:'rescue', c:'R', en:'Rescue / evacuation', hi:'बचाव / निकासी'},
  {k:'medical',c:'M', en:'Medical help',        hi:'चिकित्सा सहायता'},
  {k:'water',  c:'W', en:'Drinking water',      hi:'पीने का पानी'},
  {k:'food',   c:'F', en:'Food',                hi:'भोजन'},
  {k:'infant', c:'B', en:'Baby food / infant kit', hi:'शिशु आहार'},
  {k:'shelter',c:'S', en:'Shelter / dry clothes',  hi:'आश्रय / कपड़े'},
];
RR.encodeSOS = s => {
  const t = new Date(s.createdAt||Date.now());
  const ts = String(t.getUTCFullYear()).slice(2)+[t.getUTCMonth()+1,t.getUTCDate(),t.getUTCHours(),t.getUTCMinutes()].map(n=>String(n).padStart(2,'0')).join('');
  const parts = ['RR1', (s.lat!=null? (+s.lat).toFixed(5)+','+(+s.lon).toFixed(5) : '0,0'),
    'P'+(s.people|0),'I'+(s.infants|0),'E'+(s.elderly|0),'J'+(s.injured|0),
    'N'+(s.needs||[]).map(k => (NEEDS.find(n=>n.k===k)||{}).c||'').join(''), 'T'+ts];
  if(s.phone) parts.push('C'+String(s.phone).replace(/\D/g,'').slice(-10));
  let code = parts.join(' ');
  const room = 158 - code.length - 2;
  const txt = [s.place, s.note].filter(Boolean).join('. ').replace(/[\r\n|]+/g,' ').trim();
  if(txt && room > 8) code += ' | ' + txt.slice(0, room);
  return code;
};
RR.decodeSOS = str => {
  const m = String(str||'').match(/RR1\s+(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\s+P(\d+)\s+I(\d+)\s+E(\d+)\s+J(\d+)\s+N([A-Z]*)\s+T(\d{10})(?:\s+C(\d+))?(?:\s*\|\s*([\s\S]*))?/);
  if(!m) return null;
  const ts = m[8]; const d = Date.UTC(2000+ +ts.slice(0,2), +ts.slice(2,4)-1, +ts.slice(4,6), +ts.slice(6,8), +ts.slice(8,10));
  const lat = +m[1], lon = +m[2];
  return {lat: lat||null, lon: lon||null, people:+m[3], infants:+m[4], elderly:+m[5], injured:+m[6],
    needs: m[7].split('').map(c => (NEEDS.find(n=>n.c===c)||{}).k).filter(Boolean),
    createdAt: isNaN(d)?Date.now():d, phone: m[9]||'', place:(m[10]||'').trim(), note:'', code: m[0].trim()};
};
RR.sosPriority = s => { // 0–100, same spirit as the allocation planner
  const n = s.needs||[];
  let u = n.includes('rescue')?1 : n.includes('medical')?.85 : n.includes('water')?.6 : .4;
  if(s.injured>0) u = Math.max(u,.9);
  const people = Math.min(1,(s.people||0)/60), vul = s.people ? Math.min(1,((s.infants||0)+(s.elderly||0)+(s.injured||0))/s.people/.35) : 0;
  const wait = Math.min(1,(Date.now()-(s.createdAt||Date.now()))/(12*H));
  return Math.round(100*(.4*u+.25*people+.2*vul+.15*wait));
};

/* ---------- Helpers ---------- */
RR.esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
RR.ago = t => { const m = Math.max(0, Math.round((Date.now()-t)/60e3)); return m<1?'just now':m<60?m+' min ago':m<1440?Math.round(m/60)+' h ago':Math.round(m/1440)+' d ago'; };
RR.clock = t => new Date(t).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
RR.toast = msg => { let el = document.querySelector('.toast'); if(!el){ el = document.createElement('div'); el.className='toast'; el.setAttribute('role','status'); document.body.appendChild(el); } el.textContent = msg; el.hidden = false; clearTimeout(el._t); el._t = setTimeout(()=> el.hidden = true, 3200); };
RR.dist = (a,b) => { const R=6371e3, r=Math.PI/180, dLat=(b.lat-a.lat)*r, dLon=(b.lon-a.lon)*r; const x=Math.sin(dLat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLon/2)**2; return 2*R*Math.asin(Math.sqrt(x)); };
RR.km = m => (m/1000).toFixed(m<10000?1:0)+' km';
RR.HAZ = {
  bridge:{label:'Bridge down', sev:3, mark:'B'}, landslide:{label:'Landslide', sev:2, mark:'L'},
  flooded:{label:'Flooded road', sev:3, mark:'F'}, blocked:{label:'Blocked (debris / trees)', sev:3, mark:'X'},
  damaged:{label:'Damaged, passable slowly', sev:1, mark:'D'}, safe:{label:'Confirmed safe', sev:0, mark:'✓'},
};
RR.copy = (text, btn) => {
  const done = () => { if(btn){ const o = btn.textContent; btn.textContent='Copied'; setTimeout(()=>btn.textContent=o,1500); } };
  try{ navigator.clipboard.writeText(text).then(done, () => RR.toast('Copy blocked here. Select the text and copy it.')); }catch(e){ RR.toast('Copy blocked here. Select the text and copy it.'); }
};

/* ---------- Map ---------- */
RR.makeMap = (el, opts={}) => {
  const map = L.map(el, {zoomControl:true, attributionControl:true}).setView(opts.center||[11.62,76.09], opts.zoom||11);
  const tiles = L.tileLayer(RR.CONFIG.tiles, {maxZoom:18, attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
  let fails = 0, loaded = 0;
  const note = document.createElement('div'); note.className='mapnote'; note.hidden = true; el.appendChild(note);
  tiles.on('tileload', () => { loaded++; note.hidden = true; });
  tiles.on('tileerror', () => { if(++fails>3 && !loaded){ note.hidden=false; note.textContent='Street map tiles could not load here (offline or blocked). Positions are real GPS coordinates; the street map appears when the page is online on the deployed site.'; } });
  setTimeout(() => map.invalidateSize(), 50);
  return map;
};
RR.icon = (cls, html='') => L.divIcon({className:'', html:`<div class="${cls}">${html}</div>`, iconSize:[22,22], iconAnchor:[11,11], popupAnchor:[0,-12]});
/* Vehicle markers: truck, jeep, boat */
const VEH_SVG = {
  truck:'<path d="M2 6h11v9H2zM13 9h4l3 3v3h-7z" fill="currentColor"/><circle cx="6" cy="16.5" r="2" fill="currentColor" stroke="var(--surface)" stroke-width="1.2"/><circle cx="16" cy="16.5" r="2" fill="currentColor" stroke="var(--surface)" stroke-width="1.2"/>',
  jeep:'<path d="M3 10l2-4h9l3 4h3v5H3z" fill="currentColor"/><circle cx="7" cy="16" r="2.2" fill="currentColor" stroke="var(--surface)" stroke-width="1.2"/><circle cx="16" cy="16" r="2.2" fill="currentColor" stroke="var(--surface)" stroke-width="1.2"/>',
  boat:'<path d="M11 3v9h6zM10 5L5 12h5z" fill="currentColor"/><path d="M2 14h20l-3 4H5z" fill="currentColor"/><path d="M2 20.5c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1" fill="none" stroke="currentColor" stroke-width="1.3"/>',
};
RR.VEH_LABEL = {truck:'Truck', jeep:'4x4 jeep', boat:'Rescue boat'};
RR.vehSvg = t => `<svg viewBox="0 0 22 22" aria-hidden="true">${VEH_SVG[t]||VEH_SVG.truck}</svg>`;
RR.vehIcon = (type, label, mine) => L.divIcon({className:'', iconSize:[34,34], iconAnchor:[17,17], popupAnchor:[0,-18],
  html:`<div class="veh ${type||'truck'}${mine?' mine':''}">${RR.vehSvg(type)}${label?`<span>${RR.esc(label)}</span>`:''}</div>`});
RR.hzIcon = r => L.divIcon({className:'', html:`<div class="hz ${r.type==='safe'?'safe':''}"><span>${RR.HAZ[r.type]?.mark||'!'}</span></div>`, iconSize:[22,22], iconAnchor:[11,11], popupAnchor:[0,-12]});

/* Safe routing: OSRM alternatives, each scored against live hazard reports. */
function nearLine(coords, p, radius){
  // coords: [[lat,lon],...]; returns min distance (m) from point p to polyline
  let best = Infinity;
  const toXY = (lat,lon) => [lon*111320*Math.cos(p.lat*Math.PI/180), lat*110540];
  const P = toXY(p.lat,p.lon);
  for(let i=1;i<coords.length;i++){
    const A = toXY(coords[i-1][0],coords[i-1][1]), B = toXY(coords[i][0],coords[i][1]);
    const dx=B[0]-A[0], dy=B[1]-A[1], L2=dx*dx+dy*dy;
    let t = L2 ? ((P[0]-A[0])*dx+(P[1]-A[1])*dy)/L2 : 0; t = Math.max(0,Math.min(1,t));
    const d = Math.hypot(P[0]-(A[0]+t*dx), P[1]-(A[1]+t*dy)); if(d<best) best=d;
    if(best<radius*0.2) break;
  }
  return best;
}
RR.assessRoute = (coords, hazards) => {
  const hits = hazards.filter(h => h.type!=='safe' && nearLine(coords, h, RR.CONFIG.hazardRadiusM) <= RR.CONFIG.hazardRadiusM);
  const sev = hits.reduce((s,h)=>Math.max(s, RR.HAZ[h.type]?.sev||2), 0);
  const confirmed = hazards.filter(h => h.type==='safe' && nearLine(coords, h, 400) <= 400).length;
  return {hits, sev, confirmed, verdict: sev>=3?'unsafe':sev>=1?'caution':'safe'};
};
RR.route = async (from, to, hazards) => {
  const straight = () => {
    const coords = [[from.lat,from.lon],[to.lat,to.lon]];
    return [{coords, distance:RR.dist(from,to)*1.35, duration:RR.dist(from,to)*1.35/8.3, estimate:true, ...RR.assessRoute(coords, hazards)}];
  };
  if(!RR.online()) return straight();
  try{
    const ctl = new AbortController(); const t = setTimeout(()=>ctl.abort(), 7000);
    const url = `${RR.CONFIG.osrm}/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?alternatives=3&overview=full&geometries=geojson`;
    const r = await fetch(url, {signal:ctl.signal}); clearTimeout(t);
    const j = await r.json(); if(!j.routes || !j.routes.length) return straight();
    return j.routes.map(rt => { const coords = rt.geometry.coordinates.map(c=>[c[1],c[0]]); return {coords, distance:rt.distance, duration:rt.duration, estimate:false, ...RR.assessRoute(coords, hazards)}; })
      .sort((a,b) => a.sev-b.sev || a.duration-b.duration);
  }catch(e){ return straight(); }
};
RR.verdictPill = v => v==='safe'?'<span class="pill ok">Safe so far</span>':v==='caution'?'<span class="pill warn">Use caution</span>':'<span class="pill bad">Unsafe</span>';

/* ---------- Header / sign-in UI ---------- */
RR.logo = `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="1" y="1" width="38" height="38" rx="6" fill="var(--accent)"/><path d="M9 26c4-3 7-3 11 0s7 3 11 0" fill="none" stroke="var(--accent-ink)" stroke-width="2.5" stroke-linecap="round"/><path d="M20 8v12M14 14h12" stroke="var(--accent-ink)" stroke-width="3" stroke-linecap="round"/></svg>`;
RR.renderSignIn = (root, role, onDone) => {
  const accts = RR.ACCOUNTS.filter(a => a.role===role);
  const title = role==='admin' ? 'Control room sign-in' : 'Driver sign-in';
  root.innerHTML = `<div class="signin"><div class="panel">
    <a class="logo" href="index.html">${RR.logo}<b>ReliefReady</b></a>
    <h1 style="margin-top:18px">${title}</h1>
    <p class="hint">${role==='admin'?'District and relief-agency staff. See requests, assign drivers, escalate to state and national agencies.':'Aid vehicle drivers. See your next stops, safe routes, and report road conditions.'}</p>
    <form id="si" novalidate>
      <div class="field"><label for="si-id">${role==='admin'?'Staff ID':'Driver ID'}</label><input type="text" id="si-id" autocomplete="username" placeholder="${accts[0].id}" required></div>
      <div class="field"><label for="si-pin">PIN</label><input type="password" id="si-pin" inputmode="numeric" autocomplete="current-password" required></div>
      <p class="err" id="si-err" role="alert"></p>
      <button class="btn primary" type="submit">Sign in</button>
    </form>
    <div class="demo"><span class="lbl">Demo accounts (prototype)</span>
      ${accts.map(a=>`<button type="button" class="btn" data-demo="${a.id}"><span class="mono">${a.id}</span> · ${RR.esc(a.name)}${a.vehicle?' · '+RR.esc(a.vehicle):''} <span class="hint" style="margin-left:auto">PIN ${a.pin}</span></button>`).join('')}
    </div>
    <p class="hint" style="margin-top:14px">Prototype sign-in. In deployment this is replaced by phone OTP and role-based access issued by the district.</p>
  </div></div>`;
  const f = root.querySelector('#si');
  f.addEventListener('submit', e => { e.preventDefault(); const r = RR.signIn(f.querySelector('#si-id').value, f.querySelector('#si-pin').value, role); if(r.error){ root.querySelector('#si-err').textContent = r.error; } else onDone(r.session); });
  root.querySelectorAll('[data-demo]').forEach(b => b.addEventListener('click', () => { const a = RR.ACCOUNTS.find(x=>x.id===b.dataset.demo); f.querySelector('#si-id').value=a.id; f.querySelector('#si-pin').value=a.pin; }));
};

/* register service worker on real hosting (enables offline use) */
if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}
})();
