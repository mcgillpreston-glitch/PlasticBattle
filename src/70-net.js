/* Browser only: online PvP. The server runs the match; this client sends commands and draws server snapshots. */
var PF_DEFAULT_SERVER = 'wss://plastic-front.prestonmcgill.workers.dev/ws';   // the deployed game server on Cloudflare (see README); players can override it under Server
/* Interpolation delay behind the newest snapshot: 60 ms on a steady connection, growing with measured arrival jitter up to 160 ms. */
function interpDelay() { return clamp(0.045 + 2.5 * (NETC.jit == null ? 0.016 : NETC.jit), 0.045, 0.14); }
var NETC = { ws: null, code: null, leaving: false, lastErr: null, cid: null, room: null, snaps: [], cur: null, off: null, myUid: 0, aimT: 0, pingT: 0, ping: 0, inMatch: false, offerKey: '' };
var KIND = ['hero', 'melee', 'rifle', 'tank', 'jeep', 'mortar'];
var PKIND = ['shot', 'bullet', 'rocket', 'jack'];
var SLOTS = ['Q', 'W', 'E', 'R', 'D', 'F'];

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function serverUrl() {
  var q = null; try { q = new URLSearchParams(location.search).get('server'); } catch (e) {}
  if (q) return q;
  var saved = lsGet('pf_server'); if (saved) return saved;
  if ((location.protocol === 'http:' || location.protocol === 'https:') && !/github\.io$/.test(location.hostname)) return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  return PF_DEFAULT_SERVER;
}
function oStatus(txt) { document.getElementById('oStatus').textContent = txt; }
function lStatus(txt) { document.getElementById('lStatus').textContent = txt; }

