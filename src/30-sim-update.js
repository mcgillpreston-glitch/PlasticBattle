/* Shared simulation: update loop, AI, projectiles, Field Orders rules. No DOM access. */

/* ---------------- Update ---------------- */
function update(dt) {
  if (!G || G.over) return;
  G.time += dt;
  if (G.time >= MATCH_LEN) { timeUp(); return; }
  G.nextWave -= dt;
  if (G.nextWave <= 0) { spawnWave(); G.nextWave = 25; }

  G.crates.forEach(function (c) {
    if (!c.up) { c.t -= dt; if (c.t <= 0) c.up = true; return; }
    for (var i = 0; i < G.units.length; i++) {
      var h = G.units[i];
      if (h.kind === 'hero' && !h.dead && dist(h, c) < 46) {
        var amt = maxHp(h) * 0.22 * (h.aug.crate ? 2 : 1); h.hp = Math.min(maxHp(h), h.hp + amt);
        c.up = false; c.t = 40; fx({ k: 'ring', x: c.x, y: c.y, r: 60, t: 0, dur: 0.4, c: '#F5EFD8' });
        emit('heal', h.id, Math.round(amt));
        break;
      }
    }
  });

  G.structs.forEach(function (s) { updateStruct(s, dt); });
  G.units.forEach(function (u) { updateUnit(u, dt); });
  separate(dt);
  G.units.forEach(function (u) { if (!u.dead) keepInWorld(u); });
  updateProj(dt);
  updateRounds(dt);
  updateLobs(dt);
  updateMines(dt);
  updateBarrage(dt);
  G.units = G.units.filter(function (u) { if (u.kind === 'minion' && u.dead) { u.deathT += dt; return u.deathT < 1.4; } return true; });
}

function updateStruct(s, dt) {
  if (s.dead) return;
  s.aaT -= dt;
  if (s.target && (s.target.dead || dist(s, s.target) > s.range + s.target.r || !visibleTo(s.target, s.team))) { s.target = null; s.heat = 0; }
  var heroes = [], mins = [];
  G.units.forEach(function (u) { if (u.team !== s.team && !u.dead && dist(u, s) <= s.range + u.r) (u.kind === 'hero' ? heroes : mins).push(u); });
  var diver = heroes.find(function (h) { return h.aggroT > 0 && G.units.some(function (a) { return a.team === s.team && a.kind === 'hero' && !a.dead && dist(a, s) < s.range + 200 && a.lastHit === h && a.lastHitT > 6; }); });
  if (diver && s.target !== diver) { s.target = diver; s.heat = 0; }
  if (!s.target) {
    var pool = mins.length ? mins : heroes;
    pool.sort(function (a, b) { return dist(a, s) - dist(b, s); });
    s.target = pool[0] || null; s.heat = 0;
  }
  if (s.target && s.aaT <= 0) {
    s.aaT = s.acd;
    var t = s.target, base = t.kind === 'hero' ? s.dmg * (1 + 0.2 * s.heat) : t.type === 'tank' ? s.dmg * 0.5 : t.maxHp * 0.45;
    if (t.kind === 'hero') s.heat++;
    var my = s.y - (s.kind === 'hq' ? 110 : 52), mx = s.x + (t.x < s.x ? -30 : 30);
    var hq = s.kind === 'hq';
    G.rounds.push({ x: mx, y: my, tgt: t, spd: hq ? 1400 : 2600, dmg: base, owner: s, team: s.team, heavy: hq, life: 1.2, lx: t.x, ly: t.y });
    fx({ k: 'muzzle', x: mx, y: my, a: Math.atan2(t.y - my, t.x - mx), t: 0, dur: 0.1, s: hq ? 2.2 : 1.6 });
    fx({ k: 'glow', x: mx, y: s.y, t: 0, dur: 0.1, r: 80 });
    anim(s, 'f');
    sfx(hq ? 'cannon' : 'mg', s.x, s.y);
  }
}

