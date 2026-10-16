/* Shared simulation core: runs in the browser (offline) and on the game server. No DOM access. */

/* ---------------- State (shared by browser client and game server) ---------------- */
var G = null, uid = 1;
var opts = { ranges: false, god: false, nocd: false, passive: false, pause: false, speed: 1, sound: true, col: false };

/* roster: [{ team, hero, human, name, pid }]; returns G. Used offline and by the server. */
function simNewGame(roster) {
  uid = 1;
  G = { time: 0, units: [], structs: [], proj: [], lobs: [], mines: [], fx: [], texts: [], kills: [0, 0], nextWave: 3, wave: 0, stash: [],
    crates: [], over: false, winner: -1, barrage: null, player: null, feed: [], toastT: 0, hurtT: 0, blockers: [], moveMark: null, rounds: [], shake: 0, ev: [] };
  makeStructs();
  makeCrates();
  var slots = [0, 0];
  roster.forEach(function (r) {
    var u = addHero(HEROES[r.hero], r.team, !!r.human, slots[r.team]++);
    if (r.name) u.pname = r.name;
    if (r.pid != null) u.pid = r.pid;
    r.uid = u.id;
  });
  rebuildBlockers();
  return G;
}
function makeStructs() { STRUCT_DEF.forEach(addStruct); }
function makeCrates() { CRATE_DEF.forEach(function (c) { G.crates.push({ x: c[0], y: c[1], up: true, t: 0 }); }); }
function range16() { var a = []; for (var i = 0; i < HEROES.length; i++) a.push(i); return a; }
function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function rebuildBlockers() {
  G.blockers = PROP_C.slice();
  G.structs.forEach(function (s) { if (!s.dead) G.blockers.push({ x: s.x, y: s.y, r: s.kind === 'hq' ? s.r * 0.85 : s.r * 0.7, tag: s.kind }); });
  NAV.ver++;
}
function addStruct(d) {
  var kind = d.kind;
  var s = { id: uid++, isStruct: true, kind: kind, team: d.team, order: d.order, lane: d.lane, x: d.x, y: d.y, t: d.t, painted: d.painted || null,
    maxHp: kind === 'hq' ? 4600 : 2300, range: kind === 'hq' ? 420 : 400,
    dmg: kind === 'hq' ? 190 : 155, acd: 1.05, aaT: 0, r: kind === 'hq' ? 120 : 48,
    dead: false, target: null, heat: 0, respawn: 0, flashT: 0, recoilT: 0 };
  s.hp = s.maxHp;
  G.structs.push(s);
}
function addHero(spec, team, isPlayer, slot) {
  var f = fountain(team);
  var u = { id: uid++, kind: 'hero', team: team, spec: spec, pose: spec.key, name: spec.name, isPlayer: isPlayer, bot: !isPlayer,
    x: f.x + (slot - 2) * 44, y: f.y + (slot % 2 ? 36 : -36), r: 22, lvl: 3, xp: 0, dead: false, respawn: 0, lane: isPlayer ? null : [1, 0, 2, 0, 2][slot % 5],
    cd: { Q: 0, W: 0, E: 0, R: 0, D: 0, F: 0 }, cdMax: { Q: 1, W: 1, E: 1, R: 1, D: 1, F: 1 }, buffs: [], shield: 0, shieldT: 0, aug: {}, augs: [], ordersDone: 0,
    target: null, move: null, amove: null, facing: team === 0 ? 1 : -1, slowT: 0, slowAmt: 0, kvx: 0, kvy: 0, aaT: 0, burnT: 0, burnDps: 0,
    dash: null, cone: null, chan: null, tagMark: null, iframe: 0, aggroT: 0, kills: 0, deaths: 0, think: 0, retreat: false, offer: null, deathT: 0,
    walk: 0, movedT: 0, recoilT: 0, flashT: 0, fireT: 0, stagT: 0, lungeT: 0,
    cash: 0, st: { k: 0, d: 0, a: 0, cs: 0, dmgH: 0, dmgS: 0, taken: 0, heal: 0, mit: 0, pos: 0, streak: 0, best: 0, cash: 0 }, dmgBy: {}, dmgLog: [] };
  u.hp = maxHp(u);
  G.units.push(u);
  return u;
}
function addMinion(team, type, lane) {
  if (lane == null) lane = 1;
  var p = lanePt(team === 0 ? 0.05 : 0.95, rnd(-40, 40), lane);
  var S = {
    melee: { hp: 400, dmg: 20, range: 70, acd: 1.0, spd: 155, r: 15, h: 64, pose: 'm_melee' },
    rifle: { hp: 280, dmg: 15, range: 320, acd: 1.15, spd: 155, r: 14, h: 64, pose: 'm_rifle' },
    mortar: { hp: 360, dmg: 44, range: 520, acd: 2.2, spd: 140, r: 15, h: 64, pose: 'm_mortar', smul: 1.6 },
    tank: { hp: 1400, dmg: 55, range: 300, acd: 1.7, spd: 120, r: 28, h: 0, pose: null, smul: 2 },
    jeep: { hp: 950, dmg: 40, range: 170, acd: 1.0, spd: 180, r: 24, h: 0, pose: null, smul: 1.5 }
  }[type];
  var m = { id: uid++, kind: 'minion', type: type, team: team, lane: lane, x: p.x, y: p.y, maxHp: S.hp, hp: S.hp, dmg: S.dmg, range: S.range, acd: S.acd,
    spd: S.spd, r: S.r, h: S.h, pose: S.pose, smul: S.smul || 1, aaT: rnd(0, 0.5), target: null, dead: false, facing: team === 0 ? 1 : -1,
    slowT: 0, slowAmt: 0, kvx: 0, kvy: 0, burnT: 0, burnDps: 0, buffs: [], shield: 0, deathT: 0, aim: 0, walk: 0, movedT: 0, recoilT: 0, flashT: 0 };
  G.units.push(m);
  return m;
}
function spawnWave() {
  G.wave++;
  emit('wave', G.wave);
  [0, 1].forEach(function (team) {
    for (var lane = 0; lane < LANES.length; lane++) {
      for (var i = 0; i < 2; i++) addMinion(team, 'melee', lane);
      for (var k = 0; k < 2; k++) addMinion(team, 'rifle', lane);
      var fallen = G.structs.filter(function (s) { return s.team === 1 - team && s.lane === lane && s.kind === 'outpost' && s.dead; }).length;
      var extra = Math.min(RAMP.max, fallen * RAMP.perTurret);
      for (var x = 0; x < extra; x++) addMinion(team, 'rifle', lane);
      if (G.wave % 3 === 0) addMinion(team, (G.wave / 3) % 3 === lane ? 'tank' : 'mortar', lane);
      if (laneOpen(1 - team, lane)) addMinion(team, 'jeep', lane);
    }
  });
}