function httpOf(url) { return url.replace(/^ws/, 'http').replace(/\/ws\/?$/, ''); }
function wakeServer() { var u = serverUrl(); if (!u) return; try { fetch(httpOf(u) + '/health', { mode: 'no-cors', cache: 'no-store' }).catch(function () {}); } catch (e) {} }
function hostOf(url) { return url.replace(/^wss?:\/\//, '').replace(/\/ws\/?$/, ''); }
/* Rooms are found or created over HTTP first (free servers may need waking), then one WebSocket is opened to that room. */
function apiCall(method, path, body, then, attempt) {
  attempt = attempt || 0;
  var base = serverUrl();
  if (!base) { oStatus('No game server is set up yet. Deploy the server (see README), then enter its address under Server.'); document.getElementById('oSrv').open = true; return; }
  var host = hostOf(base);
  oStatus(attempt ? 'Waking the server at ' + host + '… (free servers sleep when idle; this can take up to a minute)' : 'Contacting ' + host + '…');
  var retry = function () {
    if (attempt < 8) { setTimeout(function () { apiCall(method, path, body, then, attempt + 1); }, 6000); }
    else oStatus('Could not reach the server at ' + host + '. Check the address under Server, or try again later.');
  };
  var req;
  try { req = fetch(httpOf(base) + path, { method: method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }); }
  catch (e) { oStatus('That server address is not valid.'); return; }
  req.then(function (r) {
    if (r.status >= 500 && r.status !== 503) { retry(); return; }
    return r.json().then(function (d) { if (!r.ok) { oStatus(d && d.error ? d.error : 'The server said no (' + r.status + ').'); return; } then(d); }, retry);
  }, retry);
}
function netConnect(code, name, then) {
  var base = serverUrl(); if (!base) return;
  if (NETC.ws && NETC.ws.readyState <= 1) { if (NETC.code === code && NETC.ws.readyState === 1) { then && then(); return; } NETC.leaving = true; NETC.ws.close(); }
  var host = hostOf(base), url = base.replace(/\/?$/, '') + '/' + code + '?name=' + encodeURIComponent(name || '');
  oStatus('Joining room ' + code + ' at ' + host + '…');
  var ws; try { ws = new WebSocket(url); } catch (e) { oStatus('That server address is not valid.'); return; }
  var opened = false;
  NETC.ws = ws; NETC.code = code; NETC.leaving = false;
  ws.onopen = function () { opened = true; oStatus('Connected to ' + host + '.'); if (then) then(); };
  ws.onmessage = function (m) { var d; try { d = JSON.parse(m.data); } catch (e) { return; } netMsg(d); };
  ws.onclose = function (ev) {
    if (NETC.ws !== ws) return;
    NETC.ws = null; NETC.code = null;
    var leaving = NETC.leaving; NETC.leaving = false;
    if (!opened) { oStatus(ev && ev.code === 4000 && ev.reason ? ev.reason : 'Could not join room ' + code + ' at ' + host + '. It may have closed; try again.'); return; }
    var was = NETC.inMatch || NETC.room;
    NETC.room = null; NETC.cid = null;
    if (NETC.inMatch) { NETC.inMatch = false; if (G) G.over = true; if (!leaving) showToast('Connection to the server was lost', 4); }
    if (was || leaving) { openOnline(); oStatus(leaving ? 'Left the room.' : (NETC.lastErr || 'Disconnected from the server.')); }
    NETC.lastErr = null;
  };
}
function netSend(o) { if (NETC.ws && NETC.ws.readyState === 1) NETC.ws.send(JSON.stringify(o)); }

function netMsg(m) {
  switch (m.t) {
    case 'hello': NETC.cid = m.cid; break;
    case 'err': NETC.lastErr = m.msg; if (NETC.inMatch) showToast(m.msg, 2.5); else if (!document.getElementById('lobbyPanel').hidden) lStatus(m.msg); else oStatus(m.msg); break;
    case 'room': NETC.room = m; if (!NETC.inMatch) showLobby(); break;
    case 'start': netStart(m); break;
    case 's': netSnap(m); break;
    case 'sb': netScore(m); break;
    case 'names': m.n.forEach(function (a) { var u = NET.byId && NET.byId[a[0]]; if (u) { u.pname = a[1] || null; u.bot = !a[1]; } }); break;
    case 'pong': NETC.ping = Math.round(performance.now() - m.c); var pe = document.getElementById('pingEl'); pe.hidden = false; pe.textContent = NETC.ping + ' MS'; break;
  }
}

/* ---------- Match mirror ---------- */
function netStart(m) {
  NET.mode = 'online'; MYTEAM = m.team; NETC.inMatch = true; NETC.myUid = m.you; NETC.offerKey = '';
  document.body.classList.add('online');
  uid = 1;
  G = { time: 0, units: [], structs: [], proj: [], lobs: [], mines: [], fx: [], texts: [], kills: [0, 0], nextWave: 3, wave: 0, crates: [], over: false, winner: -1,
    barrage: null, player: null, feed: [], toastT: 0, hurtT: 0, blockers: [], moveMark: null, rounds: [], shake: 0, ev: [] };
  NET.byId = {};
  makeStructs();
  m.structs.forEach(function (a, i) { var s = G.structs[i]; if (!s) return; s.id = a[0]; NET.byId[s.id] = s; });
  makeCrates();
  m.roster.forEach(function (r) { var u = mirrorHero(r, r.uid === m.you); G.units.push(u); NET.byId[u.id] = u; });
  G.player = NET.byId[m.you];
  rebuildBlockers();
  NETC.snaps = []; NETC.cur = null; NETC.off = null; NETC.jit = null; NETC.lastArr = null;
  ordersModal.hidden = true; swapModal.hidden = true; menuEl.hidden = true; closeSB(); document.getElementById('endModal').hidden = true;
  draftEl.hidden = true; document.getElementById('help').hidden = false;
  enterMatch();
  showAlert('DEPLOYED WITH ' + (MYTEAM === 0 ? 'GREEN' : 'TAN') + ' ARMY · FIELD ORDERS AT BASE FROM LEVEL 3', 'info');
}
function mirrorHero(r, mine) {
  var spec = HEROES[r.hero], f = fountain(r.team);
  return { id: r.uid, kind: 'hero', team: r.team, spec: spec, pose: spec.key, name: spec.name, pname: r.name || null, isPlayer: !!mine, bot: !r.name,
    x: f.x, y: f.y, r: 22, lvl: 3, xp: 0, hp: spec.hp, _mh: spec.hp, _rng: spec.range, _acd: spec.acd, dead: false, deathT: 0, respawn: 0,
    facing: r.team === 0 ? 1 : -1, buffs: [], shield: 0, aug: {}, augs: [], ordersDone: 0, offer: null, target: null, wind: null, dash: null, cone: null, chan: null,
    cd: { Q: 0, W: 0, E: 0, R: 0, D: 0, F: 0 }, cdMax: { Q: 1, W: 1, E: 1, R: 1, D: 1, F: 1 },
    st: { k: 0, d: 0, a: 0, cs: 0, dmgH: 0, dmgS: 0, taken: 0, heal: 0, best: 0 }, _hidden: r.team !== MYTEAM };
}
function mirrorMinion(a) {
  var type = KIND[a[1]], small = type === 'melee' || type === 'rifle' || type === 'mortar';
  return { id: a[0], kind: 'minion', type: type, team: a[2], x: a[3], y: a[4], hp: a[5], maxHp: a[6], facing: a[7], r: type === 'tank' ? 28 : type === 'jeep' ? 24 : 15,
    h: small ? 64 : 0, pose: small ? 'm_' + type : null, buffs: [], shield: 0, dead: false, deathT: 0 };
}
function netSnap(S) {
  var now = performance.now() / 1000, est = S.tm - now;
  if (NETC.lastArr != null && NETC.inMatch) { var j = Math.min(0.2, Math.abs(now - NETC.lastArr - 0.05)); NETC.jit = NETC.jit == null ? j : NETC.jit * 0.95 + j * 0.05; }
  NETC.lastArr = now;
  if (NETC.off == null || Math.abs(est - NETC.off) > 0.35) NETC.off = est; else NETC.off += (est - NETC.off) * 0.05;
  S.pu = {}; S.u.forEach(function (a) { S.pu[a[0]] = a; });
  S.pr = {}; (S.r || []).forEach(function (a) { S.pr[a[0]] = a; });
  S.pp = {}; (S.p || []).forEach(function (a) { S.pp[a[0]] = a; });
  NETC.snaps.push(S);
}
/* Client-side prediction for your own hero's ground moves. A click starts the unit moving at once, using the same pathing as the server.
   Each snapshot carries the server's position at the moment it applied your latest move (server time). We compare that with our own
   prediction at the same moment and fold the difference in gradually (corr decays), so corrections never show as a snap. */
var PRED = { on: false, u: null, move: null, stop: 4, target: null, wind: null, dash: null, pend: {}, srvCd: {}, lp: [], prevPid: {}, hist: [], corr: { x: 0, y: 0 }, ackS: 0 };
function predStart() {
  var p = G.player; if (!p || p.dead) return false;
  if (!PRED.on || !PRED.u) { PRED.on = true; PRED.u = { x: p.x, y: p.y, r: p.r, path: null, pathGoal: null, pathVer: -1, pathCd: 0, repath: false, scAt: null, facing: p.facing }; PRED.corr = { x: 0, y: 0 }; PRED.hist = []; }
  return true;
}
function predOff() { PRED.on = false; PRED.u = null; PRED.move = null; PRED.target = null; PRED.wind = null; PRED.dash = null; PRED.hist = []; PRED.corr = { x: 0, y: 0 }; }
/* ability press: the cooldown counts down here at once and the press flashes; the server's cooldown takes over once it confirms the cast,
   and a press the server never confirms (refused or lost) drops the local cooldown after a short grace. A dash is predicted in full. */
function predCast(slot, w) {
  var p = G.player; if (!p || p.dead || p.dash) return;
  if ((p.cd[slot] || 0) > 0 || PRED.pend[slot]) return;
  var ab = abilityOf(p, slot); if (!ab) return;
  PRED.pend[slot] = { t: performance.now() / 1000, cd: p.cdMax[slot] || 1 };
  p.fireT = Math.max(p.fireT || 0, 0.14); p.recoilT = 0.12;
  if (ab.t === 'proj') {
    var mz = muzzle(p), dx = w.x - p.x, dy = w.y - p.y, L = vlen(dx, dy) || 1, sp = ab.speed;
    PRED.lp.push({ x: mz.x, y: mz.y, vx: dx / L * sp, vy: dy / L * sp, life: ab.range / sp, age: 0, kind: ab.rocket ? 'rocket' : 'shot', team: p.team, w: ab.w || 20, sid: 0, blend: 0 });
    if (typeof addFx === 'function') addFx({ k: 'muzzle', x: mz.x, y: mz.y, a: Math.atan2(dy, dx), t: 0, dur: 0.08, s: 1.4 });
  }
  if (ab.t === 'dash' && predStart()) {
    var dx = w.x - PRED.u.x, dy = w.y - PRED.u.y, L = vlen(dx, dy) || 1;
    var dd = Math.min(ab.dist, Math.max(L, 80)), to = dashCut(PRED.u, clampLane({ x: PRED.u.x + dx / L * dd, y: PRED.u.y + dy / L * dd }));
    PRED.dash = { fx: PRED.u.x, fy: PRED.u.y, tx: to.x, ty: to.y, t: 0, dur: 0.18 };
    PRED.move = null; PRED.target = null; PRED.wind = null;
  }
}
function predDashAdvance(raw) {
  var d = PRED.dash, u = PRED.u; d.t += raw;
  var k = Math.min(1, d.t / d.dur);
  u.x = d.fx + (d.tx - d.fx) * k; u.y = d.fy + (d.ty - d.fy) * k;
  if (k >= 1) PRED.dash = null;
}
/* a projectile the server has just started from our team: it is the flight of the oldest local copy of the same kind */
function predMatchProj(list) {
  var prev = PRED.prevPid, now = {};
  list.forEach(function (a) {
    now[a[0]] = 1;
    if (prev[a[0]] || a[6] !== MYTEAM) return;
    var kind = PKIND[a[5]];
    for (var i = 0; i < PRED.lp.length; i++) { var l = PRED.lp[i]; if (!l.sid && l.kind === kind) { l.sid = a[0]; l.blend = 0.15; break; } }
  });
  PRED.prevPid = now;
}
/* local copies fly on their own, then ease into the server's copy over a short blend, so the switch does not jump; the server copy is hidden while blending */
function predProj(raw) {
  var srv = G.proj.filter(function (q) { return q.id; }), keep = [], hide = {};
  PRED.lp.forEach(function (l) {
    l.age += raw; l.x += l.vx * raw; l.y += l.vy * raw;
    if (l.sid) {
      l.blend -= raw;
      var t = null; for (var i = 0; i < srv.length; i++) if (srv[i].id === l.sid) { t = srv[i]; break; }
      if (!t || l.blend <= 0) return;
      hide[l.sid] = 1; var k = 1 - Math.exp(-raw * 10); l.x += (t.x - l.x) * k; l.y += (t.y - l.y) * k;
    } else if (l.age > l.life + 0.25) return;   // its flight is over and the server never started it
    keep.push(l);
  });
  PRED.lp = keep;
  G.proj = srv.filter(function (q) { return !hide[q.id]; }).concat(keep);
}
function predCooldowns() {
  var p = G.player, now = performance.now() / 1000;
  Object.keys(PRED.pend).forEach(function (s) {
    var pe = PRED.pend[s];
    if (!p || p.dead || PRED.srvCd[s] > 0) { delete PRED.pend[s]; return; }   // the server has it now: its value is authoritative
    if (now - pe.t > 0.6) { delete PRED.pend[s]; return; }                // not confirmed: refused or lost
    p.cd[s] = Math.max(0.05, pe.cd - (now - pe.t));
  });
}
function predMove(pt) { if (!PRED.dash && predStart()) { PRED.target = null; PRED.wind = null; PRED.stop = 4; PRED.move = freePoint({ x: pt.x, y: pt.y }, G.player.r); } }
function predHalt() { PRED.move = null; PRED.target = null; PRED.wind = null; }
/* attack order: chase the target's last known position and wind up locally once in range; the server confirms the shot */
function predAttack(t) { if (predStart()) { PRED.target = t; PRED.move = null; PRED.wind = null; } }
function predHistAt(c) {
  var h = PRED.hist; if (!h.length || c < h[0].t) return null;
  for (var i = h.length - 1; i > 0; i--) if (h[i - 1].t <= c) { var a = h[i - 1], b = h[i], f = b.t > a.t ? (c - a.t) / (b.t - a.t) : 0; return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }; }
  return h[0];
}
/* local wind-up and firing visuals for a predicted attack; set after the snapshots so the server's wind does not overwrite them */
function predVisual(raw) {
  var p = G.player; if (!p || !PRED.on) return;
  if (PRED.cd > 0) PRED.cd -= raw;
  var tg = PRED.target;
  if (!tg || p.dead) { PRED.wind = null; return; }
  var rng = aaRange(p) + (tg.r || 0) + p.r * 0.5;
  if (vlen(tg.x - PRED.u.x, tg.y - PRED.u.y) > rng) { PRED.wind = null; return; }
  if (!PRED.wind && PRED.cd <= 0) PRED.wind = { t: 0, dur: windTime(p) };
  if (PRED.wind) {
    PRED.wind.t += raw;
    if (!p.wind || p.wind.tgt !== tg) p.wind = { tgt: tg, t: 0, dur: PRED.wind.dur };
    p.wind.t = PRED.wind.t;
    if (PRED.wind.t >= PRED.wind.dur) { PRED.wind = null; p.wind = null; PRED.cd = aaCd(p); p.fireT = 0.14; p.recoilT = 0.12; }
  }
}
function predReconcile(a, tm) {
  if (!PRED.on || !PRED.u) return;
  var p = G.player;
  if (p.dead) { predOff(); return; }
  // 1. the server's position at the moment it applied our latest ground order, against our prediction at that same moment
  var ackMs = a[21] || 0;
  if (ackMs && ackMs / 1000 > PRED.ackS) {
    PRED.ackS = ackMs / 1000;
    var h = predHistAt(PRED.ackS - NETC.off);
    if (h) {
      var ex = a[22] - h.x, ey = a[23] - h.y;
      PRED.u.x += ex; PRED.u.y += ey;
      if (Math.hypot(ex, ey) <= 120) { PRED.corr.x -= ex; PRED.corr.y -= ey; } else { PRED.corr = { x: 0, y: 0 }; }
    }
  }
  // 2. the server's position right now, against our prediction from the time the snapshot describes (a rough check for pushes and knockbacks)
  var hs = predHistAt(tm - NETC.off);
  if (hs && Math.hypot(a[3] - hs.x, a[4] - hs.y) > 150) { PRED.u.x = a[3]; PRED.u.y = a[4]; PRED.corr = { x: 0, y: 0 }; PRED.move = null; }
}
function predStep(raw) {
  var p = G.player; if (!p || !PRED.on || !PRED.u) return;
  var u = PRED.u;
  if (u.pathCd > 0) u.pathCd -= raw;
  var tg = PRED.target;
  if (tg && (tg.dead || tg._hidden)) { PRED.target = tg = null; PRED.wind = null; }
  if (tg) {
    var rng = aaRange(p) + (tg.r || 0) + u.r * 0.5;
    if (vlen(tg.x - u.x, tg.y - u.y) <= rng) { PRED.move = null; u.path = null; }
    else { PRED.move = { x: tg.x, y: tg.y }; PRED.stop = rng * 0.9; }
  }
  if (PRED.dash) predDashAdvance(raw);
  if (PRED.move) {
    var spd = moveSpeed(p);
    if (spd > 0 && stepToward(u, PRED.move.x, PRED.move.y, spd * raw, PRED.stop)) PRED.move = null;
  }
  if (tg && Math.abs(tg.x - u.x) > 4) p.facing = tg.x < u.x ? -1 : 1;
  var now = performance.now() / 1000;
  PRED.hist.push({ t: now, x: u.x, y: u.y });
  while (PRED.hist.length > 2 && PRED.hist[0].t < now - 2) PRED.hist.shift();
  var k = Math.exp(-raw * 12); PRED.corr.x *= k; PRED.corr.y *= k;
  p.x = u.x + PRED.corr.x; p.y = u.y + PRED.corr.y;
}
/* test hook: a point `dist` away from unit p, in the first direction clear of walls */
function clearDir(p, dist) {
  var angs = [0, 0.7, -0.7, 1.4, -1.4, 2.1, -2.1, 2.8, -2.8, 3.14];
  for (var i = 0; i < angs.length; i++) { var tx = p.x + Math.cos(angs[i]) * dist, ty = p.y + Math.sin(angs[i]) * dist; if (segClear(p.x, p.y, tx, ty, p.r)) return { x: tx, y: ty }; }
  return { x: p.x + dist, y: p.y };
}
/* test hook: the prediction state next to the server's latest position for our hero */
function predDebug() {
  var cur = NETC.cur, me = G && G.player, sv = cur && me && cur.pu[me.id];
  return { on: PRED.on, pred: PRED.u ? { x: PRED.u.x, y: PRED.u.y } : null, corr: { x: PRED.corr.x, y: PRED.corr.y }, server: sv ? { x: sv[3], y: sv[4] } : null, winding: !!(me && me.wind), target: PRED.target ? PRED.target.id : 0, moving: !!PRED.move, dash: !!PRED.dash, spd: me ? moveSpeed(me) : -1, pend: Object.keys(PRED.pend) };
}
function netFrame(raw) {
  NETC.pingT -= raw; if (NETC.pingT <= 0 && NETC.ws) { NETC.pingT = 2; netSend({ t: 'ping', c: performance.now() }); }
  if (!G || !NETC.inMatch) return;
  var rt = performance.now() / 1000 + (NETC.off || 0) - interpDelay();
  predStep(raw);
  while (NETC.snaps.length > 8) { NETC.cur = NETC.snaps.shift(); applySnap(NETC.cur); }
  while (NETC.snaps.length && NETC.snaps[0].tm <= rt) { NETC.cur = NETC.snaps.shift(); applySnap(NETC.cur); }
  var A = NETC.cur, B = NETC.snaps[0]; if (!A) return;
  var al = B ? clamp((rt - A.tm) / Math.max(0.001, B.tm - A.tm), 0, 1) : 0, since = Math.max(0, rt - A.tm);
  G.units.forEach(function (u) {
    if (u._hidden) return;
    if (u === G.player && PRED.on) return;
    var a = A.pu[u.id]; if (!a) return; var b = B && B.pu[u.id];
    if (b && !u.dead && vlen(b[3] - a[3], b[4] - a[4]) < 400) { u.x = a[3] + (b[3] - a[3]) * al; u.y = a[4] + (b[4] - a[4]) * al; } else { u.x = a[3]; u.y = a[4]; }
    if (u.dash && u.dash.leap) u.dash.t = Math.min(u.dash.dur, u.dash.t0 + since);
  });
  G.rounds.forEach(function (r) { var a = A.pr[r.id], b = B && B.pr[r.id]; if (a && b) { r.x = a[1] + (b[1] - a[1]) * al; r.y = a[2] + (b[2] - a[2]) * al; } });
  G.proj.forEach(function (p) { var a = A.pp[p.id], b = B && B.pp[p.id]; if (a && b) { p.x = a[1] + (b[1] - a[1]) * al; p.y = a[2] + (b[2] - a[2]) * al; } else if (a) { p.x = a[1] + p.vx * since; p.y = a[2] + p.vy * since; } });
  G.lobs.forEach(function (l) { l.t = Math.min(l.delay, l.t0 + since); });
  predVisual(raw);
  predCooldowns();
  predProj(raw);
  NETC.aimT -= raw;
  if (G.player && G.player.chan && mouse.inside && NETC.aimT <= 0) { NETC.aimT = 0.1; netSend({ t: 'aim', x: Math.round(mouse.wx), y: Math.round(mouse.wy) }); }
}
function applySnap(S) {
  G.time = S.tm; G.kills = S.k; G.wave = S.w; G.nextWave = S.nw;
  var seen = {};
  S.u.forEach(function (a) {
    var id = a[0], u = NET.byId[id];
    if (!u) { if (a[1] === 0) return; u = mirrorMinion(a); G.units.push(u); NET.byId[id] = u; }
    seen[id] = 1;
    if (u._hidden) { u._hidden = false; u.x = a[3]; u.y = a[4]; u._px = null; }
    u.hp = a[5]; if (u.kind === 'hero') u._mh = a[6]; else u.maxHp = a[6];
    u.facing = a[7];
    var f = a[8], dead = !!(f & 1);
    if (dead !== !!u.dead) u.deathT = 0;
    u.dead = dead;
    u.buffs = f & 2 ? [{ ghost: 1, t: 1 }] : [];
    u.slowT = f & 4 ? 1 : 0; u.burnT = f & 8 ? 1 : 0;
    if (u.kind === 'hero') {
      u.lvl = a[9]; u.shield = a[10];
      var wt = a[11] ? unitById(a[11]) : null;
      u.wind = wt ? { tgt: wt, t: a[12] / 100, dur: 1 } : null;
      var long = !!(f & 512), dd = long ? 0.9 : 0.4;
      u.dash = f & 16 ? { leap: 1, t0: (a[13] / 100) * dd, t: (a[13] / 100) * dd, dur: dd } : null;
      u.cone = f & 32 ? { ab: { ang: a[16] / 100, range: a[15], dur: 1, n: f & 256 ? 'Sweep' : 'x' }, dir: { x: Math.cos(a[14] / 100), y: Math.sin(a[14] / 100) } } : null;
      u.chan = f & 64 ? {} : null; u._aura = !!(f & 128);
      u.respawn = a[17] / 10; u.aug.scale = a[18] / 100; u._rng = a[19]; u._acd = a[20] / 100;
    }
  });
  G.units = G.units.filter(function (u) {
    if (seen[u.id]) return true;
    if (u.kind === 'hero') { if (u.team !== MYTEAM) u._hidden = true; return true; }
    delete NET.byId[u.id]; return false;
  });
  if (G.player && S.pu[G.player.id]) predReconcile(S.pu[G.player.id], S.tm);
  var blk = false;
  S.s.forEach(function (a) { var s = NET.byId[a[0]]; if (!s) return; s.hp = a[1]; var d = !!a[2]; if (d !== s.dead) { s.dead = d; blk = true; } s.respawn = a[3] / 10; });
  if (blk) rebuildBlockers();
  G.rounds = (S.r || []).map(function (a) { return { id: a[0], x: a[1], y: a[2], lx: a[3], ly: a[4], team: a[5], heavy: !!(a[6] & 1), hero: !!(a[6] & 2) }; });
  G.proj = (S.p || []).map(function (a) { return { id: a[0], x: a[1], y: a[2], vx: a[3], vy: a[4], kind: PKIND[a[5]], team: a[6] }; });
  predMatchProj(S.p || []);
  G.lobs = (S.l || []).map(function (a) { return { id: a[0], x: a[1], y: a[2], sx: a[3], sy: a[4], t0: a[5] / 100, t: a[5] / 100, delay: a[6] / 100, r: a[7], team: a[8], single: a[9] & 1 ? {} : null, smoke: !!(a[9] & 2) }; });
  G.mines = (S.m || []).map(function (a) { return { x: a[0], y: a[1], team: a[2], arm: a[3] ? 0.1 : 0 }; });
  G.crates.forEach(function (c, i) { c.up = !!(S.c & (1 << i)); });
  G.barrage = S.b ? { r: 150, beams: S.b.map(function (p) { return { x: p[0], y: p[1] }; }) } : null;
  if (S.me) applyMe(S.me);
  if (S.ev) S.ev.forEach(present);
}
function applyMe(me) {
  var u = G.player; if (!u) return;
  SLOTS.forEach(function (s, i) { u.cd[s] = me.cd[i] / 10; PRED.srvCd[s] = u.cd[s]; u.cdMax[s] = Math.max(0.1, me.cm[i] / 10); });
  u.xp = me.xp; u.ordersDone = me.od; u.tagMark = me.tag ? {} : null;
  if (me.tg) { var t = unitById(me.tg); if (t) u.target = t; } else u.target = null;
  u.augs = me.ag || [];
  u.offer = me.of || null;
  var key = u.offer ? JSON.stringify(u.offer) : '';
  if (u.offer && (NET.wantOrders || (!ordersModal.hidden && key !== NETC.offerKey))) { NET.wantOrders = false; renderOrders(); ordersModal.hidden = false; }
  if (!u.offer && !ordersModal.hidden) ordersModal.hidden = true;
  NETC.offerKey = key;
}
function netScore(m) {
  m.h.forEach(function (a) {
    var u = NET.byId && NET.byId[a[0]]; if (!u) return;
    u.lvl = a[1]; u.st = { k: a[2], d: a[3], a: a[4], cs: a[5], dmgH: a[6], dmgS: a[7], taken: a[8], heal: a[9], best: a[10] };
    if (!u.isPlayer) { u.augs = []; for (var i = 0; i < a[11]; i++) u.augs.push(''); }
    if (u._hidden) { u.dead = !!a[12]; u.respawn = a[13] / 10; }
  });
}

/* ---------- Menus: offline vs online, lobby ---------- */
var tabBots = document.getElementById('tabBots'), tabOnline = document.getElementById('tabOnline');
function setTab(online) {
  tabBots.classList.toggle('on', !online); tabOnline.classList.toggle('on', online);
  tabBots.setAttribute('aria-selected', String(!online)); tabOnline.setAttribute('aria-selected', String(online));
  document.getElementById('botsPanel').hidden = online;
  document.getElementById('onlinePanel').hidden = !online || !!NETC.room;
  document.getElementById('lobbyPanel').hidden = !online || !NETC.room;
  if (online && NETC.room) renderLobby();
}
function openOnline() { draftEl.hidden = false; document.getElementById('endModal').hidden = true; ordersModal.hidden = true; closeSB(); setTab(true); }
function showLobby() { draftEl.hidden = false; setTab(true); }
function backToLobby() { NETC.inMatch = false; document.getElementById('endModal').hidden = true; if (NETC.room) showLobby(); else openOnline(); }
tabBots.addEventListener('click', function () { setTab(false); });
tabOnline.addEventListener('click', function () { setTab(true); wakeServer(); });

function myName() { var n = document.getElementById('oName').value.trim().slice(0, 16); if (n) lsSet('pf_name', n); return n; }
document.getElementById('oName').value = lsGet('pf_name') || '';
document.getElementById('oServer').value = lsGet('pf_server') || serverUrl() || '';
document.getElementById('oServerSave').addEventListener('click', function () {
  var v = document.getElementById('oServer').value.trim();
  if (v && !/^wss?:\/\//.test(v)) v = 'wss://' + v.replace(/^https?:\/\//, '').replace(/\/(ws\/?)?$/, '') + '/ws';
  v = v.replace(/\/$/, '');
  if (v) lsSet('pf_server', v); else { try { localStorage.removeItem('pf_server'); } catch (e) {} }
  document.getElementById('oServer').value = v || serverUrl();
  if (NETC.ws) NETC.ws.close();
  oStatus(v ? 'Server saved.' : 'Server reset to default.');
});
document.getElementById('oQuick').addEventListener('click', function () { audioInit(); var n = myName(); apiCall('POST', '/api/quick', {}, function (d) { netConnect(d.code, n); }); });
document.getElementById('oCreate').addEventListener('click', function () { audioInit(); var n = myName(), size = Number(document.getElementById('oSize').value); apiCall('POST', '/api/room', { size: size }, function (d) { netConnect(d.code, n); }); });
document.getElementById('oJoin').addEventListener('click', function () {
  audioInit(); var n = myName(), code = document.getElementById('oCode').value.trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) { oStatus('Room codes are 4 letters.'); return; }
  apiCall('GET', '/api/room/' + code, null, function () { netConnect(code, n); });
});
document.getElementById('oCode').addEventListener('keydown', function (e) { if (e.key === 'Enter') document.getElementById('oJoin').click(); });

function renderLobby() {
  var R = NETC.room; if (!R) return;
  var me = R.players.find(function (p) { return p.cid === NETC.cid; }) || R.players[0];
  var host = R.host === NETC.cid;
  document.getElementById('lCode').textContent = R.code;
  document.getElementById('lMeta').textContent = 'Room · ' + R.size + ' v ' + R.size + ' · ' + R.players.length + ' of ' + (R.size * 2) + ' soldiers · bots fill the rest';
  [0, 1].forEach(function (team) {
    var ol = document.getElementById('lTeam' + team); ol.innerHTML = '';
    var ps = R.players.filter(function (p) { return p.team === team; });
    for (var i = 0; i < R.size; i++) {
      var li = document.createElement('li'), p = ps[i];
      if (p) {
        li.innerHTML = '<img alt=""><span class="ln"></span><span class="lh"></span>';
        li.querySelector('img').src = portrait(HEROES[p.hero].key, team);
        li.querySelector('.ln').textContent = p.name + (p.cid === R.host ? ' ★' : '') + (p.cid === NETC.cid ? ' (you)' : '');
        li.querySelector('.lh').textContent = HEROES[p.hero].name;
        if (p.cid === NETC.cid) li.className = 'me';
      } else { li.className = 'bot'; li.textContent = 'Bot (random hero)'; }
      ol.appendChild(li);
    }
  });
  if (me) {
    var h = HEROES[me.hero];
    document.getElementById('lHero').textContent = h.name;
    document.getElementById('lRole').textContent = h.role;
    document.getElementById('lRange').textContent = h.range + ' range · ' + h.hp + ' HP';
    var kit = document.getElementById('lKit'); kit.innerHTML = '';
    ['Q', 'W', 'E', 'R'].forEach(function (s) { var d = document.createElement('div'); d.className = 'row'; d.innerHTML = '<span><b></b> <span></span></span><span class="muted"></span>'; d.querySelector('b').textContent = s; d.querySelector('span span').textContent = h[s].n; d.querySelector('.muted').textContent = h[s].cd + 's'; kit.appendChild(d); });
    var fc = document.getElementById('lFig').getContext('2d'); fc.setTransform(1, 0, 0, 1, 0, 0); fc.clearRect(0, 0, 240, 288); fc.scale(1.2, 1.2); paintPose(fc, h.key, me.team, false);
    var rr = document.getElementById('lReroll'); rr.textContent = 'Request reassignment (' + me.rerolls + ')'; rr.disabled = me.rerolls < 1 || R.state !== 'lobby';
  }
  var st = document.getElementById('lStart'); st.hidden = !host; st.disabled = R.state !== 'lobby';
  var sz = document.getElementById('lSize'); sz.value = String(R.size); sz.disabled = !host || R.state !== 'lobby';
  document.getElementById('lSwitch').disabled = R.state !== 'lobby';
  lStatus(R.state === 'lobby' ? (host ? 'You are the host. Start when your squad is ready; bots fill any empty slots.' : 'Waiting for the host to start the match.')
    : R.state === 'game' ? 'Match in progress.' : 'Match over. Returning to the lobby…');
}
document.getElementById('lReroll').addEventListener('click', function () { netSend({ t: 'reroll' }); });
document.getElementById('lSwitch').addEventListener('click', function () { netSend({ t: 'team' }); });
document.getElementById('lStart').addEventListener('click', function () { audioInit(); netSend({ t: 'start' }); });
document.getElementById('lSize').addEventListener('change', function (e) { netSend({ t: 'size', size: Number(e.target.value) }); });
document.getElementById('lLeave').addEventListener('click', function () { NETC.room = null; if (NETC.ws) { NETC.leaving = true; NETC.ws.close(); } setTab(true); oStatus('Left the room.'); });
document.getElementById('lCopy').addEventListener('click', function () {
  var R = NETC.room; if (!R) return;
  var link = location.origin + location.pathname + '?room=' + R.code + (lsGet('pf_server') ? '&server=' + encodeURIComponent(lsGet('pf_server')) : '');
  var btn = this;
  var done = function () { btn.textContent = 'Link copied'; setTimeout(function () { btn.textContent = 'Copy invite link'; }, 1500); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, function () { lStatus('Invite link: ' + link); });
  else lStatus('Invite link: ' + link);
});
(function () {
  var code = null; try { code = new URLSearchParams(location.search).get('room'); } catch (e) {}
  if (code && /^[A-Za-z]{4}$/.test(code)) { document.getElementById('oCode').value = code.toUpperCase(); NETC.inviteCode = code.toUpperCase(); }
})();