function updateUnit(u, dt) {
  if (u.pathCd > 0) u.pathCd -= dt;
  if (u.dead) {
    u.deathT += dt;
    if (u.kind === 'hero') {
      u.respawn -= dt;
      if (u.bot && ordersOwed(u) > 0) botPickOrder(u);
      if (u.respawn <= 0) { var f = fountain(u.team); u.dead = false; u.x = f.x + rnd(-30, 30); u.y = f.y + rnd(-30, 30); u.hp = maxHp(u); u.kvx = u.kvy = 0; u.deathT = 0; if (u.isPlayer) toast('Back on the line', 1.2); }
    }
    return;
  }
  for (var k in u.cd) if (u.cd[k] > 0) u.cd[k] = Math.max(0, u.cd[k] - dt);
  if (u.buffs.length) { u.buffs.forEach(function (b) { b.t -= dt; }); u.buffs = u.buffs.filter(function (b) { return b.t > 0; }); }
  if (u.shieldT > 0) { u.shieldT -= dt; if (u.shieldT <= 0) u.shield = 0; }
  if (u.slowT > 0) u.slowT -= dt;
  if (u.iframe > 0) u.iframe -= dt;
  if (u.aggroT > 0) u.aggroT -= dt;
  if (u.lastHitT > 0) u.lastHitT -= dt;
  if (u.tagMark) { u.tagMark.t -= dt; if (u.tagMark.t <= 0 || u.tagMark.tgt.dead) u.tagMark = null; }
  if (u.burnT > 0) { u.burnT -= dt; damage(u.burnSrc && !u.burnSrc.dead ? u.burnSrc : null, u, u.burnDps * dt, { tick: 1, n: 'Burn' }); if (u.dead) return; }
  if (u.kind === 'hero') {
    var mh = maxHp(u);
    if (dist(u, fountain(u.team)) < 360) u.hp = Math.min(mh, u.hp + mh * 0.12 * dt);
    if (u.aug.regen) u.hp = Math.min(mh, u.hp + u.aug.regen * dt);
    var aura = sumBuff(u, 'aura');
    if (aura) {
      var ar = 270;
      enemiesNear(u.team, u, ar, false).forEach(function (e) { damage(u, e, aura * dmgMul(u) * dt, { ability: 1, tick: 1, n: 'Aura' }); });
      var sd = sumBuff(u, 'selfdps'); if (sd) damage(null, u, sd * dt, { tick: 1, n: 'Overload' });
      if (u.dead) return;
    }
    if (u.bot && ordersOwed(u) > 0 && atBase(u)) botPickOrder(u);
  }
  if (u.kvx || u.kvy) {
    u.x += u.kvx * dt; u.y += u.kvy * dt;
    u.kvx *= Math.pow(0.004, dt); u.kvy *= Math.pow(0.004, dt);
    if (Math.abs(u.kvx) + Math.abs(u.kvy) < 8) { u.kvx = u.kvy = 0; }
  }
  if (u.dash) {
    var d = u.dash; d.t += dt; var p = Math.min(1, d.t / d.dur);
    u.x = d.fx + (d.tx - d.fx) * p; u.y = d.fy + (d.ty - d.fy) * p;
    if (d.dmg) enemiesNear(u.team, u, 60, false).forEach(function (e) { if (!d.hit[e.id]) { d.hit[e.id] = 1; damage(u, e, d.dmg, { ability: 1, n: d.n }); } });
    if (p >= 1) {
      if (d.land) {
        fx({ k: 'boom', x: u.x, y: u.y, r: d.land.r, t: 0, dur: 0.45 });
        sfx('boom', u.x, u.y);
        enemiesNear(u.team, u, d.land.r, true).forEach(function (e) { damage(u, e, d.land.dmg, { slow: d.land.slow, exec: d.land.exec, ability: 1, smul: 0.5, n: d.n }); });
      }
      u.dash = null;
    }
    keepInWorld(u);
    return;
  }
  if (u.cone) {
    var c = u.cone; c.t += dt; c.tick += dt;
    if (c.ab.dur > 0.1) {
      while (c.tick >= 0.1) { c.tick -= 0.1; coneHit(u, c.ab, c.dir, c.ab.dmg * c.dm / (c.ab.dur / 0.1)); }
      if (c.ab.n !== 'Sweep' && Math.random() < 0.5) { var cm = muzzle(u); fx({ k: 'muzzle', x: cm.x, y: cm.y, a: Math.atan2(c.dir.y, c.dir.x), t: 0, dur: 0.06, s: 1 }); sfx('mg', u.x, u.y); }
    } else if (c.t < 0.02) fx({ k: 'cone', x: u.x, y: u.y - 30, a: Math.atan2(c.dir.y, c.dir.x), ang: c.ab.ang, r: c.ab.range, t: 0, dur: 0.2, c: '#FFE29A' });
    if (c.t >= c.ab.dur) u.cone = null;
  }
  if (u.chan) {
    var ch = u.chan; ch.t += dt; ch.acc += dt;
    var aim = u.isPlayer ? (u.aimPt || null) : (u.target && !u.target.dead ? u.target : null);
    if (aim) {
      var ax = aim.x - u.x, ay = aim.y - u.y;
      if (Math.abs(ax) > 4) u.facing = ax < 0 ? -1 : 1;
      while (ch.acc >= ch.ab.rate) {
        ch.acc -= ch.ab.rate;
        var ang = Math.atan2(ay, ax) + rnd(-ch.ab.spread, ch.ab.spread), mz = muzzle(u);
        G.proj.push({ x: mz.x, y: mz.y, vx: Math.cos(ang) * 1700, vy: Math.sin(ang) * 1700, life: ch.ab.range / 1700, team: u.team, owner: u, w: 14, dmg: ch.ab.dmg * ch.dm, hit: {}, kind: 'bullet', n: ch.ab.n });
        fx({ k: 'muzzle', x: mz.x, y: mz.y, a: ang, t: 0, dur: 0.05, s: 1 });
        anim(u, 'r');
        sfx('mg', u.x, u.y);
      }
    }
    if (ch.t >= ch.ab.dur) u.chan = null;
  }
  if (u.kind === 'minion') minionAI(u, dt);
  else if (u.bot) { u.think -= dt; if (u.think <= 0) { u.think = 0.22 + Math.random() * 0.08; botAI(u); } }
  else if (u.isPlayer) playerAuto(u);
  var spd = moveSpeed(u);
  var tgt = u.target;
  if (tgt && (tgt.dead || (!tgt.isStruct && !visibleTo(tgt, u.team)) || (tgt.isStruct && !targetable(tgt)))) { u.target = tgt = null; }
  u.aaT -= dt;
  var wantMove = false;
  if (tgt) {
    var rng = aaRange(u) + (tgt.r || 0) + u.r * 0.5;
    var dd = dist(u, tgt);
    if (dd <= rng) {
      u.path = null;
      if (u.kind === 'minion' && WALK_SHOOT && u.move && spd > 0) { wantMove = true; stepToward(u, u.move.x, u.move.y, spd * dt, 4); }
      if (Math.abs(tgt.x - u.x) > 4) u.facing = tgt.x < u.x ? -1 : 1;
      if (u.aaT <= 0 && !u.cone && !u.chan) {
        if (!u.wind || u.wind.tgt !== tgt) u.wind = { tgt: tgt, t: 0, dur: windTime(u) };
        u.wind.t += dt;
        if (u.wind.t >= u.wind.dur) { u.wind = null; attack(u, tgt); }
      }
    } else { u.wind = null; if (spd > 0) { wantMove = true; var gx = tgt.x, gy = tgt.y;
        /* Vehicles chasing a hero walk to the lane point beside it, not onto the hero: a hero at the field edge would otherwise pin them there. */
        if (u.kind === 'minion' && (u.type === 'jeep' || u.type === 'tank') && tgt.kind === 'hero' && u.lane != null) { var hq0 = laneProj(tgt, u.lane); var lp = lanePt(hq0.t, clamp(hq0.off, -60, 60), u.lane); gx = lp.x; gy = lp.y; }
        stepToward(u, gx, gy, spd * dt, rng * 0.9); } }
  } else if (u.move && spd > 0) {
    u.wind = null;
    wantMove = true;
    if (goalTaken(u) || stepToward(u, u.move.x, u.move.y, spd * dt, 4)) { wantMove = false; u.move = null; u.amove = null; }
  }
  watchdog(u, dt, wantMove, spd);
  keepInWorld(u);
}
function goalTaken(u) {
  var gx = u.move.x, gy = u.move.y;
  if (vlen(gx - u.x, gy - u.y) > u.r * 2 + 8) return false;
  for (var i = 0; i < G.units.length; i++) { var o = G.units[i]; if (o !== u && !o.dead && o.team === u.team && vlen(o.x - gx, o.y - gy) < o.r + u.r) return true; }
  return false;
}
function aaStyle(u) { return u.kind === 'hero' ? u.spec.aa : (u.type === 'melee' ? 'melee' : u.type === 'tank' ? 'tank' : u.type === 'mortar' ? 'shell' : 'bullet'); }
function windTime(u) {
  var s = aaStyle(u);
  if (u.kind === 'hero') return (s === 'melee' ? 0.12 : s === 'shell' ? 0.22 : Math.min(0.16, aaCd(u) * 0.35)) * 0.6;
  return s === 'tank' ? 0.32 : s === 'melee' ? 0.14 : 0.2;
}
function aimPoint(t) { return { x: t.x, y: t.isStruct ? t.y - 50 : t.y - unitH(t) * 0.45 }; }
function attack(u, t) {
  u.aaT = Math.max(0.05, aaCd(u) - windTime(u));
  var dmg = aaDmg(u), style = aaStyle(u);
  var mz = muzzle(u), ap = aimPoint(t), ang = Math.atan2(ap.y - mz.y, ap.x - mz.x), hero = u.kind === 'hero';
  anim(u, style === 'tank' ? 'F' : 'f');
  if (style === 'shell') {
    G.lobs.push({ x: t.x, y: t.y, sx: u.x, sy: u.y - 50, t: 0, delay: 0.5, r: 60, dmg: dmg, team: u.team, owner: u, single: t });
    fx({ k: 'muzzle', x: mz.x, y: mz.y - 20, a: -Math.PI / 2, t: 0, dur: 0.12, s: 1.6 });
    fx({ k: 'puff', x: mz.x, y: mz.y - 30, t: 0, dur: 0.7 });
    sfx('shell', u.x, u.y);
    return;
  }
  if (style === 'melee') {
    anim(u, 'l');
    fx({ k: 'slash', x: ap.x, y: ap.y, t: 0, dur: 0.22, dir: u.facing, big: hero });
    fx({ k: 'impact', x: ap.x, y: ap.y, t: 0, dur: 0.3, heavy: false, team: u.team });
    sfx('melee', u.x, u.y);
    hitFeedback(u, t, u.facing);
    damage(u, t, dmg, { aa: 1, smul: u.smul });
    return;
  }
  if (style === 'flame') {
    fx({ k: 'cone', x: mz.x, y: mz.y, a: ang, ang: 0.42, r: aaRange(u), t: 0, dur: 0.2, c: '#FF9A3D' });
    for (var i = 0; i < 4; i++) { var fr = rnd(0.3, 1) * aaRange(u), fa = ang + rnd(-0.18, 0.18); fx({ k: 'flame', x: mz.x + Math.cos(fa) * fr, y: mz.y + Math.sin(fa) * fr, t: 0, dur: 0.35 }); }
    sfx('flame', u.x, u.y);
    hitFeedback(u, t, u.facing);
    damage(u, t, dmg, { aa: 1, smul: u.smul });
    return;
  }
  var heavy = style === 'tank';
  G.rounds.push({ x: mz.x, y: mz.y, tgt: t, spd: heavy ? 1250 : 2300, dmg: dmg, owner: u, team: u.team, heavy: heavy, smul: u.smul, hero: hero, life: 1.2, lx: ap.x, ly: ap.y });
  fx({ k: 'muzzle', x: mz.x, y: mz.y, a: ang, t: 0, dur: heavy ? 0.13 : 0.09, s: heavy ? 2.2 : hero ? 1.5 : 1 });
  fx({ k: 'glow', x: mz.x, y: u.y, t: 0, dur: heavy ? 0.14 : 0.09, r: heavy ? 90 : hero ? 60 : 36 });
  if (hero || heavy) fx({ k: 'puff', x: mz.x + u.facing * 6, y: mz.y, t: 0, dur: 0.5 });
  if (hero) fx({ k: 'chip', x: u.x, y: mz.y + 6, vx: -u.facing * rnd(60, 120), vy: -rnd(140, 220), t: 0, dur: 0.5, c: '#D9B04A', rot: 0 });
  if (heavy) shakeAt(u.x, u.y, 2.5);
  sfx(heavy ? 'cannon' : (hero && u.spec.acd < 0.45 ? 'mg' : 'rifle'), u.x, u.y);
}
function hitFeedback(src, t, dir) {
  if (t.isStruct) return;
  emit('h', t.id, dir, src ? src.id : 0);
}
function updateRounds(dt) {
  G.rounds = G.rounds.filter(function (r) {
    r.life -= dt;
    var alive = r.tgt && !r.tgt.dead;
    if (alive) { var ap = aimPoint(r.tgt); r.lx = ap.x; r.ly = ap.y; }
    var dx = r.lx - r.x, dy = r.ly - r.y, d = vlen(dx, dy), s = r.spd * dt;
    r.px = r.x; r.py = r.y;
    if (d <= s || r.life <= 0) {
      r.x = r.lx; r.y = r.ly;
      fx({ k: 'impact', x: r.x, y: r.y, t: 0, dur: r.heavy ? 0.42 : 0.3, heavy: r.heavy, team: r.team });
      if (r.heavy) { fx({ k: 'boom', x: r.x, y: r.y + 30, r: 46, t: 0, dur: 0.35 }); sfx('boom', r.x, r.y); }
      if (alive) {
        hitFeedback(r.owner, r.tgt, dx >= 0 ? 1 : -1);
        if (r.owner && r.owner.isStruct) damage(r.owner, r.tgt, r.dmg, {});
        else damage(r.owner, r.tgt, r.dmg, { aa: 1, smul: r.smul });
      }
      return false;
    }
    r.x += dx / d * s; r.y += dy / d * s;
    return true;
  });
}

