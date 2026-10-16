/* Shared game data: used by the browser client and the game server. */

var TEAMC = [
  { c1:'#8FA960', c2:'#536E2E', c3:'#2C3D18', ol:'#141A0B', ui:'#4E6B2A', hi:'#9DB464', bar:'#6C8C38' },
  { c1:'#D8C494', c2:'#A88B55', c3:'#6B5330', ol:'#2A1E0E', ui:'#B99A62', hi:'#E0C890', bar:'#C9A866' }
];

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
/* Tuning pass: ability cooldowns are 30% shorter and the gap between basic shots 20% shorter (the hero table above keeps the design numbers). */
var TUNE = { cdMul: 0.7, acdMul: 0.8 };
HEROES.forEach(function (h) {
  h.acd = Math.round(h.acd * TUNE.acdMul * 100) / 100;
  ['Q', 'W', 'E', 'R'].forEach(function (k) { if (h[k] && h[k].cd) h[k].cd = Math.round(h[k].cd * TUNE.cdMul * 10) / 10; });
});
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

/* The Sandbox: the painted 4K map is the world, one world unit per map pixel. Green holds the sand fort bottom-left, Tan the fort top-right.
   Three lanes (top, mid, bottom) are polylines with a half-width per point; the walkable field is the union of those capsules plus the two fort yards.
   Everything else in the painting (hills, trenches, sandbag walls, barrels) is simply not walkable. */
var MAP = { W: 3840, H: 2160 };
var FOUNT = [{ x: 620, y: 1620 }, { x: 3350, y: 330 }];
var LANE_DEF = [
  { name: 'top', pts: [[620, 1620, 110], [660, 1400, 110], [600, 1200, 105], [520, 1040, 100], [500, 880, 100], [580, 700, 100], [780, 520, 100], [1040, 540, 100], [1240, 420, 100], [1400, 320, 100], [1600, 300, 100], [1800, 240, 100], [2000, 250, 90], [2200, 340, 80], [2420, 380, 90], [2600, 310, 100], [2800, 260, 100], [2960, 260, 100], [3150, 300, 110], [3350, 330, 110]] },
  { name: 'mid', pts: [[620, 1620, 120], [830, 1500, 120], [1040, 1470, 120], [1250, 1330, 120], [1500, 1200, 120], [1750, 1080, 120], [2000, 1000, 120], [2110, 960, 120], [2300, 880, 120], [2500, 790, 120], [2700, 700, 120], [2900, 610, 120], [3100, 540, 120], [3220, 480, 120], [3300, 400, 120], [3350, 330, 120]] },
  { name: 'bot', pts: [[620, 1620, 110], [830, 1500, 110], [1120, 1490, 105], [1330, 1560, 95], [1520, 1610, 90], [1700, 1630, 85], [1900, 1650, 85], [2100, 1760, 95], [2300, 1800, 100], [2500, 1740, 100], [2650, 1620, 100], [2800, 1510, 100], [2900, 1480, 100], [3100, 1490, 100], [3240, 1320, 100], [3320, 1160, 100], [3350, 1000, 100], [3400, 850, 100], [3380, 700, 100], [3300, 580, 100], [3220, 480, 110], [3300, 400, 110], [3350, 330, 110]] }
];
/* extra walkable pieces: the fort yards, so heroes can move about their base */
var FIELD_EXTRA = [
  { ax: 380, ay: 1360, bx: 760, by: 1720, r: 250 }, { ax: 3050, ay: 250, bx: 3600, by: 440, r: 240 },
  { ax: 900, ay: 1480, bx: 1300, by: 1450, r: 170 }, { ax: 3060, ay: 440, bx: 3230, by: 500, r: 120 },
  { ax: 1060, ay: 520, bx: 1270, by: 1270, r: 90 }   // the rut between the left tower ring and the centre hill, joining the top and mid lanes
];
var LANES = LANE_DEF.map(function (d, li) {
  var pts = d.pts.map(function (p) { return { x: p[0], y: p[1], r: p[2] }; }), cum = [0];
  for (var i = 1; i < pts.length; i++) cum.push(cum[i - 1] + vlen(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { i: li, name: d.name, pts: pts, cum: cum, len: cum[cum.length - 1] };
});
var FIELD_CAPS = [];
LANES.forEach(function (L) { for (var i = 0; i < L.pts.length - 1; i++) { var a = L.pts[i], b = L.pts[i + 1]; FIELD_CAPS.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, r: Math.min(a.r, b.r), lane: L.i }); } });
FIELD_EXTRA.forEach(function (c) { FIELD_CAPS.push({ ax: c.ax, ay: c.ay, bx: c.bx, by: c.by, r: c.r, lane: -1 }); });
FIELD_CAPS.forEach(function (c) { c.minx = Math.min(c.ax, c.bx) - c.r; c.maxx = Math.max(c.ax, c.bx) + c.r; c.miny = Math.min(c.ay, c.by) - c.r; c.maxy = Math.max(c.ay, c.by) + c.r; });
/* bucket grid so a field query only looks at the few capsules nearby (a point more than FB_REACH outside every capsule reads as far outside) */
var FB_SIZE = 256, FB_REACH = 200, FB_NX = Math.ceil(MAP.W / FB_SIZE) + 1, FB_NY = Math.ceil(MAP.H / FB_SIZE) + 1, FB = [];
for (var fbi = 0; fbi < FB_NX * FB_NY; fbi++) FB.push([]);
FIELD_CAPS.forEach(function (c) {
  var x0 = Math.max(0, Math.floor((c.minx - FB_REACH) / FB_SIZE)), x1 = Math.min(FB_NX - 1, Math.floor((c.maxx + FB_REACH) / FB_SIZE));
  var y0 = Math.max(0, Math.floor((c.miny - FB_REACH) / FB_SIZE)), y1 = Math.min(FB_NY - 1, Math.floor((c.maxy + FB_REACH) / FB_SIZE));
  for (var i = x0; i <= x1; i++) for (var j = y0; j <= y1; j++) FB[i * FB_NY + j].push(c);
});
function fieldBucket(x, y) {
  var i = Math.floor(x / FB_SIZE), j = Math.floor(y / FB_SIZE);
  if (i < 0 || j < 0 || i >= FB_NX || j >= FB_NY) return null;
  return FB[i * FB_NY + j];
}