/* ---------------- Stats ---------------- */
function lvlMul(u) { return 1 + 0.065 * ((u.lvl || 3) - 3); }
function sumBuff(u, k) { var s = 0; for (var i = 0; i < u.buffs.length; i++) if (u.buffs[i][k]) s += u.buffs[i][k]; return s; }
function maxHp(u) { if (u._mh) return u._mh; if (u.kind !== 'hero') return u.maxHp; return Math.round((u.spec.hp * (1 + 0.08 * (u.lvl - 3)) + (u.aug.hp || 0)) * (1 + (u.aug.hpMul || 0))); }
function moveSpeed(u) {
  if (sumBuff(u, 'root') > 0 || (u.cone && u.cone.root)) return 0;
  var base = u.kind === 'hero' ? u.spec.spd : u.spd;
  var m = 1 + sumBuff(u, 'ms') + ((u.aug && u.aug.ms) || 0);
  return base * m * (1 - (u.slowT > 0 ? u.slowAmt : 0));
}
function aaRange(u) { if (u._rng) return u._rng; if (u.kind !== 'hero') return u.range; return u.spec.range + sumBuff(u, 'range') + (u.aug.range || 0); }
function dmgMul(u) { return (u.kind === 'hero' ? lvlMul(u) * (1 + (u.aug.dmg || 0)) : 1) * (1 + sumBuff(u, 'dmgMul')); }
function aaDmg(u) { if (u.kind !== 'hero') return u.dmg; return (u.spec.dmg + (u.aug.aa || 0)) * dmgMul(u); }
function aaCd(u) { if (u._acd) return u._acd; if (u.kind !== 'hero') return u.acd; return u.spec.acd / (1 + sumBuff(u, 'as') + (u.aug.as || 0)); }
function cdMul(u, slot) { var h = (u.aug.haste || 0) + (slot === 'Q' ? (u.aug.cdQ || 0) : 0); return 1 / (1 + h); }
function heroH(u) { return Math.round(118 * (1 + ((u.aug && u.aug.scale) || 0))); }
function unitH(u) { return u.kind === 'hero' ? heroH(u) : (u.type === 'tank' ? 60 : u.type === 'jeep' ? 56 : u.h); }
function isGhost(u) { return sumBuff(u, 'ghost') > 0; }
function visibleTo(u, team) {
  if (u._hidden) return false;
  if (u.isStruct || u.team === team) return true;
  if (u.dead) return false;
  if (isGhost(u)) return false;
  if (inBrush(u) < 0) return true;
  for (var i = 0; i < G.units.length; i++) { var o = G.units[i]; if (o.team === team && !o.dead && dist(o, u) < 240) return true; }
  return false;
}
/* a lane is open once every turret the team has on it is down */
function laneOpen(team, lane) { for (var i = 0; i < G.structs.length; i++) { var o = G.structs[i]; if (o.team === team && o.kind === 'outpost' && o.lane === lane && !o.dead) return false; } return true; }
function targetable(s) {
  if (s.dead) return false;
  if (s.kind === 'hq') { for (var l = 0; l < LANES.length; l++) if (laneOpen(s.team, l)) return true; return false; }
  for (var i = 0; i < G.structs.length; i++) { var o = G.structs[i]; if (o.team === s.team && o.lane === s.lane && !o.dead && o.order < s.order) return false; }
  return true;
}