function playerAuto(u) {
  if (u.target || u.cone || u.chan) return;
  if (u.move && !u.amove) return;
  var best = null, bd = 1e9, r = aaRange(u) + 30;
  G.units.forEach(function (e) { if (e.team !== u.team && !e.dead && visibleTo(e, u.team)) { var d = dist(e, u); if (d < r && d < bd) { bd = d; best = e; } } });
  if (!best) G.structs.forEach(function (s) { if (s.team !== u.team && targetable(s) && dist(s, u) < r + s.r) best = s; });
  if (best) { u.target = best; if (u.amove) u.move = null; }
  else if (u.amove && !u.move) u.move = u.amove;
}

function minionAI(m, dt) {
  m.aim -= dt;
  if (m.target && !m.target.dead && dist(m, m.target) < 520 && (m.target.isStruct ? targetable(m.target) : visibleTo(m.target, m.team))) {
    if (m.aim > 0) return;
  }
  m.aim = 0.4;
  var best = null, bd = 1e9;
  G.units.forEach(function (e) {
    if (e.team === m.team || e.dead || !visibleTo(e, m.team)) return;
    var d = dist(e, m) + (e.kind === 'hero' ? 160 : 0);
    if (d < 460 && d < bd) { bd = d; best = e; }
  });
  if (!best) G.structs.forEach(function (s) { if (s.team !== m.team && targetable(s) && dist(s, m) < 460 + s.r) best = s; });
  m.target = best;
  if (!best || WALK_SHOOT) {
    var q = laneProj(m, m.lane), nt = q.t + (m.team === 0 ? 0.08 : -0.08);
    m.move = freePoint(lanePt(nt, clamp(q.off, -60, 60), m.lane), m.r);
  }
}

