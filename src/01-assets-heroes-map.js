(function () {
'use strict';

/* ---------------- Plastic soldier sculpts (weathered) ---------------- */
var POSES = {
  pointman: { h:[100,38], n:[100,58], p:[98,118], legs:[[[88,160],[84,206],[98,210]],[[110,160],[116,206],[130,210]]], arms:[[[120,82],[130,72]],[[132,90],[150,80]]], ex:[[84,74,178,62,3.5],[178,62,194,59,1.6]] },
  kneeler: { h:[96,78], n:[96,96], p:[92,148], legs:[[[122,150],[124,206],[138,210]],[[90,204],[58,204],[50,198]]], arms:[[[116,112],[122,100]],[[130,118],[148,106]]], ex:[[80,108,176,96,3.5],[176,96,192,93,1.6]] },
  sniper: { h:[150,180], n:[138,186], p:[80,196], tr:13, hr:12, legs:[[[52,200],[24,204],[16,198]],[[52,207],[26,211],[18,206]]], arms:[[[150,206],[164,192]],[[160,208],[176,196]]], ex:[[140,190,196,186,3],[150,181,168,181,3.2]] },
  bazooka: { h:[96,42], n:[96,62], p:[96,120], legs:[[[84,162],[80,206],[94,210]],[[108,162],[114,206],[128,210]]], arms:[[[116,92],[112,74]],[[80,88],[86,72]]], ex:[[34,60,172,60,10],[172,60,180,60,12]] },
  grenadier: { h:[98,42], n:[98,62], p:[100,120], legs:[[[76,160],[64,206],[78,210]],[[122,158],[132,206],[146,210]]], arms:[[[74,58],[66,36]],[[122,82],[142,86]]], ci:[[64,28,7.5]] },
  radioman: { h:[100,40], n:[100,60], p:[100,118], legs:[[[92,162],[90,206],[104,210]],[[108,162],[112,206],[126,210]]], arms:[[[116,84],[110,48]],[[110,92],[118,118]]], ex:[[78,64,78,104,14],[74,58,62,8,1.6],[108,46,112,54,4]] },
  flamer: { h:[98,42], n:[98,62], p:[98,120], legs:[[[84,162],[74,206],[88,210]],[[116,160],[122,206],[136,210]]], arms:[[[114,96],[126,104]],[[124,90],[138,92]]], ex:[[76,64,76,112,9],[86,66,86,112,9],[110,104,178,90,4],[178,90,186,88,5.5]] },
  sweeper: { h:[96,42], n:[96,62], p:[96,120], legs:[[[86,162],[76,206],[90,210]],[[112,160],[118,204],[132,206]]], arms:[[[112,90],[124,104]],[[106,96],[120,110]]], ex:[[120,106,170,196,2.5],[160,201,192,201,5.5]] },
  mortar: { h:[80,88], n:[84,106], p:[80,154], legs:[[[108,150],[100,206],[114,210]],[[64,178],[56,206],[68,210]]], arms:[[[104,128],[124,120]],[[98,134],[116,140]]], ex:[[128,206,158,128,8],[148,160,172,206,2],[116,208,146,208,4]], ci:[[131,116,6.5]] },
  officer: { h:[98,40], n:[98,60], p:[98,118], legs:[[[88,162],[84,206],[98,210]],[[110,162],[118,206],[132,210]]], arms:[[[130,64],[160,58]],[[80,48],[74,24]]], ex:[[156,53,178,53,3.5],[162,55,160,66,2.6],[98,78,112,78,5]] },
  gunner: { h:[142,178], n:[130,186], p:[76,196], tr:13, hr:12, legs:[[[50,200],[22,204],[14,198]],[[50,207],[24,211],[16,206]]], arms:[[[144,204],[158,190]],[[152,206],[166,194]]], ex:[[126,188,184,184,5.5],[184,184,198,183,2],[174,187,166,209,1.6],[174,187,184,209,1.6]] },
  charger: { h:[112,46], n:[106,66], p:[92,120], legs:[[[118,150],[112,186],[126,194]],[[76,160],[58,202],[72,210]]], arms:[[[120,96],[134,104]],[[114,102],[148,94]]], ex:[[100,112,176,86,3.5],[176,86,194,79,1.6]] },
  para: { h:[100,62], n:[100,82], p:[100,140], legs:[[[94,178],[92,206],[100,211]],[[106,178],[110,206],[118,211]]], arms:[[[84,60],[80,32]],[[116,60],[120,32]]], ex:[[80,32,58,4,2],[120,32,142,4,2],[92,96,108,96,6]] },
  scout: { h:[100,40], n:[100,60], p:[100,118], legs:[[[90,162],[86,206],[100,210]],[[110,162],[116,206],[130,210]]], arms:[[[120,74],[114,46]],[[86,74],[106,48]]], ex:[[104,41,122,41,5.5],[78,70,108,126,2.6]] },
  shotgun: { h:[94,46], n:[94,66], p:[96,122], legs:[[[74,160],[66,206],[80,210]],[[120,160],[128,206],[142,210]]], arms:[[[102,100],[118,106]],[[118,94],[140,96]]], ex:[[94,111,174,94,3.8],[138,99,154,96,4.5]] },
  commando: { h:[92,72], n:[94,92], p:[92,144], legs:[[[120,142],[116,206],[130,210]],[[70,172],[62,206],[76,210]]], arms:[[[112,116],[128,110]],[[76,80],[72,54]]], ex:[[106,115,152,108,4.2],[128,112,126,128,3],[72,54,74,30,2.2]] }
};
var TEAMC = [
  { c1:'#8FA960', c2:'#536E2E', c3:'#2C3D18', ol:'#141A0B', ui:'#4E6B2A', hi:'#9DB464', bar:'#6C8C38' },
  { c1:'#D8C494', c2:'#A88B55', c3:'#6B5330', ol:'#2A1E0E', ui:'#B99A62', hi:'#E0C890', bar:'#C9A866' }
];
function r1(x) { return Math.round(x * 10) / 10; }
function circP(c, r) { return 'M' + r1(c[0] - r) + ',' + r1(c[1]) + 'a' + r + ',' + r + ' 0 1 0 ' + r1(2 * r) + ',0a' + r + ',' + r + ' 0 1 0 ' + r1(-2 * r) + ',0Z'; }
function capP(a, b, r) {
  var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.sqrt(dx * dx + dy * dy);
  if (L < 0.5) return circP(a, r);
  var nx = -dy / L * r, ny = dx / L * r;
  return 'M' + r1(a[0] + nx) + ',' + r1(a[1] + ny) + 'L' + r1(b[0] + nx) + ',' + r1(b[1] + ny) +
    'A' + r + ',' + r + ' 0 0 0 ' + r1(b[0] - nx) + ',' + r1(b[1] - ny) + 'L' + r1(a[0] - nx) + ',' + r1(a[1] - ny) +
    'A' + r + ',' + r + ' 0 0 0 ' + r1(a[0] + nx) + ',' + r1(a[1] + ny) + 'Z';
}
var poseCache = {};
function posePaths(key) {
  if (poseCache[key]) return poseCache[key];
  var P = POSES[key] || POSES.pointman, tr = P.tr || 16, hr = P.hr || 13, d = '', low = [];
  function note(pt) { if (pt[1] > 192) low.push(pt[0]); }
  d += capP(P.n, P.p, tr);
  P.legs.forEach(function (L) { d += capP(P.p, L[0], 9.5) + capP(L[0], L[1], 8) + capP(L[1], L[2], 5.5); note(L[0]); note(L[1]); note(L[2]); });
  var sh = [P.n[0], P.n[1] + 6];
  P.arms.forEach(function (A) { d += capP(sh, A[0], 6.5) + capP(A[0], A[1], 5.5) + circP(A[1], 5); note(A[0]); });
  (P.ex || []).forEach(function (e) { d += capP([e[0], e[1]], [e[2], e[3]], e[4]); note([e[0], e[1]]); note([e[2], e[3]]); });
  (P.ci || []).forEach(function (c) { d += circP([c[0], c[1]], c[2]); });
  var hx = P.h[0], hy = P.h[1];
  d += circP(P.h, hr);
  d += 'M' + r1(hx + hr + 2) + ',' + r1(hy + 1) + 'A' + (hr + 2) + ',' + (hr + 2) + ' 0 0 0 ' + r1(hx - hr - 2) + ',' + r1(hy + 1) + 'Z';
  d += capP([hx - hr - 4, hy + 2], [hx + hr + 4, hy + 2], 2.5);
  if (!low.length) low = [80, 120];
  var x0 = Math.max(4, Math.min.apply(null, low) - 16), x1 = Math.min(196, Math.max.apply(null, low) + 16), mid = (x0 + x1) / 2;
  var out = {
    body: new Path2D(d),
    base: new Path2D('M' + r1(x0) + ',212Q' + r1(mid) + ',207 ' + r1(x1) + ',212L' + r1(x1 + 4) + ',223Q' + r1(mid) + ',226 ' + r1(x0 - 4) + ',223Z'),
    baseTop: new Path2D('M' + r1(x0 + 2) + ',212.5Q' + r1(mid) + ',208.5 ' + r1(x1 - 2) + ',212.5L' + r1(x1 - 4) + ',215Q' + r1(mid) + ',212 ' + r1(x0 + 4) + ',215Z'),
    shine: new Path2D('M' + r1(hx - hr + 2) + ',' + r1(hy - 2) + 'A' + (hr - 2) + ',' + (hr - 2) + ' 0 0 1 ' + r1(hx - 1) + ',' + r1(hy - hr) + 'L' + r1(hx - 2) + ',' + r1(hy - hr + 4) + 'A' + (hr - 6) + ',' + (hr - 6) + ' 0 0 0 ' + r1(hx - hr + 6) + ',' + r1(hy - 1) + 'Z'),
    mid: mid, half: (x1 - x0) / 2
  };
  poseCache[key] = out;
  return out;
}
function paintPose(ctx, key, team, flip, flash) {
  var p = posePaths(key), C = TEAMC[team];
  ctx.save();
  if (flip) { ctx.translate(200, 0); ctx.scale(-1, 1); }
  if (flash) { ctx.fillStyle = '#FFFFFF'; ctx.fill(p.base); ctx.fill(p.body); ctx.restore(); return; }
  var g = ctx.createLinearGradient(0, 0, 200, 240);
  g.addColorStop(0, C.c1); g.addColorStop(0.45, C.c2); g.addColorStop(1, C.c3);
  ctx.fillStyle = C.c3; ctx.strokeStyle = C.ol; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  ctx.fill(p.base); ctx.stroke(p.base);
  ctx.fillStyle = C.c2; ctx.fill(p.baseTop);
  ctx.fillStyle = C.ol; ctx.strokeStyle = C.ol; ctx.lineWidth = 5; ctx.fill(p.body); ctx.stroke(p.body);
  ctx.fillStyle = g; ctx.fill(p.body);
  ctx.fillStyle = 'rgba(110,95,70,0.14)'; ctx.fill(p.body);
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1; ctx.stroke(p.body);
  ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill(p.shine);
  ctx.restore();
}
var spriteCache = {};
function sprite(key, team, h, flip, flash) {
  var id = key + '|' + team + '|' + h + '|' + (flip ? 1 : 0) + (flash ? 'f' : '');
  if (spriteCache[id]) return spriteCache[id];
  var S = 2, w = Math.ceil(h * 200 / 240), cv = document.createElement('canvas');
  cv.width = w * S; cv.height = h * S;
  var c = cv.getContext('2d');
  c.scale(S * h / 240, S * h / 240);
  paintPose(c, key, team, flip, flash);
  spriteCache[id] = { cv: cv, w: w, h: h };
  return spriteCache[id];
}

/* ---------------- Heroes ---------------- */
var HEROES = [
 {key:'pointman',name:'Point Man',role:'Fighter',hp:1100,spd:270,range:420,dmg:42,acd:.75,aa:'bullet',
  Q:{n:'Aimed Shot',t:'proj',cd:6,range:850,speed:1300,dmg:140,w:22,slow:.35},
  W:{n:'Fix Bayonet',t:'buff',cd:12,dur:4,b:{as:.6,lifesteal:.2}},
  E:{n:'Hit the Dirt',t:'dash',cd:9,dist:260},
  R:{n:'Full Clip',t:'chan',cd:45,dur:2,rate:.08,dmg:30,spread:.22,range:800}},
 {key:'kneeler',name:'Kneeler',role:'Marksman',hp:950,spd:260,range:520,dmg:48,acd:.8,aa:'bullet',
  Q:{n:'Steady Aim',t:'proj',cd:7,range:1000,speed:1700,dmg:170,w:18,pierce:1},
  W:{n:'Covering Fire',t:'lob',cd:12,range:700,delay:.15,r:180,dmg:50,slow:.45},
  E:{n:'Reposition',t:'dash',cd:10,dist:230},
  R:{n:'Brace',t:'buff',cd:50,dur:6,b:{range:320,as:.4,root:1}}},
 {key:'sniper',name:'Prone Sniper',role:'Poke',hp:850,spd:255,range:580,dmg:54,acd:1.1,aa:'bullet',
  Q:{n:'Long Shot',t:'proj',cd:7,range:1250,speed:2100,dmg:220,w:16},
  W:{n:'Ghillie',t:'buff',cd:14,dur:4,b:{ms:.35,ghost:1}},
  E:{n:'Belly Crawl',t:'dash',cd:10,dist:190},
  R:{n:'One Round',t:'proj',cd:55,range:3200,speed:2600,dmg:460,w:20,exec:.25}},
 {key:'bazooka',name:'Bazooka',role:'Burst',hp:1000,spd:260,range:400,dmg:58,acd:1.0,aa:'bullet',
  Q:{n:'Rocket',t:'proj',cd:6,range:900,speed:950,dmg:170,w:24,aoe:110,rocket:1},
  W:{n:'Backblast',t:'nova',cd:11,r:180,dmg:70,knock:300},
  E:{n:'Reload Drill',t:'dash',cd:10,dist:260},
  R:{n:'Bunker Buster',t:'lob',cd:45,range:900,delay:.8,r:190,dmg:320,smul:3}},
 {key:'grenadier',name:'Grenadier',role:'Mage',hp:950,spd:260,range:430,dmg:45,acd:.85,aa:'bullet',
  Q:{n:'Frag',t:'lob',cd:6,range:760,delay:.6,r:140,dmg:180},
  W:{n:'Smoke',t:'lob',cd:13,range:700,delay:.1,r:190,dmg:0,slow:.5},
  E:{n:'Cook It',t:'dash',cd:10,dist:220},
  R:{n:'Bandolier',t:'lob',cd:45,range:850,delay:.7,r:120,dmg:160,count:5,spread:170}},
 {key:'radioman',name:'Radioman',role:'Support',hp:1050,spd:265,range:450,dmg:38,acd:.85,aa:'bullet',
  Q:{n:'Coordinates',t:'proj',cd:6,range:900,speed:1200,dmg:100,w:24,slow:.25},
  W:{n:'Relay',t:'shield',cd:11,amt:260,dur:3,ally:1},
  E:{n:'Static',t:'nova',cd:10,r:210,dmg:60,slow:.5},
  R:{n:'Air Strike',t:'lob',cd:50,range:1000,delay:1.0,r:120,dmg:210,count:6,line:1}},
 {key:'flamer',name:'Flamethrower',role:'Tank',hp:1550,spd:265,range:230,dmg:36,acd:.5,aa:'flame',
  Q:{n:'Sweep',t:'cone',cd:6,range:320,ang:.9,dmg:230,dur:.8},
  W:{n:'Heat Shield',t:'shield',cd:12,amt:360,dur:3},
  E:{n:'Firebreak',t:'dash',cd:10,dist:240},
  R:{n:'Meltdown',t:'buff',cd:50,dur:6,b:{aura:90,selfdps:15,dmgRed:.2}}},
 {key:'sweeper',name:'Minesweeper',role:'Control',hp:1150,spd:270,range:380,dmg:40,acd:.8,aa:'bullet',
  Q:{n:'Sweep Pulse',t:'nova',cd:7,r:270,dmg:85,slow:.4},
  W:{n:'Plant Mine',t:'mine',cd:6,range:300,dmg:230,r:120},
  E:{n:'Disarm',t:'dash',cd:10,dist:220},
  R:{n:'Minefield',t:'mine',cd:45,range:600,dmg:200,r:110,count:6,spread:200}},
 {key:'mortar',name:'Mortar Man',role:'Artillery',hp:900,spd:245,range:620,dmg:52,acd:1.3,aa:'shell',
  Q:{n:'Lob',t:'lob',cd:7,range:1100,delay:1.0,r:130,dmg:210},
  W:{n:'Range Card',t:'buff',cd:14,dur:5,b:{range:160}},
  E:{n:'Dig In',t:'shield',cd:12,amt:300,dur:3},
  R:{n:'Barrage',t:'lob',cd:50,range:1100,delay:1.0,r:120,dmg:150,count:8,spread:230}},
 {key:'officer',name:'Officer',role:'Engage',hp:1200,spd:280,range:380,dmg:40,acd:.7,aa:'bullet',
  Q:{n:'Sidearm',t:'proj',cd:5,range:700,speed:1500,dmg:120,w:20},
  W:{n:'Spotting',t:'buff',cd:12,dur:3,b:{ms:.3}},
  E:{n:'Charge!',t:'leap',cd:11,range:360,r:140,dmg:110,slow:.6},
  R:{n:'Follow Me',t:'team',cd:55,r:1300,dur:4,b:{ms:.4},shield:200}},
 {key:'gunner',name:'Machine Gunner',role:'Hypercarry',hp:1000,spd:245,range:500,dmg:22,acd:.28,aa:'bullet',
  Q:{n:'Suppress',t:'cone',cd:7,range:460,ang:.6,dmg:130,slow:.5,dur:.5},
  W:{n:'Set Tripod',t:'buff',cd:12,dur:4,b:{as:1.0,root:1}},
  E:{n:'Swap Barrel',t:'buff',cd:10,dur:3,b:{as:.4,ms:.2}},
  R:{n:'Lead Hose',t:'chan',cd:45,dur:3,rate:.06,dmg:28,spread:.35,range:850}},
 {key:'charger',name:'Charger',role:'Assassin',hp:1250,spd:290,range:160,dmg:62,acd:.8,aa:'melee',
  Q:{n:'Lunge',t:'dash',cd:6,dist:280,dmg:130},
  W:{n:'War Cry',t:'nova',cd:11,r:230,dmg:40,slow:.6},
  E:{n:'Vault',t:'dash',cd:9,dist:220},
  R:{n:'Over the Top',t:'leap',cd:40,range:650,r:150,dmg:300,exec:.2}},
 {key:'para',name:'Paratrooper',role:'Diver',hp:1300,spd:275,range:200,dmg:55,acd:.85,aa:'melee',
  Q:{n:'Static Line',t:'proj',cd:8,range:750,speed:1300,dmg:100,w:24,pull:1},
  W:{n:'Chute Glide',t:'buff',cd:12,dur:3,b:{ms:.4}},
  E:{n:'Ripcord',t:'leap',cd:10,range:380,r:150,dmg:140,slow:.5},
  R:{n:'Airborne',t:'leap',cd:50,range:1700,r:210,dmg:220,slow:.5}},
 {key:'scout',name:'Scout',role:'Vision',hp:950,spd:275,range:480,dmg:44,acd:.8,aa:'bullet',
  Q:{n:'Spot',t:'proj',cd:6,range:1100,speed:1800,dmg:130,w:28,pierce:1},
  W:{n:'Flare',t:'lob',cd:12,range:900,delay:.2,r:260,dmg:30,slow:.2},
  E:{n:'Recon Dash',t:'dash',cd:9,dist:300},
  R:{n:'Overwatch',t:'team',cd:55,r:3000,dur:6,b:{dmgMul:.15}}},
 {key:'shotgun',name:'Shotgunner',role:'Bruiser',hp:1350,spd:270,range:260,dmg:70,acd:1.0,aa:'bullet',
  Q:{n:'Buckshot',t:'cone',cd:6,range:330,ang:.8,dmg:200,knock:280,dur:.05},
  W:{n:'Pump',t:'buff',cd:11,dur:3,b:{dmgMul:.5}},
  E:{n:'Breach',t:'dash',cd:10,dist:240,dmg:80},
  R:{n:'Slug Round',t:'proj',cd:40,range:520,speed:1400,dmg:360,w:30,knock:440}},
 {key:'commando',name:'Commando',role:'Skirmisher',hp:1050,spd:290,range:300,dmg:30,acd:.35,aa:'bullet',
  Q:{n:'Burst',t:'cone',cd:5,range:390,ang:.35,dmg:160,dur:.3},
  W:{n:'Knife',t:'proj',cd:8,range:320,speed:1200,dmg:110,w:26,burn:1},
  E:{n:'Shadow Step',t:'dash',cd:9,dist:320},
  R:{n:'Night Raid',t:'buff',cd:45,dur:4,b:{ms:.4,dmgMul:.4,ghost:1}}}
];
var TAG = { n:'Tag Round', t:'jack', cd:20, range:1200, speed:1300, w:22 };
var DECK = { n:'Hit the Deck', t:'dash', cd:18, dist:210, iframe:.35 };

/* ---------------- Field Orders ---------------- */
var TIERS = ['Squad', 'Platoon', 'Company'];
var ORDERS = [
  [ { id:'helmet', n:'Steel Pot', d:'+250 max health.', a:{hp:250} },
    { id:'boots', n:'Broken-in Boots', d:'+10% move speed.', a:{ms:.1} },
    { id:'clip', n:'Extra Clip', d:'+18% attack speed.', a:{as:.18} },
    { id:'pouch', n:'Ammo Pouch', d:'+14 attack damage.', a:{aa:14} },
    { id:'canteen', n:'Canteen', d:'Regenerate 8 health per second.', a:{regen:8} },
    { id:'whistle', n:'Sergeant’s Whistle', d:'Abilities recharge 12% faster.', a:{haste:.12} } ],
  [ { id:'ammo', n:'Bandolier', d:'Q recharges 35% faster.', a:{cdQ:.35} },
    { id:'fused', n:'Buddy System', d:'Take 15% less damage while an ally hero is within 400.', a:{allyRed:.15} },
    { id:'tank', n:'Armor Escort', d:'Casting R calls in a tank that rolls up the road.', a:{tankR:1} },
    { id:'band', n:'Long Barrel', d:'+120 attack range.', a:{range:120} },
    { id:'ration', n:'Scrounger', d:'Ration crates heal twice as much.', a:{crate:1} },
    { id:'sarge', n:'Field Promotion', d:'+20% damage on everything.', a:{dmg:.2} } ],
  [ { id:'jumbo', n:'Big Man', d:'+40% max health. You stand 25% taller.', a:{hpMul:.4, scale:.25} },
    { id:'magnifier', n:'Incendiary Rounds', d:'Ability hits set targets burning for 3 seconds.', a:{burn:1} },
    { id:'glow', n:'Second Wind', d:'Heal for 15% of all damage you deal.', a:{lifesteal:.15} },
    { id:'chrome', n:'Flak Vest', d:'Take 25% less damage.', a:{red:.25} },
    { id:'mold', n:'Veteran', d:'Abilities recharge 30% faster.', a:{haste:.3} } ]
];
var ORDER_LEVELS = [3, 7, 11, 15];

/* ---------------- Map ---------------- */
function vlen(x, y) { return Math.sqrt(x * x + y * y); }
function dist(a, b) { return vlen(a.x - b.x, a.y - b.y); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function rnd(a, b) { return a + Math.random() * (b - a); }
function seeded(s) { var x = s || 1; return function () { x = (x * 1664525 + 1013904223) % 4294967296; return x / 4294967296; }; }
var MAP = { A: { x: 360, y: 1560 }, B: { x: 2900, y: 360 }, half: 200, W: 3260, H: 1920 };
var LLEN = dist(MAP.A, MAP.B);
var LD = { x: (MAP.B.x - MAP.A.x) / LLEN, y: (MAP.B.y - MAP.A.y) / LLEN };
var LP = { x: -LD.y, y: LD.x };
var LANG = Math.atan2(LD.y, LD.x);
var LCX = (MAP.A.x + MAP.B.x) / 2, LCY = (MAP.A.y + MAP.B.y) / 2;
function lanePt(t, off) { off = off || 0; return { x: MAP.A.x + LD.x * LLEN * t + LP.x * off, y: MAP.A.y + LD.y * LLEN * t + LP.y * off }; }
function laneProj(p) { var dx = p.x - MAP.A.x, dy = p.y - MAP.A.y; return { t: (dx * LD.x + dy * LD.y) / LLEN, off: dx * LP.x + dy * LP.y }; }
function clampLane(p) { var q = laneProj(p); return lanePt(clamp(q.t, -0.07, 1.07), clamp(q.off, -MAP.half + 14, MAP.half - 14)); }
function fountain(team) { return team === 0 ? lanePt(-0.035, 0) : lanePt(1.035, 0); }
function progress(u) { var t = laneProj(u).t; return u.team === 0 ? t : 1 - t; }

/* Roadside props sit flush against the hedge (off + r > 172) so no unit can slip into a sliver behind them. */
var PROPS = [
  { kind: 'stump', t: 0.31, off: 150, r: 30 },
  { kind: 'stump', t: 0.69, off: -150, r: 30 },
  { kind: 'wall', t: 0.40, off: -150, r: 30, len: 170 },
  { kind: 'wall', t: 0.60, off: 150, r: 30, len: 170 },
  { kind: 'jeep', t: 0.50, off: 140, r: 36, len: 124 },
  { kind: 'cart', t: 0.50, off: -142, r: 32, len: 108 }
];
var PROP_C = [];
PROPS.forEach(function (p) {
  var q = lanePt(p.t, p.off); p.x = q.x; p.y = q.y;
  if (p.len) { var e = p.len / 2 - p.r; PROP_C.push({ x: p.x, y: p.y, r: p.r, h: e, ax: p.x - LD.x * e, ay: p.y - LD.y * e, bx: p.x + LD.x * e, by: p.y + LD.y * e, tag: p.kind }); }
  else PROP_C.push({ x: p.x, y: p.y, r: p.r, tag: p.kind });
});
var BRUSH = [ { t: 0.25, off: 150 }, { t: 0.75, off: -150 } ];
BRUSH.forEach(function (b) { var q = lanePt(b.t, b.off); b.x = q.x; b.y = q.y; b.rx = 125; b.ry = 62; });
function inBrush(p) {
  for (var i = 0; i < BRUSH.length; i++) {
    var b = BRUSH[i], dx = p.x - b.x, dy = p.y - b.y;
    var c = Math.cos(-LANG), s = Math.sin(-LANG), x = dx * c - dy * s, y = dx * s + dy * c;
    if ((x * x) / (b.rx * b.rx) + (y * y) / (b.ry * b.ry) < 1) return i;
  }
  return -1;
}

/* ---------------- Audio ---------------- */
var AC = null, AMaster = null, noiseB = null, sfxLast = {};
function audioInit() {
  if (AC) return;
  var Ctor = window.AudioContext || window.webkitAudioContext; if (!Ctor) return;
  try {
    AC = new Ctor(); AMaster = AC.createGain(); AMaster.gain.value = 0.55; AMaster.connect(AC.destination);
    var n = AC.sampleRate; noiseB = AC.createBuffer(1, n, AC.sampleRate); var d = noiseB.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
var SFX_GAP = { rifle: .03, mg: .03, hit: .05, boom: .08, flame: .1, melee: .05, cast: .05, cannon: .08, rocket: .1, ui: .05, shell: .1 };
function sfx(kind, x, y) {
  if (!AC || !opts.sound || !G) return;
  if (AC.state === 'suspended') { try { AC.resume(); } catch (e) {} }
  var t = AC.currentTime, last = sfxLast[kind] || 0;
  if (t - last < (SFX_GAP[kind] || .05)) return;
  sfxLast[kind] = t;
  var g = 1;
  if (x != null) { g = clamp(1 - vlen(x - cam.x, y - cam.y) / 1700, 0, 1); if (g <= 0.02) return; }
  var out = AC.createGain(); out.gain.value = 1; out.connect(AMaster);
  function noise(dur, type, freq, q, vol, decay) {
    var s = AC.createBufferSource(); s.buffer = noiseB; s.loop = true;
    var f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
    var e = AC.createGain(); e.gain.setValueAtTime(Math.max(0.001, vol * g), t); e.gain.exponentialRampToValueAtTime(0.001, t + decay);
    s.connect(f); f.connect(e); e.connect(out); s.start(t); s.stop(t + dur);
  }
  function tone(type, f0, f1, dur, vol) {
    var o = AC.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    var e = AC.createGain(); e.gain.setValueAtTime(Math.max(0.001, vol * g), t); e.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(e); e.connect(out); o.start(t); o.stop(t + dur);
  }
  switch (kind) {
    case 'rifle': noise(0.12, 'bandpass', 1600, 0.6, 0.7, 0.1); tone('triangle', 180, 40, 0.08, 0.25); break;
    case 'mg': noise(0.07, 'bandpass', 2200, 0.8, 0.45, 0.06); break;
    case 'cannon': noise(0.4, 'lowpass', 500, 1, 0.9, 0.35); tone('sine', 90, 30, 0.3, 0.6); break;
    case 'boom': noise(0.6, 'lowpass', 320, 1, 1.0, 0.5); tone('sine', 70, 25, 0.45, 0.7); break;
    case 'shell': tone('sine', 900, 200, 0.5, 0.12); break;
    case 'rocket': noise(0.3, 'bandpass', 900, 0.5, 0.35, 0.3); break;
    case 'flame': noise(0.2, 'lowpass', 1200, 0.7, 0.25, 0.18); break;
    case 'melee': noise(0.08, 'bandpass', 600, 1, 0.4, 0.07); break;
    case 'hit': tone('square', 700, 300, 0.04, 0.16); break;
    case 'cast': tone('sine', 420, 840, 0.09, 0.2); break;
    case 'ui': tone('sine', 600, 600, 0.05, 0.15); break;
  }
}