/* ---------------- Damage ---------------- */
function damage(src, tgt, amt, o) {
  o = o || {};
  if (!tgt || tgt.dead || amt <= 0) return;
  if (tgt.isStruct) {
    if (!targetable(tgt)) return;
    amt *= (o.smul || (src && src.smul) || 1);
  } else {
    if (tgt.isPlayer && opts.god) return;
    if (o.proj && tgt.iframe > 0) return;
    var red = sumBuff(tgt, 'dmgRed');
    if (tgt.kind === 'hero') {
      red += tgt.aug.red || 0;
      if (tgt.aug.allyRed && G.units.some(function (a) { return a !== tgt && a.kind === 'hero' && a.team === tgt.team && !a.dead && dist(a, tgt) < 400; })) red += tgt.aug.allyRed;
    }
    amt *= Math.max(0.3, 1 - red);
    if (tgt.shield > 0) { var ab = Math.min(tgt.shield, amt); tgt.shield -= ab; amt -= ab; if (tgt.st) tgt.st.mit += ab; }
    if (o.slow) { tgt.slowT = 1.6; tgt.slowAmt = Math.max(tgt.slowT > 0 ? tgt.slowAmt : 0, o.slow); }
    if (o.knock && src) { var dx = tgt.x - (o.fx != null ? o.fx : src.x), dy = tgt.y - (o.fy != null ? o.fy : src.y), L = vlen(dx, dy) || 1; tgt.kvx += dx / L * o.knock; tgt.kvy += dy / L * o.knock; }
    if (o.pull && src) { var px = src.x - tgt.x, py = src.y - tgt.y, PL = vlen(px, py) || 1; tgt.kvx += px / PL * 620; tgt.kvy += py / PL * 620; }
    if ((o.burn || (src && src.aug && src.aug.burn && o.ability)) && tgt.kind) { tgt.burnT = 3; tgt.burnDps = 30; tgt.burnSrc = src; }
  }
  var dealt = Math.min(amt, Math.max(0, tgt.hp));
  if (src && src.kind === 'hero' && src.team !== tgt.team) { if (tgt.kind === 'hero') src.st.dmgH += dealt; else if (tgt.isStruct) src.st.dmgS += dealt; }
  if (tgt.kind === 'hero') { tgt.st.taken += dealt; if (src && src.kind === 'hero') tgt.dmgBy[src.id] = G.time; if (dealt > 0) logDmg(tgt, src, dealt, o); }
  tgt.hp -= amt;
  if (src && src.kind === 'hero') {
    var ls = (o.aa ? sumBuff(src, 'lifesteal') : 0) + (src.aug.lifesteal || 0);
    if (ls > 0 && !src.dead) { var hl = Math.max(0, Math.min(maxHp(src) - src.hp, amt * ls)); src.hp += hl; src.st.heal += hl; }
    if (tgt.kind === 'hero') { src.aggroT = 2; tgt.lastHit = src; tgt.lastHitT = 8; }
  }
  if (!o.tick) emit('dmg', tgt.id, src ? src.id : 0, Math.round(amt));
  if (o.exec && !tgt.isStruct && tgt.hp > 0 && tgt.hp / (tgt.kind === 'hero' ? maxHp(tgt) : tgt.maxHp) < o.exec) tgt.hp = 0;
  if (tgt.hp <= 0) kill(src, tgt);
}
/* Stash at the HQ: a hero within reach of its own fort can deposit cash, and anyone on the team can take a stash out for STASH_CUT. */
function atHq(u) { var hq = G.structs.find(function (s) { return s.kind === 'hq' && s.team === u.team && !s.dead; }); return hq && dist(u, hq) < 520 ? hq : null; }
function depositCash(u, amt) { amt = Math.floor(amt); if (u.dead || !atHq(u) || amt <= 0 || amt > u.cash) return false; u.cash -= amt; G.stash.push({ owner: u.id, team: u.team, amt: amt }); return true; }
function withdrawCash(u, idx) { var e = G.stash[idx]; if (!e || u.dead || e.team !== u.team || !atHq(u)) return false; G.stash.splice(idx, 1); u.cash += Math.floor(e.amt * STASH_CUT); return true; }
/* At the buzzer, cash in hand and stashed cash count at face value into each hero's stats. */
function tallyCash() { G.units.forEach(function (u) { if (u.kind !== 'hero') return; var st = 0; G.stash.forEach(function (e) { if (e.owner === u.id) st += e.amt; }); u.st.cash = u.cash + st; }); }
function kill(src, tgt) {
  if (tgt.dead) return;
  tgt.dead = true; tgt.hp = 0; tgt.deathT = 0;
  if (tgt.isStruct) {
    var label = (tgt.team === 0 ? 'Green ' : 'Tan ') + (tgt.kind === 'hq' ? 'fort' : (['top', 'mid', 'bottom'][tgt.lane] || '') + ' ' + (tgt.order === 1 ? 'outer' : tgt.order === 2 ? 'middle' : 'inner') + ' turret');
    feed(label + ' destroyed', tgt.team === 0 ? 'ft' : 'fg');
    emit('struct', tgt.id, tgt.team, tgt.kind, src && src.kind === 'hero' ? src.id : 0, tgt.lane, tgt.order);
    chips(tgt.x, tgt.y - 30, tgt.team, 30, 1.6);
    fx({ k: 'boom', x: tgt.x, y: tgt.y, r: tgt.r * 2, t: 0, dur: 0.6 });
    sfx('boom', tgt.x, tgt.y);
    if (src && src.kind === 'hero') { src.st.pos++; src.cash += CASH.turret + CASH.perOrder * (tgt.order - 1); }
    shakeAt(tgt.x, tgt.y, 9);
    rebuildBlockers();
    if (tgt.kind === 'hq') { G.over = true; G.winner = 1 - tgt.team; emit('end', G.winner); }
    return;
  }
  chips(tgt.x, tgt.y - 20, tgt.team, tgt.kind === 'hero' ? 16 : 5, 1);
  if (tgt.kind === 'minion') {
    if (tgt.type === 'tank' || tgt.type === 'jeep') { fx({ k: 'boom', x: tgt.x, y: tgt.y, r: 80, t: 0, dur: 0.5 }); sfx('boom', tgt.x, tgt.y); }
    G.units.forEach(function (h) { if (h.kind === 'hero' && h.team !== tgt.team && !h.dead && dist(h, tgt) < 1000) giveXp(h, 32); });
    if (src && src.kind === 'hero' && src.team !== tgt.team) { src.st.cs++; src.cash += CASH.cs; }
    return;
  }
  tgt.deaths++; tgt.st.d++; tgt.st.streak = 0;
  tgt.respawn = 6 + tgt.lvl * 1.1;
  tgt.buffs = []; tgt.shield = 0; tgt.dash = null; tgt.cone = null; tgt.chan = null; tgt.target = null; tgt.move = null; tgt.amove = null;
  var killer = src && src.kind === 'hero' ? src : (tgt.lastHitT > 0 ? tgt.lastHit : null);
  G.kills[1 - tgt.team]++;
  if (killer && killer.team !== tgt.team) {
    emit('kill', killer.id, tgt.id, nm(tgt), killer.st.streak + 1);
    killer.kills++; killer.st.k++; killer.cash += CASH.hero + CASH.perLvl * tgt.lvl; killer.st.streak++; killer.st.best = Math.max(killer.st.best, killer.st.streak); giveXp(killer, 220);
    Object.keys(tgt.dmgBy).forEach(function (id) {
      if (G.time - tgt.dmgBy[id] > 10) return;
      var h = G.units.find(function (x) { return String(x.id) === id; });
      if (h && h !== killer && h.team === killer.team) { h.st.a++; h.cash += CASH.assist; }
    });
    if (killer.st.streak === 3 || killer.st.streak === 5) feed(nm(killer) + (killer.st.streak === 3 ? ' is on a tear (3 straight)' : ' is unstoppable (5 straight)'), killer.team === 0 ? 'fg' : 'ft');
    G.units.forEach(function (h) { if (h !== killer && h.kind === 'hero' && h.team === killer.team && !h.dead && dist(h, tgt) < 1100) giveXp(h, 90); });
  }
  tgt.dmgBy = {};
  var recap = dmgRecap(tgt); tgt.dmgLog = [];
  var by = killer && killer.team !== tgt.team ? nm(killer) : (src && src.isStruct ? 'a sand turret' : src && src.kind === 'minion' ? 'the line' : 'the sprinkler');
  feed(by + ' eliminated ' + nm(tgt), tgt.team === 0 ? 'ft' : 'fg');
  emit('kia', tgt.id, Math.ceil(tgt.respawn), tgt.team, killer && killer.team !== tgt.team ? killer.id : 0, recap);
}
/* Rolling log of damage a hero took (last 12 s), for the death recap. Entries: [srcId, kindCode, label, team, weapon, amount, hits, firstT, lastT]. */
function logDmg(tgt, src, amt, o) {
  var L = tgt.dmgLog || (tgt.dmgLog = []), now = G.time;
  var w = o.n || (o.aa || (src && src.isStruct) ? 'aa' : o.tick ? 'Burn' : 'Ability');
  var id = src ? src.id : 0, kc = !src ? 'e' : src.isStruct ? 's' : src.kind === 'minion' ? 'm' : 'h';
  var label = !src ? (G.barrage ? 'Sprinkler' : 'Hazard') : src.isStruct ? (src.kind === 'hq' ? 'Fort' : 'Sand turret') : src.kind === 'minion' ? (src.type === 'tank' ? 'Toy tank' : src.type === 'jeep' ? 'Jeep' : src.type === 'mortar' ? 'Mortar crew' : 'Reserves') : nm(src);
  if (kc === 'm') id = -1 - src.team;
  var last = L[L.length - 1];
  if (last && last[0] === id && last[4] === w && now - last[8] < 0.6) { last[5] += amt; last[6]++; last[8] = now; }
  else { L.push([id, kc, label, src ? src.team : -1, w, amt, 1, now, now]); if (L.length > 40) L.splice(0, L.length - 40); }
}
function dmgRecap(tgt) {
  var L = (tgt.dmgLog || []).filter(function (r) { return G.time - r[8] < 12; });
  if (!L.length) return null;
  var by = {}, order = [], t0 = Infinity, total = 0;
  L.forEach(function (r) {
    var k = String(r[0]), g = by[k];
    if (!g) { g = by[k] = { id: r[0], kc: r[1], label: r[2], team: r[3], amt: 0, hits: 0, w: {}, last: 0 }; order.push(g); }
    g.amt += r[5]; g.hits += r[6]; g.w[r[4]] = (g.w[r[4]] || 0) + r[5]; g.last = Math.max(g.last, r[8]);
    t0 = Math.min(t0, r[7]); total += r[5];
  });
  order.sort(function (a, b) { return b.amt - a.amt; });
  var kb = L[L.length - 1];
  return { win: Math.round((G.time - t0) * 10) / 10, tot: Math.round(total), kb: [kb[0], kb[4]],
    rows: order.slice(0, 6).map(function (g) { return [g.id, g.kc, g.label, g.team, Math.round(g.amt), g.hits, Object.keys(g.w).sort(function (a, b) { return g.w[b] - g.w[a]; }).map(function (w) { return [w, Math.round(g.w[w])]; })]; }) };
}
/* While reinforcing, a hero may come back as a different figure. Level, XP, Field Orders and stats carry over; the kit resets. */
function canSwapTo(u, idx) {
  if (!u || u.kind !== 'hero' || !u.dead || G.over) return false;
  var spec = HEROES[idx]; if (!spec || spec === u.spec) return false;
  for (var i = 0; i < G.units.length; i++) { var o = G.units[i]; if (o !== u && o.kind === 'hero' && o.team === u.team && o.spec === spec) return false; }
  return true;
}
function swapHero(u, idx) {
  if (!canSwapTo(u, idx)) return false;
  var spec = HEROES[idx], was = nm(u);
  u.spec = spec; u.pose = spec.key; u.name = spec.name;
  u.cd = { Q: 0, W: 0, E: 0, R: 0, D: 0, F: 0 }; u.cdMax = { Q: 1, W: 1, E: 1, R: 1, D: 1, F: 1 };
  u.buffs = []; u.shield = 0; u.tagMark = null; u.dash = null; u.cone = null; u.chan = null; u.target = null; u.move = null; u.amove = null; u.wind = null; u.aimPt = null;
  u._mh = u._rng = u._acd = null; u.swaps = (u.swaps || 0) + 1;
  u.hp = maxHp(u);
  feed(was + ' will return as the ' + spec.name, u.team === 0 ? 'fg' : 'ft');
  emit('swap', u.id, idx);
  return true;
}
function giveXp(h, n) {
  h.xp += n;
  while (h.lvl < 18 && h.xp >= xpNeed(h.lvl)) {
    h.xp -= xpNeed(h.lvl);
    var before = maxHp(h); h.lvl++; h.hp += maxHp(h) - before;
    emit('lvl', h.id, h.lvl);
  }
}
function xpNeed(l) { return 160 + 55 * l; }
function ordersOwed(u) { var n = 0; ORDER_LEVELS.forEach(function (l) { if (u.lvl >= l) n++; }); return n - u.ordersDone; }
function atBase(u) { return u.dead || dist(u, fountain(u.team)) < 360; }