function botAI(u) {
  var mh = maxHp(u);
  if (u.hp < mh * 0.28) u.retreat = true;
  if (u.retreat && u.hp > mh * 0.85) u.retreat = false;
  if (u.retreat) { u.target = null; u.move = freePoint(fountain(u.team), u.r); if (!u.cd.F && Math.random() < 0.3 && enemyHeroNear(u, 400)) cast(u, 'F', fountain(u.team)); return; }
  var passive = opts.passive && u.team === 1;
  var eh = passive ? null : enemyHeroNear(u, 900);
  if (eh) botCast(u, eh);
  var lane = laneOf(u), front = -1;
  G.units.forEach(function (m) { if (m.team === u.team && m.kind === 'minion' && !m.dead && m.lane === lane) front = Math.max(front, progress(m)); });
  var myOut = G.structs.filter(function (s) { return s.team === u.team && !s.dead && s.kind === 'outpost' && s.lane === lane; }).map(function (s) { return u.team === 0 ? s.t : 1 - s.t; });
  var hold = myOut.length ? Math.max.apply(null, myOut) - 0.03 : 0.08;
  var want = front > 0 ? Math.max(hold, front - 0.025) : hold;
  var danger = G.structs.find(function (s) {
    if (s.team === u.team || s.dead) return false;
    if (dist(s, u) > s.range + 60) return false;
    return !G.units.some(function (m) { return m.team === u.team && m.kind === 'minion' && !m.dead && dist(m, s) < s.range; });
  });
  if (danger) { u.target = null; var q0 = laneProj(u, lane); u.move = freePoint(lanePt(q0.t + (u.team === 0 ? -0.06 : 0.06), clamp(q0.off, -60, 60), lane), u.r); return; }
  if (passive) { u.target = null; u.move = freePoint(lanePt(u.team === 0 ? want : 1 - want, 0, lane), u.r); return; }
  var r = aaRange(u), best = null, bs = -1e9;
  G.units.forEach(function (e) {
    if (e.team === u.team || e.dead || !visibleTo(e, u.team)) return;
    var d = dist(e, u); if (d > r + 260) return;
    var fortNear = G.structs.some(function (s) { return s.team === e.team && !s.dead && dist(s, u) < s.range + 20; });
    if (fortNear) return;
    var sc = (e.kind === 'hero' ? 400 * (1 - e.hp / maxHp(e)) + 120 : 0) - d + (e.kind === 'minion' && e.hp < aaDmg(u) ? 200 : 0);
    if (sc > bs) { bs = sc; best = e; }
  });
  if (!best) G.structs.forEach(function (s) {
    if (s.team === u.team || !targetable(s) || dist(s, u) > r + 300) return;
    var covered = G.units.some(function (m) { return m.team === u.team && m.kind === 'minion' && !m.dead && dist(m, s) < s.range; });
    if (covered) best = s;
  });
  u.target = best;
  if (!best) {
    var mates = G.units.filter(function (h) { return h.kind === 'hero' && h.team === u.team && laneOf(h) === lane; }), slot = Math.max(0, mates.indexOf(u));
    var off = [0, -55, 55, -100, 100][slot % 5], back = (slot % 2) * 0.014;
    u.move = freePoint(lanePt(u.team === 0 ? want - back : 1 - want + back, off, lane), u.r);
  }
  else u.move = null;
}
function enemyHeroNear(u, r) {
  var best = null, bd = r;
  G.units.forEach(function (e) { if (e.kind === 'hero' && e.team !== u.team && !e.dead && visibleTo(e, u.team)) { var d = dist(e, u); if (d < bd) { bd = d; best = e; } } });
  return best;
}
function botCast(u, e) {
  var d = dist(u, e), lead = { x: e.x + (e.move ? (e.move.x - e.x) * 0.08 : 0), y: e.y + (e.move ? (e.move.y - e.y) * 0.08 : 0) };
  ['Q', 'W', 'E', 'R', 'D'].forEach(function (slot) {
    if (u.cd[slot] > 0 || Math.random() < 0.35) return;
    var ab = abilityOf(u, slot);
    var reach = ab.range || ab.r || ab.dist || 400;
    if (ab.t === 'proj' || ab.t === 'lob' || ab.t === 'jack' || ab.t === 'mine') { if (d < reach * 0.92) cast(u, slot, lead); }
    else if (ab.t === 'nova') { if (d < ab.r * 0.9) cast(u, slot, e); }
    else if (ab.t === 'cone') { if (d < ab.range * 0.9) cast(u, slot, e); }
    else if (ab.t === 'chan') { if (d < ab.range * 0.8) { u.target = e; cast(u, slot, e); } }
    else if (ab.t === 'leap') { if (d < ab.range && (slot !== 'R' || e.hp < maxHp(e) * 0.55)) cast(u, slot, e); }
    else if (ab.t === 'dash') { if (u.spec.range < 300 && d > u.spec.range && d < ab.dist + u.spec.range) cast(u, slot, e); }
    else if (ab.t === 'buff' || ab.t === 'shield' || ab.t === 'team') { if (d < 650 && (slot !== 'R' || Math.random() < 0.5)) cast(u, slot, e); }
  });
  if (u.tagMark && u.tagMark.t > 0 && u.hp > maxHp(u) * 0.6 && Math.random() < 0.5) cast(u, 'D', e);
}

