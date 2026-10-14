/* Browser only: client state, presentation of sim events (offline and online), visual timers. */
var cam = { x: 1600, y: 960, z: 0.8, lock: true };
var mouse = { x: 0, y: 0, wx: 0, wy: 0, inside: false };
var aimSlot = null, aMovePending = false, hoverT = null;
var MYTEAM = 0;
var NET = { mode: 'local', byId: null };
var REDUCED = false; try { REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
var toastEl = document.getElementById('toast');

/* Offline match against bots. */
function newGame(heroIdx, size) {
  NET.mode = 'local'; NET.byId = null; MYTEAM = 0;
  document.body.classList.remove('online');
  var roster = [{ team: 0, hero: heroIdx, human: true }];
  var pool0 = shuffle(range16().filter(function (i) { return i !== heroIdx; })), pool1 = shuffle(range16());
  for (var i = 1; i < size; i++) roster.push({ team: 0, hero: pool0[i - 1] });
  for (var j = 0; j < size; j++) roster.push({ team: 1, hero: pool1[j] });
  simNewGame(roster);
  G.player = G.units.find(function (u) { return u.id === roster[0].uid; });
  enterMatch();
  showAlert('DEPLOYED · FIELD ORDERS AT BASE FROM LEVEL 3', 'info');
}
function enterMatch() {
  var f = fountain(MYTEAM); cam.x = f.x; cam.y = f.y; cam.lock = true;
  aimSlot = null; aMovePending = false; hoverT = null;
  buildAbilityBar(); renderFeed();
  ALERT.q = []; ALERT.t = 0; ALERT.lastStruct = {}; ALERT.el.hidden = true; if (G) G.hitDirs = [];
}

function addFx(o) { if (G && G.fx.length < 700) G.fx.push(o); }
function floatText(x, y, txt, color) { if (!G || G.texts.length > 80) return; G.texts.push({ x: x + rnd(-10, 10), y: y, txt: String(txt), color: color, t: 0 }); }
function chipsFx(x, y, team, n, power) {
  for (var i = 0; i < n; i++) { var a = rnd(0, Math.PI * 2), s = rnd(80, 260) * power; addFx({ k: 'chip', x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, t: 0, dur: rnd(0.4, 0.9), c: TEAMC[team].c2, rot: rnd(0, 6) }); }
}
function showToast(txt, dur) { toastEl.textContent = txt; if (G) G.toastT = dur || 2; }
function localShake(x, y, amt) { if (REDUCED || !G) return; var k = clamp(1 - vlen(x - cam.x, y - cam.y) / 1000, 0, 1); G.shake = Math.max(G.shake || 0, amt * k); }
function unitById(id) {
  if (!id || !G) return null;
  if (NET.byId && NET.byId[id]) return NET.byId[id];
  for (var i = 0; i < G.units.length; i++) if (G.units[i].id === id) return G.units[i];
  for (var j = 0; j < G.structs.length; j++) if (G.structs[j].id === id) return G.structs[j];
  return null;
}
function isMe(id) { return !!(id && G && G.player && G.player.id === id); }
function pushFeed(t, txt, cls) { G.feed.unshift({ txt: fmtTime(t) + '  ' + txt, cls: cls, t: 8 }); if (G.feed.length > 5) G.feed.length = 5; renderFeed(); }

/* One sim event -> visuals and sound. Same path for offline (G.ev) and online (server snapshots). */
function present(e) {
  var k = e[0], u;
  switch (k) {
    case 'fx': var o = e[1]; if (o.uid) { o.u = unitById(o.uid); if (!o.u || o.u._hidden) return; } o.t = 0; addFx(o); break;
    case 'sfx': playSfx(e[1], e[2], e[3]); break;
    case 'chips': chipsFx(e[1], e[2], e[3], e[4], e[5]); break;
    case 'feed': pushFeed(e[1], e[2], e[3]); break;
    case 'toast': if (!e[3] || isMe(e[3])) showToast(e[1], e[2]); break;
    case 'shake': localShake(e[1], e[2], e[3]); break;
    case 'dmg':
      u = unitById(e[1]); if (!u || u._hidden) break;
      var amt = e[3]; u.flashT = 0.08;
      if (amt > 8 && Math.random() < 0.7) chipsFx(u.x, u.isStruct ? u.y - 40 : u.y - unitH(u) * 0.45, u.team, u.isStruct ? 2 : 3, u.isStruct ? 0.5 : 0.6);
      if (isMe(e[1])) {
        G.hurtT = Math.max(G.hurtT, 0.35); playSfx('hit', u.x, u.y); floatText(u.x, u.y - unitH(u) - 10, amt, '#FF5A4E');
        var att = unitById(e[2]); if (att) { G.hitDirs = (G.hitDirs || []).filter(function (h) { return h.src !== att.id; }); G.hitDirs.push({ src: att.id, ang: Math.atan2(att.y - u.y, att.x - u.x), t: 0.9 }); }
      }
      else if (isMe(e[2])) { playSfx('hit', u.x, u.y); floatText(u.x, u.y - (u.isStruct ? 120 : unitH(u)) - 10, amt, '#FFFFFF'); }
      if (u.isStruct && u.team === MYTEAM && !u.dead) alertStruct(u);
      break;
    case 'kill':
      u = unitById(e[2]);
      if (isMe(e[1])) {
        var kp = u ? aimPoint(u) : null;
        if (kp) addFx({ k: 'hitmark', x: kp.x, y: kp.y, t: 0, dur: 0.5, kill: true });
        var pl = G.player; addFx({ k: 'banner', x: pl.x, y: pl.y - unitH(pl) - 70, t: 0, dur: 1.6, txt: 'ELIMINATED ' + String(e[3]).toUpperCase(), sub: '+100' + (e[4] >= 3 ? '  \u00b7  ' + e[4] + ' KILL STREAK' : ''), c: '#FFFFFF' });
        playSfx('kill');
      } else if (u && u.team === MYTEAM) showAlert('UNIT LOST', 'bad');
      break;
    case 'struct': if (e[2] === MYTEAM) showAlert((e[3] === 'hq' ? 'FORT' : e[3] === 'depot' ? 'SUPPLY BUCKET' : 'SAND TURRET') + ' LOST', 'bad'); else showAlert('ENEMY ' + (e[3] === 'hq' ? 'FORT' : e[3] === 'depot' ? 'SUPPLY BUCKET' : 'SAND TURRET') + ' DESTROYED', 'good'); break;
    case 'wave': if (e[1] % 3 === 0) showAlert('REINFORCEMENTS HAVE ARRIVED', 'info'); break;
    case 'sprinkler': showAlert('SPRINKLER ACTIVATED \u00b7 CLEAR THE CENTRE', 'bad'); break;
    case 'kia': if (isMe(e[1])) { var kb = unitById(e[4]); showAlert('KIA' + (kb ? ' \u00b7 KILLED BY ' + (kb.pname || kb.name).toUpperCase() : '') + ' \u00b7 REINFORCING ' + e[2] + 'S', 'bad'); G.hurtT = 1.2; G.hitDirs = []; } break;
    case 'lvl': if (isMe(e[1])) { showAlert('PROMOTED TO LEVEL ' + e[2] + (ORDER_LEVELS.indexOf(e[2]) >= 0 ? ' · FIELD ORDERS AT BASE' : ''), 'good'); playSfx('ui'); } break;
    case 'heal': if (isMe(e[1])) { u = unitById(e[1]); if (u) floatText(u.x, u.y - 100, '+' + e[2], '#B8E07A'); playSfx('ui'); } break;
    case 'a':
      u = unitById(e[1]); if (!u) break;
      if (e[2] === 'f') { u.fireT = 0.14; u.recoilT = 0.12; }
      else if (e[2] === 'F') { u.fireT = 0.2; u.recoilT = 0.2; }
      else if (e[2] === 'l') u.lungeT = 0.16;
      else if (e[2] === 'c') u.fireT = Math.max(u.fireT || 0, 0.16);
      else if (e[2] === 'r') u.recoilT = 0.06;
      break;
    case 'h':
      u = unitById(e[1]); if (!u || u.isStruct) break;
      u.stagT = 0.14; u.stagDir = e[2];
      if (isMe(e[3]) && !u._hidden) { var ap = aimPoint(u); addFx({ k: 'hitmark', x: ap.x, y: ap.y, t: 0, dur: 0.18 }); }
      break;
    case 'end': showEnd(e[1]); break;
  }
}
function presentLocal() { if (!G || !G.ev || !G.ev.length) return; var evs = G.ev; G.ev = []; evs.forEach(present); }

/* Visual-only timers and ambient effects, driven by what each unit is doing. */
function updateVisuals(dt) {
  if (!G) return;
  if (G.toastT > 0) { G.toastT -= dt; if (G.toastT <= 0) toastEl.textContent = ''; }
  if (G.hurtT > 0) G.hurtT -= dt;
  if (G.hitDirs) G.hitDirs = G.hitDirs.filter(function (h) { h.t -= dt; return h.t > 0; });
  updateAlerts(dt);
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 28);
  if (G.moveMark) { G.moveMark.t -= dt; if (G.moveMark.t <= 0 || (NET.mode === 'local' && G.player && !G.player.move)) G.moveMark = null; }
  G.feed.forEach(function (f) { f.t -= dt; });
  if (G.feed.length && G.feed[G.feed.length - 1].t <= 0) { G.feed = G.feed.filter(function (f) { return f.t > 0; }); renderFeed(); }
  G.fx = G.fx.filter(function (f) { f.t += dt; if (f.k === 'chip') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 520 * dt; } return f.t < f.dur; });
  G.texts = G.texts.filter(function (t) { t.t += dt; t.y -= 40 * dt; return t.t < 0.9; });
  G.units.forEach(function (u) { visUnit(u, dt); });
  G.structs.forEach(function (s) {
    if (s.flashT > 0) s.flashT -= dt;
    if (s.recoilT > 0) s.recoilT -= dt;
    if (s.dead && Math.random() < dt * 3) addFx({ k: 'smoke', x: s.x + rnd(-30, 30), y: s.y - rnd(10, 60), t: 0, dur: 1.4, big: 1 });
  });
}
function visUnit(u, dt) {
  if (u.flashT > 0) u.flashT -= dt;
  if (u.recoilT > 0) u.recoilT -= dt;
  if (u.fireT > 0) u.fireT -= dt;
  if (u.stagT > 0) u.stagT -= dt;
  if (u.lungeT > 0) u.lungeT -= dt;
  if (u.movedT > 0) u.movedT -= dt;
  if (u._px != null && !u.dead && !u._hidden) {
    var d = vlen(u.x - u._px, u.y - u._py);
    if (d > 0.3 && d < 80) { u.walk = (u.walk || 0) + d; u.movedT = 0.12; }
  }
  u._px = u.x; u._py = u.y;
  if (u.dead) { if (NET.mode === 'online') u.deathT = (u.deathT || 0) + dt; return; }
  if (u._hidden) return;
  if (u.movedT > 0 && Math.random() < dt * (u.dash ? 30 : 5)) addFx({ k: 'dust', x: u.x + rnd(-8, 8), y: u.y + 2, t: 0, dur: 0.45 });
  var aura = u._aura != null ? u._aura : (u.buffs && sumBuff(u, 'aura') > 0);
  if (aura && Math.random() < dt * 14) addFx({ k: 'flame', x: u.x + rnd(-270, 270) * 0.7, y: u.y + rnd(-270, 270) * 0.5, t: 0, dur: 0.4 });
  if (u.cone && u.cone.ab && u.cone.ab.dur > 0.1 && Math.random() < 0.9) addFx({ k: 'cone', x: u.x, y: u.y - 30, a: Math.atan2(u.cone.dir.y, u.cone.dir.x), ang: u.cone.ab.ang, r: u.cone.ab.range, t: 0, dur: 0.15, c: u.cone.ab.n === 'Sweep' ? '#FF9A3D' : '#FFE29A' });
}