/* ---------------- Events: the sim never draws. The client turns these into visuals and sound. ---------------- */
function emit() { var a = Array.prototype.slice.call(arguments); G.ev.push(a); if (G.ev.length > 4000) G.ev.splice(0, 2000); }
function fx(o) { if (o.u) { o.uid = o.u.id; delete o.u; } emit('fx', o); }
function sfx(kind, x, y) { emit('sfx', kind, x == null ? null : Math.round(x), y == null ? null : Math.round(y)); }
function chips(x, y, team, n, power) { emit('chips', Math.round(x), Math.round(y), team, n, power); }
function feed(txt, cls) { emit('feed', G.time, txt, cls); }
function toast(txt, dur, toUid) { emit('toast', txt, dur || 2, toUid || 0); }
function shakeAt(x, y, amt) { emit('shake', Math.round(x), Math.round(y), amt); }
function anim(u, k) { emit('a', u.id, k); }
function nm(u) { return u.pname ? u.pname + ' (' + u.name + ')' : u.name; }
function muzzle(u) {
  var h = unitH(u), s = h / 92, k = u.pose || '';
  var dx = 36, dy = -52;
  if (k === 'sniper' || k === 'gunner') { dx = 64; dy = -18; }
  else if (k === 'kneeler' || k === 'bazooka' || k === 'mortar' || k === 'commando') { dx = 38; dy = -40; }
  if (u.kind === 'minion') { if (u.type === 'tank') { dx = 46; dy = -36; s = 1; } else if (u.type === 'jeep') { dx = 30; dy = -34; s = 1; } else if (u.type === 'mortar') { dx = 26; dy = -40; s = 1; } }
  return { x: u.x + u.facing * dx * s, y: u.y + dy * s };
}