function updateProj(dt) {
  G.proj = G.proj.filter(function (p) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    var done = false;
    var list = p.heroOnly ? G.units.filter(function (u) { return u.kind === 'hero'; }) : G.units;
    for (var i = 0; i < list.length && !done; i++) {
      var e = list[i];
      if (e.team === p.team || e.dead || p.hit[e.id] || !visibleTo(e, p.team)) continue;
      if (vlen(e.x - p.x, (e.y - unitH(e) * 0.4) - p.y) < e.r + p.w) {
        p.hit[e.id] = 1;
        if (p.kind === 'jack') { damage(p.owner, e, p.dmg, { proj: 1, n: p.n }); p.owner.tagMark = { tgt: e, t: 3 }; p.owner.cd.D = Math.min(p.owner.cd.D, 3); fx({ k: 'ring', x: e.x, y: e.y, r: 40, t: 0, dur: 0.4, c: '#E0703F' }); done = true; break; }
        if (p.aoe) { explode(p); done = true; break; }
        damage(p.owner, e, p.dmg, { slow: p.slow, knock: p.knock, pull: p.pull, exec: p.exec, burn: p.burn, proj: 1, ability: p.kind !== 'bullet', fx: p.x - p.vx * 0.01, fy: p.y - p.vy * 0.01, n: p.n });
        if (!p.pierce) done = true;
      }
    }
    if (!done && !p.heroOnly) {
      for (var j = 0; j < G.structs.length; j++) {
        var s = G.structs[j];
        if (s.team === p.team || s.dead) continue;
        if (vlen(s.x - p.x, s.y - 40 - p.y) < s.r + p.w) { if (p.aoe) explode(p); else damage(p.owner, s, p.dmg * 0.5, { proj: 1 }); done = true; break; }
      }
    }
    for (var k = 0; k < PROP_C.length && !done; k++) { var pr = PROP_C[k]; if (surfDist(pr, p.x, p.y + 20) < 0) { if (p.aoe) explode(p); else fx({ k: 'spark', x: p.x, y: p.y, t: 0, dur: 0.15 }); done = true; } }
    if (!done && p.life <= 0) { if (p.aoe) explode(p); done = true; }
    return !done;
  });
}
function explode(p) {
  fx({ k: 'boom', x: p.x, y: p.y + 30, r: p.aoe, t: 0, dur: 0.45 }); fx({ k: 'scorch', x: p.x, y: p.y + 30, r: p.aoe * 0.6, t: 0, dur: 6 }); shakeAt(p.x, p.y, 5);
  sfx('boom', p.x, p.y);
  enemiesNear(p.team, { x: p.x, y: p.y + 30 }, p.aoe, true).forEach(function (e) { damage(p.owner, e, p.dmg, { slow: p.slow, knock: p.knock, ability: 1, proj: 1, smul: 0.6, fx: p.x, fy: p.y + 30, n: p.n }); });
}
function updateLobs(dt) {
  G.lobs = G.lobs.filter(function (l) {
    l.t += dt;
    if (l.t < l.delay) return true;
    if (l.single) { if (!l.single.dead) damage(l.owner, l.single, l.dmg, { aa: 1 }); fx({ k: 'boom', x: l.x, y: l.y, r: 50, t: 0, dur: 0.35 }); sfx('boom', l.x, l.y); return false; }
    if (l.smoke) fx({ k: 'smokecloud', x: l.x, y: l.y, r: l.r, t: 0, dur: 2.5 });
    else { fx({ k: 'boom', x: l.x, y: l.y, r: l.r, t: 0, dur: 0.5 }); fx({ k: 'scorch', x: l.x, y: l.y, r: l.r * 0.6, t: 0, dur: 6 }); sfx('boom', l.x, l.y); shakeAt(l.x, l.y, 4); }
    enemiesNear(l.team, l, l.r, !l.smoke).forEach(function (e) { damage(l.owner, e, l.dmg, { slow: l.slow, ability: 1, smul: l.smul || 0.5, n: l.n }); if (l.smoke) { e.slowT = 2.5; e.slowAmt = Math.max(e.slowAmt, l.slow); } });
    return false;
  });
}
function updateMines(dt) {
  G.mines = G.mines.filter(function (m) {
    m.life -= dt; if (m.arm > 0) { m.arm -= dt; return m.life > 0; }
    var hit = G.units.find(function (u) { return u.team !== m.team && !u.dead && dist(u, m) < 42 + u.r; });
    if (hit) {
      fx({ k: 'boom', x: m.x, y: m.y, r: m.r, t: 0, dur: 0.45 }); sfx('boom', m.x, m.y);
      enemiesNear(m.team, m, m.r, false).forEach(function (e) { damage(m.owner, e, m.dmg, { ability: 1, slow: 0.4, n: m.n }); });
      return false;
    }
    return m.life > 0;
  });
}
function startBarrage() {
  if (G.barrage) return;
  G.barrage = { beams: [], r: 150 };
  for (var li = 0; li < LANES.length; li++) { G.barrage.beams.push({ t: 0.5, dir: -1, acc: li * 0.05, lane: li }); G.barrage.beams.push({ t: 0.5, dir: 1, acc: 0.15 + li * 0.05, lane: li }); }
  emit('sprinkler');
  feed('The sprinkler came on: water sweeping out from the centre', '');
}
/* Buzzer: compare the structure HP each side has left. Within 2% counts as a draw. */
function timeUp() {
  var hp = [0, 0], mx = [0, 0];
  G.structs.forEach(function (s) { if (!s.dead) hp[s.team] += s.hp; mx[s.team] += s.maxHp; });
  var f0 = mx[0] ? hp[0] / mx[0] : 0, f1 = mx[1] ? hp[1] / mx[1] : 0;
  var winner = Math.abs(f0 - f1) < 0.02 ? -1 : (f0 > f1 ? 0 : 1);
  tallyCash();
  G.over = true; G.winner = winner; emit('end', winner, 'time');
}
function updateBarrage(dt) {
  if (!G.barrage && G.time > 18 * 60) startBarrage();
  if (!G.barrage) return;
  G.barrage.beams.forEach(function (b) {
    b.t = clamp(b.t + b.dir * dt * 0.012, 0.08, 0.92);
    var c = lanePt(b.t, Math.sin(G.time * 0.9 + b.dir) * 60, b.lane); b.x = c.x; b.y = c.y;
    G.units.forEach(function (u) { if (!u.dead && dist(u, b) < G.barrage.r) damage(null, u, (u.kind === 'hero' ? 140 : 220) * dt, { tick: 1, n: 'Sprinkler' }); });
    b.acc -= dt;
    if (b.acc <= 0) { b.acc = 0.22; var a = rnd(0, Math.PI * 2), rr = Math.random() * G.barrage.r; fx({ k: 'splash', x: b.x + Math.cos(a) * rr, y: b.y + Math.sin(a) * rr * 0.6, t: 0, dur: 0.5 }); sfx('splash', b.x, b.y); }
  });
}
/* Units are solid: no two living, non-dashing units may overlap. Pushes split by mass (heroes are heavier than minions), and the pass repeats so a crowd settles instead of trading overlaps. */
function unitMass(u) { return u.kind === 'hero' ? 1.6 : u.type === 'tank' ? 2.4 : u.type === 'jeep' ? 1.3 : 1; }
function separate(dt) {
  var arr = G.units;
  for (var pass = 0; pass < 3; pass++) {
    for (var i = 0; i < arr.length; i++) {
      var a = arr[i]; if (a.dead || a.dash) continue;
      for (var j = i + 1; j < arr.length; j++) {
        var b = arr[j]; if (b.dead || b.dash) continue;
        var dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, m = a.r + b.r;
        if (d2 < m * m) {
          var d = Math.sqrt(d2), push = m - d, nx, ny;
          if (d2 > 0.01) { nx = dx / d; ny = dy / d; } else { var ang = (a.id * 2.399) % (Math.PI * 2); nx = Math.cos(ang); ny = Math.sin(ang); }
          var ma = unitMass(a), mb = unitMass(b), tot = ma + mb;
          a.x -= nx * push * (mb / tot); a.y -= ny * push * (mb / tot);
          b.x += nx * push * (ma / tot); b.y += ny * push * (ma / tot);
        }
      }
    }
  }
}

