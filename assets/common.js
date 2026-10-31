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
  wms: [],          // government WMS overlays added in Settings, e.g. Bhuvan flood hazard
  gibsDate: '',     // NASA daily satellite date (YYYY-MM-DD); empty = yesterday
};
try{ const c = JSON.parse(localStorage.getItem('rr.config')||'null'); if(c) Object.assign(RR.CONFIG, c); }catch(e){}
RR.CONFIG.api = (() => { try{ const v = localStorage.getItem('rr.api'); if(v!==null) return v; }catch(e){} return (window.RR_API_URL||''); })().replace(/\/+$/,'');
RR.setApi = url => { try{ localStorage.setItem('rr.api', (url||'').trim()); }catch(e){} };
RR.saveConfig = patch => { Object.assign(RR.CONFIG, patch); try{ localStorage.setItem('rr.config', JSON.stringify({smsGateway:RR.CONFIG.smsGateway, wms:RR.CONFIG.wms, gibsDate:RR.CONFIG.gibsDate})); }catch(e){} };

/* ---------- Demo accounts (replace with phone OTP / SSO in production) ---------- */
RR.ACCOUNTS = [
  {id:'ADM-01', role:'admin',  name:'District control room', pin:'2026', post:'Kalpetta EOC'},
  {id:'D-101',  role:'driver', name:'Ravi Kumar',  pin:'1234', vehicle:'Truck KL-12 4471', type:'truck', cap:500},
  {id:'D-102',  role:'driver', name:'Anjali Menon',pin:'1234', vehicle:'Pickup KL-12 8810', type:'truck', cap:300},
  {id:'D-103',  role:'driver', name:'Faisal P.',   pin:'1234', vehicle:'4x4 Jeep KL-73 2205', type:'jeep', cap:250},
  {id:'D-104',  role:'driver', name:'Shibu Thomas',pin:'1234', vehicle:'Rescue boat KL-BT 07', type:'boat', cap:400},
];
RR.session = () => { try{ return JSON.parse(localStorage.getItem('rr.session')||'null'); }catch(e){ return null; } };
RR.signIn = async (id, pin, role) => {
  let s;
  if(RR.CONFIG.api){
    let r;
    try{ r = await fetch(RR.CONFIG.api+'/api/auth/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id, pin})}); }
    catch(e){ return {error:'Cannot reach the ReliefReady server. Check your connection and try again.'}; }
    const j = await r.json().catch(()=>({}));
    if(!r.ok) return {error: j.detail || 'Sign-in failed.'};
    const u = j.user; s = {id:u.id, role:u.role, name:u.name, vehicle:u.vehicle||'', type:u.type||'truck', token:j.token, at:Date.now()};
  } else {
    const a = RR.ACCOUNTS.find(x => x.id.toLowerCase() === String(id).trim().toLowerCase() && x.pin === String(pin).trim());
    if(!a) return {error:'That ID and PIN do not match a registered account.'};
    s = {id:a.id, role:a.role, name:a.name, vehicle:a.vehicle||'', type:a.type||'truck', cap:a.cap||0, at:Date.now()};
  }
  if(role && s.role !== role) return {error: role==='admin' ? 'This is a driver account. Use the driver app.' : 'This is a control-room account. Use the control room.'};
  try{ localStorage.setItem('rr.session', JSON.stringify(s)); }catch(e){}
  store.startSync && store.startSync();
  return {session:s};
};
RR.signOut = () => { try{ localStorage.removeItem('rr.session'); }catch(e){} location.reload(); };

/* ---------- Seed: Wayanad, Kerala (real places, illustrative needs) ---------- */
const now = Date.now(), H = 3600e3;
/* Impact zones. Sources are stated on every zone so nobody mistakes a demo zone for official data. */
function bufferLine(pts, widths){ // pts [[lat,lon]], widths in metres per point -> polygon
  const L = [], R = [];
  for(let i=0;i<pts.length;i++){
    const a = pts[Math.max(0,i-1)], b = pts[Math.min(pts.length-1,i+1)];
    const kx = 111320*Math.cos(pts[i][0]*Math.PI/180), ky = 110540;
    let dx = (b[1]-a[1])*kx, dy = (b[0]-a[0])*ky; const n = Math.hypot(dx,dy)||1; dx/=n; dy/=n;
    const w = widths[i];
    L.push([pts[i][0] + dx*w/ky, pts[i][1] - dy*w/kx]); R.push([pts[i][0] - dx*w/ky, pts[i][1] + dy*w/kx]);
  }
  return L.concat(R.reverse()).map(p=>[+p[0].toFixed(5), +p[1].toFixed(5)]);
}
RR.seedZones = () => {
  const t = Date.now();
  return {
    'zn-1':{id:'zn-1',name:'Debris-flow corridor, 30 Jul 2024',type:'landslide',official:false,createdAt:t,by:'ADM-01',
      coords:bufferLine([[11.46544,76.13576],[11.4720,76.1420],[11.4790,76.1480],[11.4855,76.1525],[11.4910,76.1560],[11.4960,76.1595]],[140,170,200,230,260,260]),
      source:'Approximate corridor drawn from ISRO-reported headscarp (11.46544, 76.13576), 8 km runout, and the NRSC/ISRO Charter 1029 map. Not an official boundary.',
      sourceUrl:'https://bhuvan-app1.nrsc.gov.in/disaster/usrtasks/landslide/doc/Charter_1029_VAP_7_6Aug2024.pdf'},
    'zn-2':{id:'zn-2',name:'NRSC/ISRO mapped area (Charter 1029)',type:'info',official:true,createdAt:t,by:'ADM-01',
      coords:[[11.48333,76.15],[11.5,76.15],[11.5,76.1625],[11.48333,76.1625]],
      source:'Map frame of the NRSC/ISRO rapid-mapping product “Landslide occurred in Chooralmala town, Wayanad” (6 Aug 2024): 11°29′–11°30′N, 76°9′–76°9′45″E.',
      sourceUrl:'https://bhuvan-app1.nrsc.gov.in/disaster/usrtasks/landslide/doc/Charter_1029_VAP_7_6Aug2024.pdf'},
    'zn-3':{id:'zn-3',name:'Mundakkai–Punchirimattom no-entry',type:'red',official:false,createdAt:t,by:'ADM-01',
      coords:[[11.4610,76.1300],[11.4700,76.1290],[11.4800,76.1440],[11.4880,76.1500],[11.4870,76.1560],[11.4780,76.1530],[11.4660,76.1420]],
      source:'Demo zone drawn by the control room (illustrative).'},
    'zn-4':{id:'zn-4',name:'Panamaram river-side flooding',type:'flooded',official:false,createdAt:t,by:'ADM-01',
      coords:[[11.7250,76.0700],[11.7330,76.0680],[11.7420,76.0720],[11.7470,76.0820],[11.7400,76.0860],[11.7300,76.0830]],
      source:'Demo zone drawn from driver reports (illustrative).'},
    'zn-5':{id:'zn-5',name:'Meppadi relief camp area',type:'relief',official:false,createdAt:t,by:'ADM-01',
      coords:[[11.5520,76.1310],[11.5575,76.1310],[11.5575,76.1365],[11.5520,76.1365]],
      source:'Demo zone (illustrative).'},
  };
};
RR.DEPOT = {name:'Kalpetta collection centre', lat:11.6085, lon:76.0830};
RR.seed = () => ({
  sos: {
    'sos-1':{id:'sos-1',code:'',createdAt:now-5.2*H,lat:11.4855,lon:76.1525,place:'Mundakkai, near the estate school',people:42,infants:5,elderly:9,injured:3,needs:['rescue','medical','water'],note:'Bridge to Chooralmala gone. Families on the school terrace.',phone:'',channel:'sms',status:'new'},
    'sos-2':{id:'sos-2',code:'',createdAt:now-3.1*H,lat:11.7392,lon:76.0751,place:'Panamaram, river-side colony',people:60,infants:4,elderly:11,injured:0,needs:['water','food','infant'],note:'Ground floors flooded. Drinking water finished.',phone:'',channel:'app',status:'assigned',assignedTo:'D-102'},
    'sos-3':{id:'sos-3',code:'',createdAt:now-1.4*H,lat:11.5501,lon:76.0412,place:'Vythiri, Lakkidi road',people:18,infants:1,elderly:4,injured:1,needs:['food','medical'],note:'Elderly woman needs insulin.',phone:'',channel:'relay',status:'new'},
  },
  stops: {
    'st-1':{id:'st-1',driverId:'D-101',name:'Meppadi relief camp (GHSS)',lat:11.5548,lon:76.1337,items:{water:300,food:200,infant:6},order:1,status:'pending',note:'Camp register at the school office.',source:'admin'},
    'st-2':{id:'st-2',driverId:'D-101',name:'Chooralmala north (relief point)',lat:11.5010,lon:76.1585,items:{water:150,food:100,infant:4},order:2,status:'pending',note:'Check bridge status before leaving Meppadi.',source:'admin'},
    'st-3':{id:'st-3',driverId:'D-102',name:'Panamaram river-side colony',lat:11.7392,lon:76.0751,items:{water:270,food:180,infant:4},order:1,status:'enroute',note:'From SOS sos-2.',source:'sos',sosId:'sos-2'},
    'st-5':{id:'st-5',driverId:'D-104',name:'Panamaram flooded houses (ward 6)',lat:11.7440,lon:76.0805,items:{water:200,food:120,infant:3},order:1,status:'pending',note:'Road under water. Boat only.',source:'admin'},
    'st-4':{id:'st-4',driverId:'D-103',name:'Vythiri PHC',lat:11.5496,lon:76.0418,items:{water:80,food:60,infant:0},order:1,status:'pending',note:'',source:'admin'},
  },
  reports: {
    'hz-1':{id:'hz-1',lat:11.4905,lon:76.1555,type:'bridge',note:'Chooralmala–Mundakkai bridge washed away. No vehicle crossing.',by:'D-101',createdAt:now-6*H},
    'hz-2':{id:'hz-2',lat:11.7290,lon:76.0790,type:'flooded',note:'Panamaram puzha over the road, ~60 cm water.',by:'D-102',createdAt:now-2*H},
    'hz-3':{id:'hz-3',lat:11.5895,lon:76.1010,type:'landslide',note:'Small slip, one lane open. Slow.',by:'D-103',createdAt:now-4*H},
    'hz-4':{id:'hz-4',lat:11.5800,lon:76.0640,type:'safe',note:'NH 766 Kalpetta–Vythiri clear, police checkpoint.',by:'D-103',createdAt:now-1*H},
  },
  escalations: {
    'esc-1':{id:'esc-1',from:'admin',by:'ADM-01',to:'NDRF',type:'Rescue team',place:'Mundakkai',lat:11.4855,lon:76.1525,people:42,urgency:'Critical',note:'42 people cut off by bridge collapse, 3 injured. Need rope-bridge crossing team.',status:'acknowledged',createdAt:now-4.5*H,timeline:[{t:now-4.5*H,s:'sent',n:'Sent to NDRF 4th Bn control'},{t:now-4*H,s:'acknowledged',n:'Team being mobilised from Kalpetta'}]},
  },
  zones: RR.seedZones(),
  drivers: {
    'D-101':{id:'D-101',name:'Ravi Kumar',vehicle:'Truck KL-12 4471',type:'truck',lat:11.6085,lon:76.0830,lastSeen:now-20*60e3,status:'loading'},
    'D-102':{id:'D-102',name:'Anjali Menon',vehicle:'Pickup KL-12 8810',type:'truck',lat:11.7010,lon:76.0790,lastSeen:now-6*60e3,status:'on the road'},
    'D-103':{id:'D-103',name:'Faisal P.',vehicle:'4x4 Jeep KL-73 2205',type:'jeep',lat:11.5800,lon:76.0640,lastSeen:now-12*60e3,status:'on the road'},
    'D-104':{id:'D-104',name:'Shibu Thomas',vehicle:'Rescue boat KL-BT 07',type:'boat',lat:11.7330,lon:76.0700,lastSeen:now-9*60e3,status:'on the water'},
  },
});
RR.COLS = ['sos','stops','reports','escalations','drivers','zones'];

/* ---------- Store: browser storage, synced across tabs; REST API when configured ---------- */
const KEY = 'rr.data.v3';
const store = RR.store = {data:null, mode:'local', db:null, fns:new Set()};
function loadLocal(){
  try{ const d = JSON.parse(localStorage.getItem(KEY)||'null'); if(d && d.sos){ if(!d.zones) d.zones = RR.seedZones(); return d; } }catch(e){}
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
/* REST API mode: the server is the source of truth; this browser keeps a cached copy. */
const api = RR.api = async (path, opts={}) => {
  const sess = RR.session(); const headers = {'Content-Type':'application/json'};
  if(sess && sess.token) headers.Authorization = 'Bearer '+sess.token;
  const r = await fetch(RR.CONFIG.api+path, {...opts, headers});
  if(r.status===401 && sess && sess.token){ try{ localStorage.removeItem('rr.session'); }catch(e){} RR.toast('Your session expired. Sign in again.'); setTimeout(()=>location.reload(), 1500); }
  const j = await r.json().catch(()=>({}));
  if(!r.ok){ const err = new Error(typeof j.detail==='string' ? j.detail : 'Request failed ('+r.status+')'); err.status = r.status; throw err; }
  return j;
};
let syncTimer = null;
store.sync = async () => {
  const sess = RR.session(); if(!RR.CONFIG.api || !sess || !sess.token || !RR.online()) return;
  try{ const j = await api('/api/sync'); const d = {}; RR.COLS.forEach(c => { d[c] = {}; (j.data[c]||[]).forEach(x => d[c][x.id] = x); });
    store.data = d; store.lastSync = Date.now(); store.apiOk = true; saveLocal(); emit(false); }
  catch(e){ store.apiOk = false; emit(false); }
};
store.startSync = () => { if(!RR.CONFIG.api) return; store.mode = 'api'; clearInterval(syncTimer); store.sync();
  syncTimer = setInterval(() => { if(document.visibilityState!=='hidden') store.sync(); }, 5000); };
async function pushApi(col, doc, method){
  const sess = RR.session();
  try{
    if(method==='DELETE') await api(`/api/${col}/${encodeURIComponent(doc.id)}`, {method:'DELETE'});
    else if(col==='sos' && !(sess && sess.token)) await api('/api/public/sos', {method:'POST', body:JSON.stringify(doc)});
    else await api(`/api/${col}/${encodeURIComponent(doc.id)}`, {method:'PUT', body:JSON.stringify(doc)});
    store.apiOk = true; return true;
  }catch(e){
    if(e.status){ RR.toast(e.message); store.sync(); return true; }        // rejected by server: don't retry
    RR.outbox.add({col, doc}); return false;                                 // network failure: retry later
  }
}
store.put = (col, doc) => {
  if(!doc.id) doc.id = col.slice(0,3)+'-'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
  store.data[col] = store.data[col]||{}; store.data[col][doc.id] = clean(doc);
  saveLocal(); emit(true);
  if(RR.CONFIG.api){ pushApi(col, clean(doc)); return doc; }
  if(store.db) store.db.collection(col).doc(doc.id).set(clean(doc)).catch(err => RR.toast('Not saved to the shared log: '+(err&&err.code||'error')));
  return doc;
};
store.patch = (col, id, patch) => { const d = store.get(col,id); if(!d) return; return store.put(col, Object.assign({}, d, patch)); };
store.del = (col, id) => { if(store.data[col]) delete store.data[col][id]; saveLocal(); emit(true); if(RR.CONFIG.api){ pushApi(col, {id}, 'DELETE'); return; } if(store.db) store.db.collection(col).doc(id).delete().catch(()=>{}); };
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
    try{ localStorage.setItem(OUT,'[]'); }catch(e){}
    a.forEach(it => store.put(it.col, it.doc));
    return a.length;
  }
};
RR.publicStatus = async id => { if(!RR.CONFIG.api) return null; try{ return await api('/api/public/sos/'+encodeURIComponent(id)); }catch(e){ return null; } };
if(RR.CONFIG.api){ const s0 = RR.session(); if(s0 && s0.token) setTimeout(store.startSync, 0); }
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
RR.ZONES = {
  red:{label:'Red zone · no entry', sev:3}, landslide:{label:'Landslide / debris flow', sev:3},
  flooded:{label:'Flooded area', sev:3, boatOk:true}, caution:{label:'Caution zone', sev:1},
  relief:{label:'Relief / safe area', sev:0}, info:{label:'Mapped area (reference)', sev:0},
};
RR.inPoly = (p, poly) => { let c = false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){ const a=poly[i], b=poly[j];
  if(((a[0]>p.lat)!==(b[0]>p.lat)) && (p.lon < (b[1]-a[1])*(p.lat-a[0])/(b[0]-a[0])+a[1])) c=!c; } return c; };