function capDist(c, x, y) {
  var dx = c.bx - c.ax, dy = c.by - c.ay, L2 = dx * dx + dy * dy, t = L2 ? ((x - c.ax) * dx + (y - c.ay) * dy) / L2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return vlen(x - c.ax - dx * t, y - c.ay - dy * t);
}
/* signed distance to the edge of the walkable field: positive inside */
function fieldSD(x, y) {
  var best = -1e9, list = fieldBucket(x, y);
  if (!list) return best;
  for (var i = 0; i < list.length; i++) {
    var c = list[i];
    if (x < c.minx - 200 || x > c.maxx + 200 || y < c.miny - 200 || y > c.maxy + 200) continue;
    var v = c.r - capDist(c, x, y); if (v > best) best = v;
  }
  return best;
}
/* the capsule that holds (or is nearest to) a point, with the closest point on its spine */
function fieldNearest(x, y) {
  var best = null, bv = -1e9, list = fieldBucket(x, y);
  if (!list || !list.length) list = FIELD_CAPS;
  for (var i = 0; i < list.length; i++) {
    var c = list[i], v = c.r - capDist(c, x, y);
    if (v > bv) { bv = v; best = c; }
  }
  var dx = best.bx - best.ax, dy = best.by - best.ay, L2 = dx * dx + dy * dy, t = L2 ? ((x - best.ax) * dx + (y - best.ay) * dy) / L2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return { cap: best, sd: bv, cx: best.ax + dx * t, cy: best.ay + dy * t };
}
/* pull a point inside the field, keeping `margin` from the edge */
function clampField(p, margin) {
  margin = margin == null ? 14 : margin;
  if (fieldSD(p.x, p.y) >= margin) return { x: p.x, y: p.y };
  var n = fieldNearest(p.x, p.y), dx = p.x - n.cx, dy = p.y - n.cy, d = vlen(dx, dy);
  if (d < 0.01) { dx = 0; dy = 1; d = 1; }
  var k = Math.max(0, n.cap.r - margin) / d;
  return { x: n.cx + dx * k, y: n.cy + dy * k };
}
function clampLane(p) { return clampField(p, 14); }