/* ---------------- Field Orders ---------------- */
function rollOffer(u) {
  var n = u.ordersDone, tier, guard = 0;
  do { tier = Math.random() < 0.45 ? 0 : Math.random() < 0.75 ? 1 : 2; guard++; } while (n === 1 && tier === 0 && u.firstTier === 0 && guard < 20);
  if (n === 0) u.firstTier = tier;
  var taken = u.augs.map(function (a) { return a.id; });
  var pool = shuffle(ORDERS[tier].filter(function (o) { return taken.indexOf(o.id) < 0; }));
  u.offer = { tier: tier, cards: pool.slice(0, 3).map(function (c) { return { o: c, rerolled: false }; }), spare: pool.slice(3) };
}
function applyOrder(u, o) {
  var before = maxHp(u);
  for (var k in o.a) u.aug[k] = (u.aug[k] || 0) + o.a[k];
  u.augs.push(o); u.ordersDone++; u.offer = null;
  u.hp = Math.min(maxHp(u), u.hp + Math.max(0, maxHp(u) - before));
}
function botPickOrder(u) {
  if (!u.offer) rollOffer(u);
  var c = u.offer.cards[Math.floor(Math.random() * u.offer.cards.length)];
  if (c) applyOrder(u, c.o); else { u.ordersDone++; u.offer = null; }
}
