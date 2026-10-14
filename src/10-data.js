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
var BR_C = Math.cos(-LANG), BR_S = Math.sin(-LANG);
function inBrush(p) {
  for (var i = 0; i < BRUSH.length; i++) {
    var b = BRUSH[i], dx = p.x - b.x, dy = p.y - b.y;
    if (dx > b.rx || dx < -b.rx || dy > b.rx || dy < -b.rx) continue;
    var x = dx * BR_C - dy * BR_S, y = dx * BR_S + dy * BR_C;
    if ((x * x) / (b.rx * b.rx) + (y * y) / (b.ry * b.ry) < 1) return i;
  }
  return -1;
}