RR.zonesAt = p => (p && p.lat!=null) ? RR.store.all('zones').filter(z => z.coords && RR.inPoly(p, z.coords)) : [];
RR.impactZoneAt = p => RR.zonesAt(p).filter(z => (RR.ZONES[z.type]?.sev||0) >= 3)[0] || null;
RR.zonePill = p => { const z = RR.impactZoneAt(p); return z ? `<span class="pill bad" title="${RR.esc(z.name)}">In ${RR.esc(RR.ZONES[z.type].label.split(' ·')[0].toLowerCase())}</span>` : ''; };
RR.zoneImpact = z => {
  const inside = o => o.lat!=null && RR.inPoly(o, z.coords);
  const sos = RR.store.all('sos').filter(s => s.status!=='served' && inside(s));
  return {sos:sos.length, people:sos.reduce((t,s)=>t+(+s.people||0),0), infants:sos.reduce((t,s)=>t+(+s.infants||0),0),
    stops:RR.store.all('stops').filter(s => s.status!=='delivered' && inside(s)).length,
    hazards:RR.store.all('reports').filter(r => r.type!=='safe' && inside(r)).length,
    vehicles:RR.store.all('drivers').filter(inside).map(d=>d.name)};
};
RR.sosPriority = s => { // 0–100, same spirit as the allocation planner
  const n = s.needs||[];
  let u = n.includes('rescue')?1 : n.includes('medical')?.85 : n.includes('water')?.6 : .4;
  if(s.injured>0) u = Math.max(u,.9);
  const people = Math.min(1,(s.people||0)/60), vul = s.people ? Math.min(1,((s.infants||0)+(s.elderly||0)+(s.injured||0))/s.people/.35) : 0;
  const wait = Math.min(1,(Date.now()-(s.createdAt||Date.now()))/(12*H));
  const zoneBoost = RR.impactZoneAt(s) ? 12 : 0;
  return Math.min(100, Math.round(100*(.4*u+.25*people+.2*vul+.15*wait)) + zoneBoost);
};

