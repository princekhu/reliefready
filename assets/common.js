/* ReliefReady shared layer: config, seed data, store, sign-in, SOS code, map + safe routing. */
(function(){
'use strict';
const RR = window.RR = {};

/* ---------- Config ---------- */
RR.CONFIG = {
  district: 'Mysuru, Karnataka',
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
  {id:'ADM-01', role:'admin',  name:'District control room', pin:'2026', post:'Mysuru DEOC'},
  {id:'D-101',  role:'driver', name:'Ravi Kumar',  pin:'1234', vehicle:'Truck KA-09 C 4471', type:'truck', cap:500},
  {id:'D-102',  role:'driver', name:'Anjali Rao',  pin:'1234', vehicle:'Pickup KA-09 B 8810', type:'truck', cap:300},
  {id:'D-103',  role:'driver', name:'Faisal Khan', pin:'1234', vehicle:'4x4 Jeep KA-55 M 2205', type:'jeep', cap:250},
  {id:'D-104',  role:'driver', name:'Manjunath S.',pin:'1234', vehicle:'Fire & Emergency boat 07', type:'boat', cap:400},
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

/* ---------- Seed: Mysuru, Karnataka. Places and figures from the August 2019 Kabini floods; extents are illustrative. ---------- */
RR.DISTRICT = {name:'Mysuru district', source:'District boundary: Census of India 2011 (dtcode 577), via india-maps-data', coords:[[12.5706,76.0188],[12.571,76.0191],[12.5771,76.0456],[12.5544,76.0522],[12.5456,76.0906],[12.5388,76.0863],[12.5127,76.1154],[12.527,76.1141],[12.5287,76.1332],[12.5472,76.1514],[12.5797,76.1524],[12.5775,76.1964],[12.5941,76.1921],[12.6217,76.2153],[12.6289,76.2057],[12.6445,76.2193],[12.637,76.2457],[12.6204,76.2547],[12.6338,76.2798],[12.6168,76.2802],[12.6292,76.3003],[12.6227,76.3096],[12.6103,76.3063],[12.6113,76.3265],[12.6113,76.3278],[12.6351,76.3235],[12.6552,76.3424],[12.6556,76.3427],[12.6285,76.3626],[12.5765,76.3768],[12.5732,76.3963],[12.5524,76.391],[12.5579,76.4112],[12.5423,76.4277],[12.5326,76.4228],[12.5056,76.4522],[12.4838,76.4519],[12.4259,76.5674],[12.3992,76.5654],[12.392,76.5551],[12.3819,76.5664],[12.352,76.566],[12.3676,76.622],[12.3953,76.6435],[12.3949,76.6468],[12.3943,76.6524],[12.391,76.6829],[12.367,76.6819],[12.3507,76.7001],[12.3566,76.7189],[12.3426,76.7305],[12.3165,76.7315],[12.3182,76.7434],[12.3022,76.754],[12.3117,76.7639],[12.3504,76.7656],[12.3553,76.803],[12.3871,76.8145],[12.3845,76.8331],[12.4024,76.8324],[12.4086,76.8543],[12.3998,76.8774],[12.4089,76.9002],[12.4366,76.9049],[12.4418,76.9224],[12.4005,76.9376],[12.3527,76.939],[12.3533,76.9241],[12.3383,76.932],[12.3217,76.9218],[12.3269,76.9575],[12.3523,76.9562],[12.353,76.977],[12.3279,76.9767],[12.3335,76.9866],[12.313,76.9979],[12.3006,76.9929],[12.3071,76.977],[12.2905,76.9717],[12.2869,76.9906],[12.2424,76.9952],[12.2323,77.0362],[12.2365,77.0786],[12.2212,77.0779],[12.2206,77.1061],[12.2407,77.1084],[12.2407,77.1084],[12.2427,77.1239],[12.2293,77.1325],[12.2267,77.1342],[12.2261,77.1342],[12.1971,77.1223],[12.191,77.0846],[12.1692,77.0448],[12.1285,77.0399],[12.1392,77.0369],[12.1337,77.0161],[12.134,77.0161],[12.1633,77.0141],[12.16,77.0038],[12.1757,76.9936],[12.1757,76.9929],[12.1405,76.9893],[12.0976,76.9489],[12.121,76.891],[12.1415,76.8715],[12.174,76.8715],[12.1789,76.8516],[12.1675,76.8457],[12.1594,76.8536],[12.1561,76.8407],[12.1321,76.8314],[12.1132,76.8457],[12.1151,76.8768],[12.0826,76.884],[12.0631,76.8701],[12.0598,76.8536],[12.0582,76.8907],[12.026,76.9151],[12.0263,76.939],[12.0133,76.936],[11.999,76.9042],[12.0013,76.8857],[12.0156,76.883],[11.9996,76.8566],[12.0,76.8364],[12.011,76.8212],[12.0273,76.8202],[12.027,76.8116],[12.0107,76.792],[11.9863,76.7937],[12.0094,76.7408],[11.985,76.7173],[11.9853,76.705],[12.0006,76.6944],[12.0081,76.6511],[11.9831,76.6428],[11.9883,76.5783],[11.9489,76.5574],[11.9235,76.5766],[11.8949,76.5568],[11.8588,76.5535],[11.8734,76.5346],[11.861,76.4913],[11.8223,76.4926],[11.8191,76.4688],[11.7927,76.4621],[11.8113,76.4099],[11.7957,76.4287],[11.7878,76.4132],[11.7765,76.4228],[11.7761,76.4228],[11.7589,76.4142],[11.7589,76.4138],[11.7384,76.3523],[11.7407,76.3457],[11.7514,76.3185],[11.7849,76.3076],[11.8126,76.2802],[11.8031,76.2454],[11.8083,76.2236],[11.8275,76.2097],[11.8617,76.2074],[11.8711,76.1905],[11.8702,76.1561],[11.8503,76.12],[11.8584,76.1127],[11.9788,76.1124],[11.9801,76.1137],[12.0175,76.1501],[12.0185,76.1511],[12.0195,76.1521],[12.0325,76.1829],[12.0501,76.1892],[12.1187,76.171],[12.1545,76.1442],[12.1916,76.1332],[12.1971,76.1018],[12.2492,76.0621],[12.2489,76.0247],[12.2925,76.0145],[12.3175,75.9946],[12.3305,76.0012],[12.3439,75.9605],[12.3842,75.9221],[12.3962,75.9106],[12.3982,75.9086],[12.4002,75.9096],[12.4372,75.9281],[12.4395,75.9291],[12.448,75.9638],[12.4503,75.9714],[12.4509,75.9714],[12.4906,75.9582],[12.5199,75.9754],[12.5222,75.9939],[12.5404,75.9833],[12.5475,75.9989],[12.5609,75.9926],[12.5622,75.992],[12.5544,76.0125],[12.5706,76.0188]]};
const now = Date.now(), H = 3600e3;
RR.SRC_2019 = 'https://www.thenewsminute.com/karnataka/over-1000-people-mysuru-shifted-relief-camps-water-4-reservoirs-released-106982';
RR.seedZones = () => {
  const t = Date.now(), src = 'Places from news reports of the August 2019 Kabini floods (The News Minute, 10 Aug 2019). Extent drawn for the demo, not an official flood map.';
  return {
    'zn-1':{id:'zn-1',name:'Kapila river flooding, Nanjangud town',type:'flooded',official:false,createdAt:t,by:'ADM-01',
      coords:[[12.1330,76.6660],[12.1290,76.6760],[12.1200,76.6880],[12.1120,76.6990],[12.1040,76.7080],[12.0990,76.7030],[12.1080,76.6920],[12.1150,76.6810],[12.1230,76.6700],[12.1290,76.6620]],
      source:'Nanjangud town, Halladakere and Topabeedi flooded; 617 people in 7 relief camps. '+src, sourceUrl:RR.SRC_2019},
    'zn-2':{id:'zn-2',name:'Kabini backwater villages cut off (Tumbasogu, Maadaapura, Chekkooru)',type:'flooded',official:false,createdAt:t,by:'ADM-01',
      coords:[[12.0600,76.2700],[12.0650,76.3050],[12.0480,76.3300],[12.0250,76.3350],[12.0080,76.3150],[12.0150,76.2800],[12.0380,76.2650]],
      source:'Hosakote bridge submerged, cutting off Tumbasogu, Maadaapura, Chekkooru, Hommarahalli and M.C. Talalu. '+src, sourceUrl:RR.SRC_2019},
    'zn-3':{id:'zn-3',name:'Hosakote bridge approach, no entry',type:'red',official:false,createdAt:t,by:'ADM-01',
      coords:[[12.0640,76.3080],[12.0640,76.3220],[12.0540,76.3220],[12.0540,76.3080]],
      source:'Bridge submerged by Kabini outflow (1,02,083 cusecs on 10 Aug 2019). '+src, sourceUrl:RR.SRC_2019},
    'zn-4':{id:'zn-4',name:'Cauvery–Kabini confluence, T. Narasipura',type:'caution',official:false,createdAt:t,by:'ADM-01',
      coords:[[12.2280,76.8850],[12.2250,76.9150],[12.2050,76.9200],[12.1950,76.9000],[12.2080,76.8800]],
      source:'Low-lying wards flood when KRS and Kabini release together (illustrative).'},
    'zn-5':{id:'zn-5',name:'Mysuru relief depot area',type:'relief',official:false,createdAt:t,by:'ADM-01',
      coords:[[12.3120,76.6490],[12.3120,76.6590],[12.3050,76.6590],[12.3050,76.6490]],
      source:'Collection and dispatch point at the Deputy Commissioner’s office (demo).'},
  };
};
RR.DEPOT = {name:'Mysuru relief depot (DC office)', lat:12.3086, lon:76.6538};
RR.seed = () => ({
  sos: {
    'sos-1':{id:'sos-1',code:'',createdAt:now-5.2*H,lat:12.0350,lon:76.3050,place:'Tumbasogu, H.D. Kote taluk',people:64,infants:4,elderly:11,injured:2,needs:['rescue','medical','water'],note:'Hosakote bridge under water. Village cut off, two injured.',phone:'',channel:'sms',status:'new'},
    'sos-2':{id:'sos-2',code:'',createdAt:now-3.1*H,lat:12.1150,lon:76.6870,place:'Halladakere, Nanjangud',people:120,infants:6,elderly:18,injured:0,needs:['water','food','infant'],note:'Houses flooded by the Kapila. Drinking water finished.',phone:'',channel:'app',status:'assigned',assignedTo:'D-102'},
    'sos-3':{id:'sos-3',code:'',createdAt:now-1.4*H,lat:12.3060,lon:76.2860,place:'Hunsur, Lakshmanatirtha riverbank',people:35,infants:1,elderly:6,injured:1,needs:['food','medical'],note:'Elderly man needs insulin.',phone:'',channel:'relay',status:'new'},
  },
  stops: {
    'st-1':{id:'st-1',driverId:'D-101',name:'Nanjangud relief camp (Govt. school)',lat:12.1180,lon:76.6830,items:{water:900,food:300,infant:8},order:1,status:'pending',note:'617 people across 7 camps in Nanjangud.',source:'admin'},
    'st-2':{id:'st-2',driverId:'D-101',name:'T. Narasipura camp',lat:12.2110,lon:76.9010,items:{water:400,food:150,infant:4},order:2,status:'pending',note:'Check Cauvery level before crossing.',source:'admin'},
    'st-3':{id:'st-3',driverId:'D-102',name:'Halladakere, Nanjangud',lat:12.1150,lon:76.6870,items:{water:360,food:120,infant:6},order:1,status:'enroute',note:'From SOS sos-2.',source:'sos',sosId:'sos-2'},
    'st-5':{id:'st-5',driverId:'D-104',name:'Tumbasogu (Kabini backwaters)',lat:12.0350,lon:76.3050,items:{water:200,food:70,infant:4},order:1,status:'pending',note:'Road cut at Hosakote bridge. Boat only.',source:'admin'},
    'st-4':{id:'st-4',driverId:'D-103',name:'Hunsur taluk hospital',lat:12.3100,lon:76.2900,items:{water:120,food:60,infant:0},order:1,status:'pending',note:'',source:'admin'},
  },
  reports: {
    'hz-1':{id:'hz-1',lat:12.0590,lon:76.3150,type:'bridge',note:'Hosakote bridge submerged. Tumbasogu, Maadaapura, Chekkooru cut off.',by:'D-104',createdAt:now-6*H},
    'hz-2':{id:'hz-2',lat:12.1080,lon:76.7000,type:'flooded',note:'Hejjige bridge inundated by the Kapila.',by:'D-102',createdAt:now-2*H},
    'hz-3':{id:'hz-3',lat:12.1420,lon:76.7650,type:'flooded',note:'Suttur bridge inundated. Use Mysuru–Nanjangud road.',by:'D-102',createdAt:now-4*H},
    'hz-4':{id:'hz-4',lat:12.2150,lon:76.6600,type:'safe',note:'Mysuru–Nanjangud road (NH 766) clear.',by:'D-101',createdAt:now-1*H},
  },
  escalations: {
    'esc-1':{id:'esc-1',from:'admin',by:'ADM-01',to:'NDRF',type:'Boat evacuation',place:'Tumbasogu & Maadaapura, H.D. Kote',lat:12.0350,lon:76.3050,people:64,urgency:'Critical',note:'Villages cut off by the submerged Hosakote bridge, two injured. Need boats and a medical team.',status:'acknowledged',createdAt:now-4.5*H,timeline:[{t:now-4.5*H,s:'sent',n:'Sent to NDRF 10th Bn control'},{t:now-4*H,s:'acknowledged',n:'Two boats moving from Mysuru'}]},
  },
  zones: RR.seedZones(),
  drivers: {
    'D-101':{id:'D-101',name:'Ravi Kumar',vehicle:'Truck KA-09 C 4471',type:'truck',lat:12.3086,lon:76.6538,lastSeen:now-20*60e3,status:'loading'},
    'D-102':{id:'D-102',name:'Anjali Rao',vehicle:'Pickup KA-09 B 8810',type:'truck',lat:12.1700,lon:76.6700,lastSeen:now-6*60e3,status:'on the road'},
    'D-103':{id:'D-103',name:'Faisal Khan',vehicle:'4x4 Jeep KA-55 M 2205',type:'jeep',lat:12.3050,lon:76.4500,lastSeen:now-12*60e3,status:'on the road'},
    'D-104':{id:'D-104',name:'Manjunath S.',vehicle:'Fire & Emergency boat 07',type:'boat',lat:12.0880,lon:76.3300,lastSeen:now-9*60e3,status:'launching at H.D. Kote'},
  },
});
RR.COLS = ['sos','stops','reports','escalations','drivers','zones'];

/* ---------- Store: local + cross-tab; shared artifact db when available ---------- */
const KEY = 'rr.data.v4';
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
  const map = L.map(el, {zoomControl:true, attributionControl:true}).setView(opts.center||[12.22,76.62], opts.zoom||10);
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
  if(RR.DISTRICT){
    const dist = L.layerGroup(), world = [[-85,-179.9],[85,-179.9],[85,179.9],[-85,179.9]];
    L.polygon([world, RR.DISTRICT.coords], {className:'dmask', weight:0, fillOpacity:.32, interactive:false}).addTo(dist);
    L.polygon(RR.DISTRICT.coords, {className:'dline', fill:false, weight:2.2, interactive:false}).addTo(dist);
    dist.addTo(map); overlays['District boundary'] = dist;
    map.attributionControl.addAttribution('District boundary: Census of India 2011');
    map.rrDistrictBounds = L.polygon(RR.DISTRICT.coords).getBounds();
    if(opts.fitDistrict) map.fitBounds(map.rrDistrictBounds, {padding:[12,12]});
  }
  if(opts.locate) RR.addLocate(map);
  (RR.CONFIG.wms||[]).forEach(w => { try{ overlays[w.name] = L.tileLayer.wms(w.url, {layers:w.layers, format:'image/png', transparent:true, version:w.version||'1.1.1', opacity:.7, attribution:w.attribution||w.name}); }catch(e){} });
  const bases = {'Street map (English)':street, 'Satellite with labels':sat, 'Terrain':topo, 'OpenStreetMap (local names)':osm};
  delete overlays['Impact zones'];
  if(RR.mapTools) RR.mapTools(map, {bases, reference:overlays, aoiActions:opts.aoiActions, saveZone:opts.saveZone});
  else L.control.layers(bases, overlays, {collapsed:true, position:'topright'}).addTo(map);
  let fails = 0, loaded = 0;
  const note = document.createElement('div'); note.className='mapnote'; note.hidden = true; el.appendChild(note);
  street.on('tileload', () => { loaded++; note.hidden = true; });
  street.on('tileerror', () => { if(++fails>3 && !loaded){ note.hidden=false; note.textContent='Map tiles could not load (no internet connection). Positions and zones are still accurate.'; } });
  map.rrZones = zones;
  setTimeout(() => map.invalidateSize(), 50);
  return map;
};
/* Live location of this device on a map (control room / home page). */
RR.addLocate = map => {
  const Ctl = L.Control.extend({options:{position:'topleft'}, onAdd(){
    const b = L.DomUtil.create('button','locbtn'); b.type='button'; b.title='Show my live location'; b.setAttribute('aria-label','Show my live location');
    b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    L.DomEvent.disableClickPropagation(b);
    let watch = null, mk = null, acc = null, first = true;
    b.onclick = () => {
      if(watch!==null){ navigator.geolocation.clearWatch(watch); watch=null; mk&&mk.remove(); acc&&acc.remove(); mk=acc=null; b.classList.remove('on'); return; }
      if(!navigator.geolocation){ RR.toast('This browser cannot share its location.'); return; }
      b.classList.add('on'); first = true;
      watch = navigator.geolocation.watchPosition(p => {
        const ll = [p.coords.latitude, p.coords.longitude];
        if(!mk){ mk = L.marker(ll,{icon:L.divIcon({className:'',html:'<div class="me"></div>',iconSize:[18,18],iconAnchor:[9,9]}),zIndexOffset:2000}).bindTooltip('You (live)').addTo(map); acc = L.circle(ll,{radius:p.coords.accuracy,className:'meacc',weight:1,interactive:false}).addTo(map); }
        else { mk.setLatLng(ll); acc.setLatLng(ll).setRadius(p.coords.accuracy); }
        if(first){ first=false; map.setView(ll, Math.max(map.getZoom(), 13)); }
      }, err => { RR.toast(err.code===1 ? 'Location permission was refused.' : 'Could not get your location.'); b.classList.remove('on'); watch=null; }, {enableHighAccuracy:true, maximumAge:10000});
    };
    return b; }});
  new Ctl().addTo(map);
};
RR.drawZones = (map, popup) => {
  const g = map.rrZones; g.clearLayers(); map.rrZonePopup = popup; const hid = map.rrHidden || new Set();
  RR.store.all('zones').filter(z => z.coords && z.coords.length>2 && !hid.has(z.type)).sort((a,b)=>(RR.ZONES[a.type]?.sev||0)-(RR.ZONES[b.type]?.sev||0)).forEach(z => {
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

/* ---------- Back navigation inside the site ---------- */
RR.backBtn = () => '<a class="backbtn" href="index.html" data-back aria-label="Go back"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>Back</a>';
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('[data-back]'); if(!a) return;
  let same = false; try{ same = document.referrer && new URL(document.referrer).origin === location.origin; }catch(err){}
  if(same && history.length > 1){ e.preventDefault(); history.back(); }
});

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