/* lane parametrisation: t runs 0 (Green fort) .. 1 (Tan fort) along the lane's arc length, off is sideways */
function lanePt(t, off, li) {
  var L = LANES[li == null ? 1 : li], s = clamp(t, 0, 1) * L.len, pts = L.pts, i = 1;
  while (i < pts.length - 1 && L.cum[i] < s) i++;
  var a = pts[i - 1], b = pts[i], segL = L.cum[i] - L.cum[i - 1] || 1, f = (s - L.cum[i - 1]) / segL;
  var dx = (b.x - a.x) / segL, dy = (b.y - a.y) / segL;
  off = off || 0;
  return { x: a.x + (b.x - a.x) * f - dy * off, y: a.y + (b.y - a.y) * f + dx * off };
}
function laneProj(p, li) {
  var L = LANES[li == null ? 1 : li], pts = L.pts, bd = 1e18, bt = 0, boff = 0;
  for (var i = 0; i < pts.length - 1; i++) {
    var a = pts[i], b = pts[i + 1], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy, t = L2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var qx = p.x - a.x - dx * t, qy = p.y - a.y - dy * t, d2 = qx * qx + qy * qy;
    if (d2 < bd) { bd = d2; var segL = Math.sqrt(L2) || 1; bt = (L.cum[i] + t * segL) / L.len; boff = (-dy * qx + dx * qy) / segL; }
  }
  return { t: bt, off: boff, d: Math.sqrt(bd) };
}
function nearestLane(p) { var best = 1, bd = 1e18; for (var i = 0; i < LANES.length; i++) { var d = laneProj(p, i).d; if (d < bd) { bd = d; best = i; } } return best; }
function laneOf(u) { return u.lane != null ? u.lane : nearestLane(u); }
function fountain(team) { return FOUNT[team]; }
function progress(u) { var t = laneProj(u, laneOf(u)).t; return u.team === 0 ? t : 1 - t; }

/* Turrets: three per lane per team (outer, middle, inner), each a sandbag pillbox. Every turret sits at the same lane position for both teams,
   mirrored along the lane (green 0.42 / 0.30 / 0.17, tan 0.58 / 0.70 / 0.83) and on the same side of the lane, so the two forts line up. */
var STRUCT_DEF = [];
LANES.forEach(function (L) {
  // one offset per lane slot, shared by both teams, so the two forts match; moved in toward the spine until both spots are at least 24 units inside the walkable field
  [[1, 0.42, 0.58], [2, 0.3, 0.7], [3, 0.17, 0.83]].forEach(function (k) {
    var side0 = L.name === 'top' ? 1 : L.name === 'bot' ? -1 : (k[0] % 2 ? 1 : -1), side = side0;
    var pos = function (t, off) {
      var q = lanePt(t, 0, L.i), q2 = lanePt(t + 0.002, 0, L.i), dx = q2.x - q.x, dy = q2.y - q.y, len = vlen(dx, dy) || 1;
      return { x: Math.round(q.x - dy / len * side * off), y: Math.round(q.y + dx / len * side * off) };
    };
    var r = 0; L.pts.forEach(function (p, i) { if (L.cum[i] <= k[1] * L.len) r = p.r; });
    var off = r + 64, a, b, ok = false;
    // prefer the usual side and the largest offset; the opposite side is tried only if the usual one has no walkable spot
    [side0, -side0].some(function (sd) {
      side = sd;
      for (off = r + 64; off >= 0; off -= 2) {
        a = pos(k[1], off); b = pos(k[2], off);
        if (fieldSD(a.x, a.y) >= 24 && fieldSD(b.x, b.y) >= 24) return (ok = true);
      }
      return false;
    });
    [[0, k[1], a], [1, k[2], b]].forEach(function (e) {
      STRUCT_DEF.push({ team: e[0], lane: L.i, kind: 'outpost', order: k[0], x: e[2].x, y: e[2].y, t: e[1], painted: null });
    });
  });
});
STRUCT_DEF.push({ team: 0, lane: -1, kind: 'hq', order: 4, x: 500, y: 1440, t: 0 });
STRUCT_DEF.push({ team: 1, lane: -1, kind: 'hq', order: 4, x: 3450, y: 200, t: 1 });
/* fort towers that are not structures but still block movement */
var PROPS = [];
var PROP_C = [
  { x: 330, y: 1270, r: 60, tag: 'tower' }, { x: 930, y: 1650, r: 60, tag: 'tower' }, { x: 720, y: 1910, r: 60, tag: 'tower' },
  { x: 2960, y: 250, r: 60, tag: 'tower' }, { x: 3600, y: 550, r: 60, tag: 'tower' }, { x: 3130, y: 290, r: 45, tag: 'tower' }
];
/* weeds: hiding spots on the painted grass tufts */
var BRUSH = [ { x: 1570, y: 960, rx: 130, ry: 70 }, { x: 2320, y: 1480, rx: 130, ry: 70 }, { x: 2660, y: 1240, rx: 120, ry: 65 }, { x: 1280, y: 430, rx: 110, ry: 60 } ];
function inBrush(p) {
  for (var i = 0; i < BRUSH.length; i++) {
    var b = BRUSH[i], dx = p.x - b.x, dy = p.y - b.y;
    if (dx > b.rx || dx < -b.rx || dy > b.ry || dy < -b.ry) continue;
    if ((dx * dx) / (b.rx * b.rx) + (dy * dy) / (b.ry * b.ry) < 1) return i;
  }
  return -1;
}
var CRATE_DEF = [[2110, 960], [1950, 190], [2300, 1800]];