/* Red Alert style EVA alerts: short, queued, flashing */
var ALERT = { q: [], t: 0, el: document.getElementById('alert'), lastStruct: {} };
function showAlert(txt, cls) { if (ALERT.q.length > 3) ALERT.q.shift(); ALERT.q.push({ txt: txt, cls: cls || 'info' }); }
function alertStruct(s) { var now = G.time; if (ALERT.lastStruct[s.id] != null && now - ALERT.lastStruct[s.id] < 12) return; ALERT.lastStruct[s.id] = now; showAlert((s.kind === 'hq' ? 'FORT' : s.kind === 'depot' ? 'SUPPLY BUCKET' : 'SAND TURRET') + ' UNDER ATTACK', 'bad'); }
function updateAlerts(dt) {
  if (ALERT.t > 0) { ALERT.t -= dt; if (ALERT.t <= 0) { ALERT.el.hidden = true; ALERT.el.className = 'hud'; } return; }
  if (!ALERT.q.length) return;
  var a = ALERT.q.shift(); ALERT.el.textContent = a.txt; ALERT.el.className = 'hud on ' + a.cls; ALERT.el.hidden = false; ALERT.t = 2.4;
  if (a.cls === 'bad') playSfx('alert');
}
function showEnd(winner) {
  if (!G) return;
  G.over = true; G.winner = winner;
  var p = G.player, won = winner === MYTEAM, st = (p && p.st) || { k: 0, d: 0 };
  document.getElementById('endTitle').textContent = won ? 'Mission accomplished' : 'Mission failed';
  document.getElementById('endEyebrow').textContent = winner === 0 ? 'Tan bucket bunker destroyed · Green wins' : 'Green sand fort destroyed · Tan wins';
  showAlert(won ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED', won ? 'good' : 'bad');
  document.getElementById('endStats').textContent = 'Match time ' + fmtTime(G.time) + ' · You fought as ' + (p ? p.name : '-') + ' · ' + st.k + ' kills, ' + st.d + ' casualties · Level ' + (p ? p.lvl : '-');
  document.getElementById('again').textContent = NET.mode === 'online' ? 'Back to lobby' : 'Roll call';
  document.getElementById('endModal').hidden = false;
}