/* ---------------- Collision & pathfinding ---------------- */
var NAV = { ver: 0, built: -1, sd: null, cell: 20 };
var STUCK_LOG = [];
function coreOf(b, x, y) {
  if (b.ax == null) return { x: b.x, y: b.y };
  var dx = b.bx - b.ax, dy = b.by - b.ay, L2 = dx * dx + dy * dy, t = L2 ? ((x - b.ax) * dx + (y - b.ay) * dy) / L2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return { x: b.ax + dx * t, y: b.ay + dy * t };
}
function surfDist(b, x, y) { var c = coreOf(b, x, y); return vlen(x - c.x, y - c.y) - b.r; }
function inLane(x, y) { return fieldSD(x, y) >= 0; }
function pointClear(x, y, r) {
  if (fieldSD(x, y) < r) return false;
  var bl = G.blockers; for (var i = 0; i < bl.length; i++) if (surfDist(bl[i], x, y) < r) return false;
  return true;
}
function segPtDist(px, py, ax, ay, bx, by) {
  var dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  var qx = px - ax - dx * t, qy = py - ay - dy * t;
  return Math.sqrt(qx * qx + qy * qy);
}
function orient(ax, ay, bx, by, cx, cy) { return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); }
function segsCross(a1x, a1y, a2x, a2y, b1x, b1y, b2x, b2y) {
  var d1 = orient(b1x, b1y, b2x, b2y, a1x, a1y), d2 = orient(b1x, b1y, b2x, b2y, a2x, a2y), d3 = orient(a1x, a1y, a2x, a2y, b1x, b1y), d4 = orient(a1x, a1y, a2x, a2y, b2x, b2y);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}