/* ---------- Demand model (trained by ml/train_demand_model.py, loaded from js/model.js) ---------- */
RR.demand = g => {
  const M = window.DEMAND_MODEL; if(!M || !M.targets) return null;
  const people = +g.people||0, ws = g.safeWater ? 1 : 0, days = Math.max(0, Math.round(+g.daysSinceAid||0));
  const x = {people, infants:+g.infants||0, elderly:+g.elderly||0, pregnant:+g.pregnant||0, injured:+g.injured||0,
    water_source:ws, days_since_aid:days, people_x_water_source:people*ws, people_x_days:people*days};
  const out = {};
  for(const [t, m] of Object.entries(M.targets)){ let v = m.intercept; for(const [f,c] of Object.entries(m.coef)) v += c*(x[f]||0); out[t] = Math.max(0, Math.round(v)); }
  return out;
};
RR.demandForSOS = s => RR.demand({people:s.people, infants:s.infants, elderly:s.elderly, injured:s.injured, daysSinceAid:(Date.now()-(s.createdAt||Date.now()))/864e5});
RR.modelCard = () => { const M = window.DEMAND_MODEL; if(!M) return '';
  const m = M.targets; return `${RR.esc(M.name)} · ${RR.esc(M.type.replace('_',' '))} · trained on ${RR.esc(M.trained_on)}${M.data_is_synthetic && !/synthetic/i.test(M.trained_on)?' (synthetic data)':''} · test R² water ${m.water.metrics.r2}, food ${m.food.metrics.r2}, medical kits ${m.meds.metrics.r2}`; };

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
  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
  const street = L.tileLayer(ESRI+'World_Street_Map/MapServer/tile/{z}/{y}/{x}', {maxZoom:19, attribution:'Tiles © Esri — Esri, HERE, Garmin, USGS, © OpenStreetMap contributors'});
  const sat = L.layerGroup([
    L.tileLayer(ESRI+'World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom:19, attribution:'Imagery © Esri, Maxar, Earthstar Geographics'}),
    L.tileLayer(ESRI+'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {maxZoom:19})]);
  const osm = L.tileLayer(RR.CONFIG.tiles, {maxZoom:19, attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'});
  const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {maxZoom:17, attribution:'© OpenStreetMap contributors, SRTM · © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'});
  street.addTo(map);
  const yday = new Date(Date.now()-864e5).toISOString().slice(0,10);
  const gibsDate = RR.CONFIG.gibsDate || yday;
  const nasa = L.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
    {time:gibsDate, maxNativeZoom:9, maxZoom:19, opacity:.85, attribution:'NASA EOSDIS GIBS (MODIS Terra, '+gibsDate+')'});
  const zones = L.layerGroup().addTo(map);
  const overlays = {'Impact zones':zones, ['NASA satellite, '+gibsDate]:nasa};
  (RR.CONFIG.wms||[]).forEach(w => { try{ overlays[w.name] = L.tileLayer.wms(w.url, {layers:w.layers, format:'image/png', transparent:true, version:w.version||'1.1.1', opacity:.7, attribution:w.attribution||w.name}); }catch(e){} });
  L.control.layers({'Street map (English)':street, 'Satellite with labels':sat, 'Terrain':topo, 'OpenStreetMap (local names)':osm}, overlays, {collapsed:true, position:'topright'}).addTo(map);
  let fails = 0, loaded = 0;
  const note = document.createElement('div'); note.className='mapnote'; note.hidden = true; el.appendChild(note);
  street.on('tileload', () => { loaded++; note.hidden = true; });
  street.on('tileerror', () => { if(++fails>3 && !loaded){ note.hidden=false; note.textContent='Map tiles could not load (no internet connection). Positions and zones are still accurate.'; } });
  map.rrZones = zones;
  setTimeout(() => map.invalidateSize(), 50);
  return map;
};
RR.drawZones = (map, popup) => {
  const g = map.rrZones; g.clearLayers();
  RR.store.all('zones').filter(z => z.coords && z.coords.length>2).sort((a,b)=>(RR.ZONES[a.type]?.sev||0)-(RR.ZONES[b.type]?.sev||0)).forEach(z => {
    const info = z.type==='info';
    const poly = L.polygon(z.coords, {className:'zn zn-'+z.type, weight:info?2:1.5, fillOpacity:info?0.03:(z.type==='relief'?0.15:0.22), dashArray:info?'6 5':null, interactive:true});
    poly.bindPopup(() => popup ? popup(z) : RR.zonePopup(z));
    poly.addTo(g);
  });
};
RR.zonePopup = z => { const im = RR.zoneImpact(z); const zt = RR.ZONES[z.type]||{};
  return `<b>${RR.esc(z.name)}</b><br><span class="hint">${zt.label||z.type}${z.official?' · official source':''}</span>
  ${zt.sev>=1?`<br>${im.sos} open SOS · ${im.people} people${im.infants?' · '+im.infants+' infants':''}<br>${im.stops} pending stops · ${im.hazards} road hazards${im.vehicles.length?'<br>Vehicles inside: '+RR.esc(im.vehicles.join(', ')):''}`:''}
  <br><span class="hint" style="font-size:11.5px">${RR.esc(z.source||'')}</span>${z.sourceUrl?`<br><a href="${RR.esc(z.sourceUrl)}" target="_blank" rel="noopener">Source document</a>`:''}`; };
RR.zoneLegend = () => `<span><i class="zl zn-red"></i>Red zone</span><span><i class="zl zn-landslide"></i>Landslide</span><span><i class="zl zn-flooded"></i>Flooded</span><span><i class="zl zn-caution"></i>Caution</span><span><i class="zl zn-relief"></i>Relief area</span><span><i class="zl zn-info"></i>Govt. mapped area</span>`;
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
function densify(coords, stepM){
  const out = [];
  for(let i=0;i<coords.length;i++){
    if(i){ const a = coords[i-1], b = coords[i], d = RR.dist({lat:a[0],lon:a[1]},{lat:b[0],lon:b[1]}), n = Math.min(200, Math.floor(d/stepM));
      for(let k=1;k<n;k++) out.push([a[0]+(b[0]-a[0])*k/n, a[1]+(b[1]-a[1])*k/n]); }
    out.push(coords[i]);
  }
  return out;
}
RR.zoneHits = (coords, opts={}) => {
  const zs = RR.store.all('zones').filter(z => z.coords && (RR.ZONES[z.type]?.sev||0)>0 && !(opts.boat && RR.ZONES[z.type]?.boatOk));
  if(!zs.length) return [];
  const pts = densify(coords, 80);
  return zs.filter(z => { const la = z.coords.map(c=>c[0]), lo = z.coords.map(c=>c[1]); const bb = [Math.min(...la),Math.max(...la),Math.min(...lo),Math.max(...lo)];
    return pts.some(p => p[0]>=bb[0]&&p[0]<=bb[1]&&p[1]>=bb[2]&&p[1]<=bb[3] && RR.inPoly({lat:p[0],lon:p[1]}, z.coords)); })
    .map(z => ({zone:true, id:z.id, type:z.type, label:RR.ZONES[z.type].label, note:z.name, sev:RR.ZONES[z.type].sev, createdAt:z.createdAt}));
};
RR.hitLabel = h => h.label || RR.HAZ[h.type]?.label || h.type;
RR.assessRoute = (coords, hazards, opts={}) => {
  const hits = hazards.filter(h => h.type!=='safe' && !(opts.boat && h.type==='flooded') && nearLine(coords, h, RR.CONFIG.hazardRadiusM) <= RR.CONFIG.hazardRadiusM).concat(RR.zoneHits(coords, opts));
  const sev = hits.reduce((s,h)=>Math.max(s, h.sev!=null ? h.sev : (RR.HAZ[h.type]?.sev||2)), 0);
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
  const pitch = role==='admin'
    ? ['Live map of SOS requests, vehicles, impact zones and road hazards','Requests ranked by priority, with the reason shown','Assign drivers in one click; track agency requests to resolution']
    : ['Your next stop, load and the safest road to it','Report bridges down, flooding and landslides for every driver','Carry SOS messages out of areas with no signal'];
  root.innerHTML = `<div class="signin">
  <aside class="brandside"><a class="logo" href="index.html">${RR.logo}<b>ReliefReady</b></a>
    <div><h2>${role==='admin'?'District control room':'Driver and boat crew app'}</h2><ul style="margin-top:20px">${pitch.map(x=>`<li>${x}</li>`).join('')}</ul></div>
    <span class="foot">${RR.esc(RR.CONFIG.district)} · relief operations</span></aside>
  <div class="formside"><div class="card">
    <h1>${title}</h1>
    <p class="hint">${role==='admin'?'For district and relief-agency staff.':'For aid vehicle drivers and boat crews.'}</p>
    <form id="si" novalidate>
      <div class="field"><label for="si-id">${role==='admin'?'Staff ID':'Driver ID'}</label><input type="text" id="si-id" autocomplete="username" placeholder="${accts[0].id}" required></div>
      <div class="field"><label for="si-pin">PIN</label><input type="password" id="si-pin" inputmode="numeric" autocomplete="current-password" required></div>
      <p class="err" id="si-err" role="alert"></p>
      <button class="btn primary" type="submit">Sign in</button>
    </form>
    <details class="demo"><summary class="lbl">Demo access</summary>
      ${accts.map(a=>`<button type="button" class="btn" data-demo="${a.id}"><span class="mono">${a.id}</span> · ${RR.esc(a.name)}${a.vehicle?' · '+RR.esc(a.vehicle):''} <span class="hint" style="margin-left:auto">PIN ${a.pin}</span></button>`).join('')}
    </details>
    <p class="hint" style="margin-top:14px">${RR.CONFIG.api?'Accounts are issued by the district control room.':'Demo mode: data is stored in this browser.'}</p>
  </div></div></div>`;
  const f = root.querySelector('#si');
  f.addEventListener('submit', async e => { e.preventDefault(); const btn = f.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Signing in…';
    const r = await RR.signIn(f.querySelector('#si-id').value, f.querySelector('#si-pin').value, role);
    btn.disabled = false; btn.textContent = 'Sign in';
    if(r.error){ root.querySelector('#si-err').textContent = r.error; } else onDone(r.session); });
  root.querySelectorAll('[data-demo]').forEach(b => b.addEventListener('click', () => { const a = RR.ACCOUNTS.find(x=>x.id===b.dataset.demo); f.querySelector('#si-id').value=a.id; f.querySelector('#si-pin').value=a.pin; }));
};

/* register service worker on real hosting (enables offline use) */
if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}
})();