function segClear(ax, ay, bx, by, r) {
  if (fieldSD(ax, ay) < r - 1 || fieldSD(bx, by) < r - 1) return false;
  var L = vlen(bx - ax, by - ay), n = 1; while (L / n > 18) n *= 2;
  for (var stp = n >> 1; stp >= 1; stp >>= 1) for (var q = stp; q < n; q += 2 * stp) { var f = q / n; if (fieldSD(ax + (bx - ax) * f, ay + (by - ay) * f) < r - 0.5) return false; }
  var bl = G.blockers, minx = ax < bx ? ax : bx, maxx = ax < bx ? bx : ax, miny = ay < by ? ay : by, maxy = ay < by ? by : ay;
  for (var i = 0; i < bl.length; i++) {
    var o = bl[i], d, ext = o.r + r + (o.h || 0);
    if (o.x + ext < minx || o.x - ext > maxx || o.y + ext < miny || o.y - ext > maxy) continue;
    if (o.ax == null) d = segPtDist(o.x, o.y, ax, ay, bx, by);
    else d = segsCross(ax, ay, bx, by, o.ax, o.ay, o.bx, o.by) ? 0 : Math.min(segPtDist(ax, ay, o.ax, o.ay, o.bx, o.by), segPtDist(bx, by, o.ax, o.ay, o.bx, o.by), segPtDist(o.ax, o.ay, ax, ay, bx, by), segPtDist(o.bx, o.by, ax, ay, bx, by));
    if (d < o.r + r) return false;
  }
  return true;
}
function ensureNav() {
  if (NAV.built === NAV.ver && NAV.sd) return;
  var c = NAV.cell;
  NAV.nt = Math.floor(MAP.W / c) + 1; NAV.no = Math.floor(MAP.H / c) + 1;
  var N = NAV.nt * NAV.no, fresh = !NAV.sd || NAV.sd.length !== N;
  if (fresh) { NAV.sd = new Float32Array(N); NAV.fsd = new Float32Array(N); NAV.px = new Float32Array(N); NAV.py = new Float32Array(N); NAV.g = new Float32Array(N); NAV.came = new Int32Array(N); NAV.stamp = new Int32Array(N); NAV.closed = new Int32Array(N); NAV.cur = 0; }
  var bl = G.blockers;
  for (var i = 0; i < NAV.nt; i++) for (var j = 0; j < NAV.no; j++) {
    var k = i * NAV.no + j, x = i * c, y = j * c;
    if (fresh) { NAV.px[k] = x; NAV.py[k] = y; NAV.fsd[k] = fieldSD(x, y); }
    var m = NAV.fsd[k];
    if (m > -60) for (var b = 0; b < bl.length; b++) { var d = surfDist(bl[b], x, y); if (d < m) m = d; }
    NAV.sd[k] = m;
  }
  NAV.built = NAV.ver;
}
function navCell(x, y) {
  var c = NAV.cell, i = Math.round(x / c), j = Math.round(y / c);
  return clamp(i, 0, NAV.nt - 1) * NAV.no + clamp(j, 0, NAV.no - 1);
}
function nearestWalk(k, rr, x, y) {
  if (NAV.sd[k] >= rr) return k;
  var ci = (k / NAV.no) | 0, cj = k - ci * NAV.no, best = -1, bd = 1e18;
  for (var rad = 1; rad <= 16; rad++) {
    for (var i = ci - rad; i <= ci + rad; i++) for (var j = cj - rad; j <= cj + rad; j++) {
      if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== rad || i < 0 || j < 0 || i >= NAV.nt || j >= NAV.no) continue;
      var kk = i * NAV.no + j; if (NAV.sd[kk] < rr) continue;
      var dx = NAV.px[kk] - x, dy = NAV.py[kk] - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = kk; }
    }
    if (best >= 0 && rad > 1) break;
  }
  return best;
}
function findPath(sx, sy, gx, gy, r) {
  ensureNav();
  var rr = r + 1, s = nearestWalk(navCell(sx, sy), rr, sx, sy), g = nearestWalk(navCell(gx, gy), rr, gx, gy);
  if (s < 0 || g < 0) return null;
  var stamp = ++NAV.cur, gs = NAV.g, came = NAV.came, st = NAV.stamp, cl = NAV.closed, no = NAV.no, nt = NAV.nt, px = NAV.px, py = NAV.py, sd = NAV.sd;
  var hk = [], hf = [];
  function push(k, f) { hk.push(k); hf.push(f); var i = hk.length - 1; while (i > 0) { var p = (i - 1) >> 1; if (hf[p] <= hf[i]) break; var tk = hk[p]; hk[p] = hk[i]; hk[i] = tk; var tf = hf[p]; hf[p] = hf[i]; hf[i] = tf; i = p; } }
  function pop() {
    var top = hk[0], lk = hk.pop(), lf = hf.pop();
    if (hk.length) { hk[0] = lk; hf[0] = lf; var i = 0, n = hk.length; for (;;) { var l = 2 * i + 1, r2 = l + 1, m = i; if (l < n && hf[l] < hf[m]) m = l; if (r2 < n && hf[r2] < hf[m]) m = r2; if (m === i) break; var tk = hk[m]; hk[m] = hk[i]; hk[i] = tk; var tf = hf[m]; hf[m] = hf[i]; hf[i] = tf; i = m; } }
    return top;
  }
  st[s] = stamp; gs[s] = 0; came[s] = -1; push(s, 0);
  var found = false, iter = 0;
  while (hk.length) {
    var k = pop();
    if (cl[k] === stamp) continue; cl[k] = stamp;
    if (k === g) { found = true; break; }
    if (++iter > 24000) break;
    var ci = (k / no) | 0, cj = k - ci * no;
    for (var di = -1; di <= 1; di++) for (var dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue;
      var ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= nt || nj >= no) continue;
      var nk = ni * no + nj; if (sd[nk] < rr || cl[nk] === stamp) continue;
      if (di && dj && (sd[ci * no + nj] < rr || sd[ni * no + cj] < rr)) continue;
      var ng = gs[k] + vlen(px[nk] - px[k], py[nk] - py[k]);
      if (st[nk] !== stamp || ng < gs[nk]) { st[nk] = stamp; gs[nk] = ng; came[nk] = k; push(nk, ng + vlen(px[nk] - px[g], py[nk] - py[g])); }
    }
  }
  if (!found) return null;
  var cells = []; for (var c = g; c !== -1; c = came[c]) cells.push(c); cells.reverse();
  var pts = [{ x: sx, y: sy }]; cells.forEach(function (c2) { pts.push({ x: px[c2], y: py[c2] }); });
  if (pointClear(gx, gy, r)) pts.push({ x: gx, y: gy });
  var out = [], a = 0;
  while (a < pts.length - 1) {
    var nxt = a + 1;
    for (var b = pts.length - 1; b > a + 1; b--) if (segClear(pts[a].x, pts[a].y, pts[b].x, pts[b].y, r - 0.5)) { nxt = b; break; }
    out.push(pts[nxt]); a = nxt;
  }
  return out;
}
function freePoint(p, r) {
  var c = clampField(p, r + 4), tmp = { x: c.x, y: c.y, r: r };
  keepInWorld(tmp);
  return { x: tmp.x, y: tmp.y };
}
function stepToward(u, x, y, step, stopAt) {
  var d = vlen(x - u.x, y - u.y);
  if (d <= stopAt + 0.5) { u.path = null; return true; }
  var wx = x, wy = y, straight;
  if (u.path && u.pathGoal && u.scAt != null && G.time - u.scAt < 0.3 && vlen(u.pathGoal.x - x, u.pathGoal.y - y) <= 32) straight = false;
  else { straight = segClear(u.x, u.y, x, y, u.r - 1); u.scAt = G.time; }
  if (straight) u.path = null;
  else {
    var need = !u.path || u.pathVer !== NAV.ver || !u.pathGoal || vlen(u.pathGoal.x - x, u.pathGoal.y - y) > 32 || u.repath;
    if (need && !(u.pathCd > 0)) {
      u.path = findPath(u.x, u.y, x, y, u.r); u.pathGoal = { x: x, y: y }; u.pathVer = NAV.ver; u.repath = false; u.pathCd = u.path ? 0.05 : 0.3;
    }
    var P = u.path;
    if (P && P.length) {
      while (P.length > 1 && segClear(u.x, u.y, P[1].x, P[1].y, u.r - 1)) P.shift();
      if (vlen(P[0].x - u.x, P[0].y - u.y) < 5) { if (P.length === 1) { u.path = null; return true; } P.shift(); }
      wx = P[0].x; wy = P[0].y;
      if (!segClear(u.x, u.y, wx, wy, u.r - 2)) u.repath = true;
    }
  }
  var ex = wx - u.x, ey = wy - u.y, ed = vlen(ex, ey);
  if (ed < 0.01) return false;
  var s = Math.min(step, ed);
  if (!u.path) s = Math.min(s, d - stopAt);
  if (Math.abs(ex) > 3) u.facing = ex < 0 ? -1 : 1;
  u.x += ex / ed * s; u.y += ey / ed * s;
  return false;
}
function watchdog(u, dt, want, spd) {
  if (!want || u.dash) { u.wdT = 0; u.wdN = 0; u.wdX = u.x; u.wdY = u.y; return; }
  if (u.wdX == null) { u.wdX = u.x; u.wdY = u.y; }
  u.wdT = (u.wdT || 0) + dt;
  if (u.wdT < 0.5) return;
  if (vlen(u.x - u.wdX, u.y - u.wdY) < spd * 0.5 * 0.2) {
    u.wdN = (u.wdN || 0) + 1; u.repath = true; u.pathCd = 0;
    if (u.wdN >= 2) { var a = rnd(0, Math.PI * 2); u.kvx += Math.cos(a) * 170; u.kvy += Math.sin(a) * 170; u.path = null; }
    if (u.wdN === 3 && STUCK_LOG.length < 500) STUCK_LOG.push({ t: G.time, kind: u.kind, x: Math.round(u.x), y: Math.round(u.y) });
  } else u.wdN = 0;
  u.wdT = 0; u.wdX = u.x; u.wdY = u.y;
}
function clampInPlace(u) {
  var r = u.r || 10;
  if (fieldSD(u.x, u.y) >= r) return;
  var n = fieldNearest(u.x, u.y), dx = u.x - n.cx, dy = u.y - n.cy, d = vlen(dx, dy);
  if (d < 0.01) { dx = 0; dy = 1; d = 1; }
  var k = Math.max(0, n.cap.r - r) / d;
  u.x = n.cx + dx * k; u.y = n.cy + dy * k;
}
function keepInWorld(u) {
  var bl = G.blockers;
  for (var it = 0; it < 3; it++) {
    clampInPlace(u);
    var moved = false;
    for (var i = 0; i < bl.length; i++) {
      var o = bl[i], m = o.r + u.r, cx = o.x, cy = o.y;
      if (o.ax != null) {
        var ex = o.bx - o.ax, ey = o.by - o.ay, t = ((u.x - o.ax) * ex + (u.y - o.ay) * ey) / (ex * ex + ey * ey);
        t = t < 0 ? 0 : t > 1 ? 1 : t; cx = o.ax + ex * t; cy = o.ay + ey * t;
      }
      var dx = u.x - cx, dy = u.y - cy;
      if (dx > m || dx < -m || dy > m || dy < -m) continue;
      var d2 = dx * dx + dy * dy; if (d2 >= m * m) continue;
      var d = Math.sqrt(d2); if (d < 0.01) { dx = 0; dy = 1; d = 1; }
      u.x = cx + dx / d * m; u.y = cy + dy / d * m; moved = true;
    }
    if (!moved) return;
  }
  clampInPlace(u);
  if (!pointClear(u.x, u.y, u.r - 2)) { ensureNav(); var k2 = nearestWalk(navCell(u.x, u.y), u.r + 1, u.x, u.y); if (k2 >= 0) { u.x = NAV.px[k2]; u.y = NAV.py[k2]; u.path = null; } }
}
function dashCut(u, to) {
  var dx = to.x - u.x, dy = to.y - u.y, L = vlen(dx, dy); if (L < 1) return to;
  var n = Math.ceil(L / 8), ok = { x: u.x, y: u.y };
  for (var i = 1; i <= n; i++) { var p = { x: u.x + dx * i / n, y: u.y + dy * i / n }; if (!pointClear(p.x, p.y, u.r - 1)) break; ok = p; }
  return ok;
}
/* ---------------- Abilities ---------------- */
function abilityOf(u, slot) { return slot === 'D' ? TAG : slot === 'F' ? DECK : u.spec[slot]; }
function cast(u, slot, aim) {
  if (u.dead || u.dash || G.over) return false;
  var ab = abilityOf(u, slot);
  if (!ab) return false;
  if (slot === 'D' && u.tagMark && u.tagMark.t > 0 && !u.tagMark.tgt.dead) {
    var tg = u.tagMark.tgt; u.tagMark = null;
    startDash(u, { x: tg.x - (tg.x - u.x) * 0.1, y: tg.y - (tg.y - u.y) * 0.1 }, 0.32, {});
    sfx('cast', u.x, u.y);
    return true;
  }
  if (u.cd[slot] > 0 && !(u.isPlayer && opts.nocd)) return false;
  var dx = aim.x - u.x, dy = aim.y - u.y, L = vlen(dx, dy) || 1, dir = { x: dx / L, y: dy / L };
  if (Math.abs(dx) > 4) u.facing = dx < 0 ? -1 : 1;
  var dm = dmgMul(u), mz = muzzle(u);
  switch (ab.t) {
    case 'proj':
      G.proj.push({ x: mz.x, y: mz.y, vx: dir.x * ab.speed, vy: dir.y * ab.speed, life: ab.range / ab.speed, team: u.team, owner: u, w: ab.w || 20, n: ab.n,
        dmg: ab.dmg * dm, aoe: ab.aoe || 0, pierce: ab.pierce, slow: ab.slow, knock: ab.knock, pull: ab.pull, exec: ab.exec, burn: ab.burn, rocket: ab.rocket, hit: {}, kind: ab.rocket ? 'rocket' : 'shot' });
      fx({ k: 'muzzle', x: mz.x, y: mz.y, a: Math.atan2(dir.y, dir.x), t: 0, dur: 0.08, s: 1.4 });
      anim(u, 'f');
      sfx(ab.rocket ? 'rocket' : 'rifle', u.x, u.y);
      break;
    case 'jack':
      G.proj.push({ x: mz.x, y: mz.y, vx: dir.x * ab.speed, vy: dir.y * ab.speed, life: ab.range / ab.speed, team: u.team, owner: u, w: ab.w, dmg: 20, hit: {}, kind: 'jack', heroOnly: 1, n: ab.n });
      fx({ k: 'muzzle', x: mz.x, y: mz.y, a: Math.atan2(dir.y, dir.x), t: 0, dur: 0.07, s: 1 });
      sfx('rifle', u.x, u.y);
      break;
    case 'lob': {
      var tx = u.x + dir.x * Math.min(L, ab.range), ty = u.y + dir.y * Math.min(L, ab.range), n = ab.count || 1;
      for (var i = 0; i < n; i++) {
        var px = tx, py = ty;
        if (ab.line) { var k = (i - (n - 1) / 2) * 110; px = tx + dir.x * k; py = ty + dir.y * k; }
        else if (n > 1) { var a = rnd(0, Math.PI * 2), rr = Math.sqrt(Math.random()) * ab.spread; px = tx + Math.cos(a) * rr; py = ty + Math.sin(a) * rr; }
        var c = clampLane({ x: px, y: py });
        G.lobs.push({ x: c.x, y: c.y, sx: u.x, sy: u.y - 50, t: 0, delay: ab.delay + (ab.line ? i * 0.12 : n > 1 ? i * 0.1 : 0), r: ab.r, dmg: ab.dmg * dm, team: u.team, owner: u, slow: ab.slow, smul: ab.smul, smoke: ab.dmg === 0, n: ab.n });
      }
      sfx('shell', u.x, u.y);
      anim(u, 'f');
      break; }
    case 'nova':
      fx({ k: 'ring', x: u.x, y: u.y, r: ab.r, t: 0, dur: 0.4, c: TEAMC[u.team].hi });
      enemiesNear(u.team, u, ab.r, true).forEach(function (e) { damage(u, e, ab.dmg * dm, { slow: ab.slow, knock: ab.knock, ability: 1, smul: 0.5, n: ab.n }); });
      sfx('boom', u.x, u.y);
      break;
    case 'dash': {
      var dd = Math.min(ab.dist, Math.max(L, 80));
      var to = dashCut(u, clampLane({ x: u.x + dir.x * dd, y: u.y + dir.y * dd }));
      startDash(u, to, 0.18, { dmg: ab.dmg ? ab.dmg * dm : 0, iframe: ab.iframe || 0.15, n: ab.n });
      sfx('melee', u.x, u.y);
      break; }
    case 'leap': {
      var ld = Math.min(ab.range, L), lt = clampLane({ x: u.x + dir.x * ld, y: u.y + dir.y * ld });
      startDash(u, lt, ab.range > 1000 ? 0.9 : 0.4, { land: { r: ab.r, dmg: ab.dmg * dm, slow: ab.slow, exec: ab.exec }, leap: 1, iframe: 0.2, n: ab.n });
      sfx('cast', u.x, u.y);
      break; }
    case 'shield':
      u.shield += ab.amt * lvlMul(u); u.shieldT = ab.dur;
      fx({ k: 'ring', x: u.x, y: u.y, r: 60, t: 0, dur: 0.4, c: '#F5EFD8' });
      if (ab.ally) {
        var al = alliesNear(u, 700).filter(function (a) { return a !== u && a.kind === 'hero'; }).sort(function (a, b) { return a.hp / maxHp(a) - b.hp / maxHp(b); })[0];
        if (al) { al.shield += ab.amt * lvlMul(u); al.shieldT = ab.dur; u.st.heal += ab.amt * lvlMul(u); fx({ k: 'ring', x: al.x, y: al.y, r: 60, t: 0, dur: 0.4, c: '#F5EFD8' }); }
      }
      sfx('cast', u.x, u.y);
      break;
    case 'buff':
      u.buffs.push(Object.assign({ t: ab.dur }, ab.b));
      fx({ k: 'ring', x: u.x, y: u.y, r: 70, t: 0, dur: 0.35, c: TEAMC[u.team].hi });
      sfx('cast', u.x, u.y);
      break;
    case 'team':
      alliesNear(u, ab.r).forEach(function (a) { if (a.kind !== 'hero') return; a.buffs.push(Object.assign({ t: ab.dur }, ab.b)); if (ab.shield) { a.shield += ab.shield; a.shieldT = ab.dur; if (a !== u) u.st.heal += ab.shield; } fx({ k: 'ring', x: a.x, y: a.y, r: 70, t: 0, dur: 0.4, c: TEAMC[u.team].hi }); });
      sfx('cast', u.x, u.y);
      break;
    case 'cone':
      u.cone = { ab: ab, t: 0, dir: dir, tick: 0, dm: dm, root: ab.dur > 0.2 };
      if (ab.dur <= 0.1) { coneHit(u, ab, dir, ab.dmg * dm); u.cone.t = ab.dur; fx({ k: 'muzzle', x: mz.x, y: mz.y, a: Math.atan2(dir.y, dir.x), t: 0, dur: 0.1, s: 2 }); anim(u, 'f'); sfx('cannon', u.x, u.y); }
      else sfx(ab.n === 'Sweep' ? 'flame' : 'mg', u.x, u.y);
      break;
    case 'chan':
      u.chan = { ab: ab, t: 0, acc: 0, dm: dm };
      break;
    case 'mine': {
      var mn = ab.count || 1;
      for (var m = 0; m < mn; m++) {
        var md = Math.min(L, ab.range), mx = u.x + dir.x * md, my = u.y + dir.y * md;
        if (mn > 1) { mx += rnd(-ab.spread, ab.spread); my += rnd(-ab.spread, ab.spread); }
        var mc = clampLane({ x: mx, y: my });
        G.mines.push({ x: mc.x, y: mc.y, team: u.team, owner: u, arm: 0.6, dmg: ab.dmg * dm, r: ab.r, life: 60, n: ab.n });
      }
      sfx('cast', u.x, u.y);
      break; }
  }
  if (slot === 'R' && u.aug.tankR) { var tk = addMinion(u.team, 'tank', laneOf(u)); tk.x = u.x; tk.y = u.y; }
  if (u.kind === 'hero') {
    var main = 'QWER'.indexOf(slot) >= 0;
    if (main) fx({ k: 'callout', u: u, txt: ab.n.toUpperCase() + (slot === 'R' ? '!' : ''), t: 0, dur: slot === 'R' ? 1.3 : 0.95, ult: slot === 'R' });
    fx({ k: 'castring', x: u.x, y: u.y, t: 0, dur: slot === 'R' ? 0.55 : 0.35, c: TEAMC[u.team].hi, ult: slot === 'R' });
    anim(u, 'c');
    if (slot === 'R') shakeAt(u.x, u.y, 4);
  }
  var full = ab.cd * (slot === 'D' || slot === 'F' ? 1 : cdMul(u, slot));
  u.cdMax[slot] = full;
  if (!(u.isPlayer && opts.nocd)) u.cd[slot] = full;
  return true;
}
function startDash(u, to, dur, o) {
  u.dash = { fx: u.x, fy: u.y, tx: to.x, ty: to.y, t: 0, dur: dur, dmg: o.dmg || 0, land: o.land, leap: o.leap, hit: {}, n: o.n };
  u.iframe = Math.max(u.iframe, o.iframe || 0);
  u.target = null; u.move = null;
  if (Math.abs(to.x - u.x) > 4) u.facing = to.x < u.x ? -1 : 1;
}
function coneHit(u, ab, dir, amt) {
  var a0 = Math.atan2(dir.y, dir.x);
  G.units.concat(G.structs).forEach(function (e) {
    if (e.team === u.team || e.dead) return;
    var dx = e.x - u.x, dy = e.y - u.y, d = vlen(dx, dy);
    if (d > ab.range + (e.r || 0)) return;
    var da = Math.abs(((Math.atan2(dy, dx) - a0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (da > ab.ang / 2 + 0.1) return;
    damage(u, e, amt, { slow: ab.slow, knock: ab.knock, ability: 1, smul: 0.4, tick: ab.dur > 0.2, n: ab.n });
  });
}
function enemiesNear(team, p, r, incStructs) {
  var out = [];
  G.units.forEach(function (e) { if (e.team !== team && !e.dead && dist(e, p) < r + e.r) out.push(e); });
  if (incStructs) G.structs.forEach(function (s) { if (s.team !== team && !s.dead && dist(s, p) < r + s.r) out.push(s); });
  return out;
}
function alliesNear(u, r) { return G.units.filter(function (a) { return a.team === u.team && !a.dead && dist(a, u) < r; }); }
