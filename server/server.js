// Plastic Front game server: serves the game page and runs authoritative real-time matches over WebSocket.
// Usage: node server/server.js   (PORT env var, default 8080)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { createSim } = require('./sim');

const PORT = Number(process.env.PORT) || 8080;
const INDEX = path.join(__dirname, '..', 'index.html');
const TICK_MS = 50;            // 20 snapshots per second
const SUBSTEPS = 2;            // 40 Hz simulation
const MAX_ROOMS = 200;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const SLOTS = ['Q', 'W', 'E', 'R', 'D', 'F'];
const KCODE = { melee: 1, rifle: 2, tank: 3, jeep: 4 };
const PCODE = { shot: 0, bullet: 1, rocket: 2, jack: 3 };
const HERO_COUNT = 16;

const rooms = new Map();       // code -> room
let nextCid = 1;

/* ---------------- HTTP ---------------- */
let indexHtml = null;
function loadIndex() { try { indexHtml = fs.readFileSync(INDEX); } catch (e) { indexHtml = null; } }
loadIndex();
const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (url === '/health') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok'); return; }
  if (url === '/status') {
    let players = 0; rooms.forEach(r => { players += r.players.size; });
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
    res.end(JSON.stringify({ rooms: rooms.size, players })); return;
  }
  if (url === '/' || url === '/index.html') {
    if (!indexHtml) loadIndex();
    if (!indexHtml) { res.writeHead(500); res.end('index.html missing: run node build.js'); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' });
    res.end(indexHtml); return;
  }
  res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found');
});

/* ---------------- Helpers ---------------- */
function send(p, obj) { if (p.ws.readyState === 1) p.ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj)); }
function err(p, msg) { send(p, { t: 'err', msg }); }
function cleanName(n, cid) {
  n = String(n || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 16);
  return n || 'Soldier ' + cid;
}
function num(v, lo, hi) { v = Number(v); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function newCode() {
  for (let k = 0; k < 50; k++) {
    let c = ''; for (let i = 0; i < 4; i++) c += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
    if (!rooms.has(c)) return c;
  }
  return null;
}
function usedHeroes(room, except) { const s = new Set(); room.players.forEach(p => { if (p !== except) s.add(p.hero); }); return s; }
function drawHero(room, except, avoid) {
  const used = usedHeroes(room, except);
  const free = []; for (let h = 0; h < HERO_COUNT; h++) if (!used.has(h) && h !== avoid) free.push(h);
  return free.length ? free[crypto.randomInt(free.length)] : crypto.randomInt(HERO_COUNT);
}
function teamCount(room, team, except) { let n = 0; room.players.forEach(p => { if (p.team === team && p !== except) n++; }); return n; }

/* ---------------- Rooms and lobby ---------------- */
function roomState(room) {
  return { t: 'room', code: room.code, host: room.host, size: room.size, state: room.state,
    players: [...room.players.values()].map(p => ({ cid: p.cid, name: p.name, team: p.team, hero: p.hero, rerolls: p.rerolls })) };
}
function broadcastRoom(room) { const s = JSON.stringify(roomState(room)); room.players.forEach(p => send(p, s)); }
function createRoom(size) {
  if (rooms.size >= MAX_ROOMS) return null;
  const code = newCode(); if (!code) return null;
  const room = { code, size: [1, 3, 5].includes(size) ? size : 3, host: null, state: 'lobby', players: new Map(), ctx: null, timer: null, tickN: 0, nid: 0, created: Date.now() };
  rooms.set(code, room);
  return room;
}
function joinRoom(p, room, name) {
  if (p.room) leaveRoom(p);
  if (room.players.size >= room.size * 2) return err(p, 'That room is full.');
  p.name = cleanName(name, p.cid);
  p.team = teamCount(room, 0) <= teamCount(room, 1) ? 0 : 1;
  if (teamCount(room, p.team) >= room.size) p.team = 1 - p.team;
  p.hero = drawHero(room, p);
  p.rerolls = 1; p.uid = 0; p.room = room;
  room.players.set(p.cid, p);
  if (!room.host) room.host = p.cid;
  if (room.state === 'game') return joinMatch(room, p);
  broadcastRoom(room);
}
function leaveRoom(p) {
  const room = p.room; if (!room) return;
  room.players.delete(p.cid); p.room = null;
  if (room.state === 'game' && room.ctx && p.uid) {
    const u = room.ctx.G.units.find(x => x.id === p.uid);
    if (u) { u.bot = true; u.isPlayer = false; u.move = null; u.target = null; u.amove = null; room.ctx.feed(p.name + ' left; a bot took over the ' + u.name, u.team === 0 ? 'fg' : 'ft'); u.pname = null; sendNames(room); }
  }
  if (room.players.size === 0) { stopRoom(room); rooms.delete(room.code); return; }
  if (room.host === p.cid) room.host = room.players.keys().next().value;
  broadcastRoom(room);
}
function stopRoom(room) { if (room.timer) clearInterval(room.timer); room.timer = null; }

/* ---------------- Match ---------------- */
function startMatch(room) {
  const humans = [...room.players.values()];
  const used = new Set(humans.map(p => p.hero));
  const free = shuffle([...Array(HERO_COUNT).keys()].filter(h => !used.has(h)));
  const roster = [];
  for (let team = 0; team < 2; team++) {
    const hs = humans.filter(p => p.team === team);
    hs.forEach(p => roster.push({ team, hero: p.hero, human: true, name: p.name, pid: p.cid }));
    for (let i = hs.length; i < room.size; i++) roster.push({ team, hero: free.length ? free.pop() : crypto.randomInt(HERO_COUNT) });
  }
  const ctx = createSim();
  ctx.simNewGame(roster);
  room.ctx = ctx; room.state = 'game'; room.tickN = 0; room.nid = 0; room.overAt = 0;
  humans.forEach(p => { const r = roster.find(x => x.pid === p.cid); p.uid = r.uid; });
  room.roster = roster.map(r => ({ uid: r.uid, team: r.team, hero: r.hero, name: r.name || null }));
  room.structs = ctx.G.structs.map(s => [s.id, s.team, s.kind, s.order, s.t]);
  humans.forEach(p => sendStart(room, p));
  stopRoom(room);
  room.timer = setInterval(() => tick(room), TICK_MS);
  broadcastRoom(room);
}
function sendStart(room, p) { send(p, { t: 'start', you: p.uid, team: p.team, roster: room.roster, structs: room.structs }); }
function sendNames(room) {
  const n = room.ctx.G.units.filter(u => u.kind === 'hero').map(u => [u.id, u.pname || null]);
  room.roster.forEach(r => { const a = n.find(x => x[0] === r.uid); if (a) r.name = a[1]; });
  const s = JSON.stringify({ t: 'names', n });
  room.players.forEach(p => send(p, s));
}
function joinMatch(room, p) {
  const C = room.ctx, G = C.G;
  const want = teamCount(room, 0, p) <= teamCount(room, 1, p) ? 0 : 1;
  const bot = G.units.find(u => u.kind === 'hero' && u.team === want && u.bot) || G.units.find(u => u.kind === 'hero' && u.bot);
  if (!bot) { room.players.delete(p.cid); p.room = null; return err(p, 'That match is full.'); }
  bot.bot = false; bot.isPlayer = true; bot.pname = p.name; bot.pid = p.cid; bot.move = null; bot.target = null; bot.retreat = false;
  p.team = bot.team; p.uid = bot.id; p.hero = C.HEROES.indexOf(bot.spec);
  C.feed(p.name + ' joined and took over the ' + bot.name, bot.team === 0 ? 'fg' : 'ft');
  sendStart(room, p);
  sendNames(room);
  broadcastRoom(room);
}
function heroOf(p) { const room = p.room; if (!room || room.state !== 'game' || !room.ctx || room.ctx.G.over) return null; return room.ctx.G.units.find(u => u.id === p.uid) || null; }

function tick(room) {
  const C = room.ctx; if (!C) return;
  try {
    for (let i = 0; i < SUBSTEPS; i++) C.update(TICK_MS / 1000 / SUBSTEPS);
    const G = C.G, ev = G.ev; G.ev = [];
    room.tickN++;
    const teamBody = [0, 1].map(team => JSON.stringify(teamSnap(room, team, ev)).slice(1, -1));
    room.players.forEach(p => {
      const u = G.units.find(x => x.id === p.uid);
      const me = u ? meOf(C, u) : 0;
      send(p, '{"t":"s",' + teamBody[p.team] + ',"me":' + JSON.stringify(me) + '}');
    });
    if (room.tickN % 20 === 0 || G.over) {
      const sb = JSON.stringify({ t: 'sb', h: G.units.filter(u => u.kind === 'hero').map(u => [u.id, u.lvl, u.st.k, u.st.d, u.st.a, u.st.cs, Math.round(u.st.dmgH), Math.round(u.st.dmgS), Math.round(u.st.taken), Math.round(u.st.heal), u.st.best, u.augs.length, u.dead ? 1 : 0, Math.round(Math.max(0, u.respawn) * 10)]) });
      room.players.forEach(p => send(p, sb));
    }
    if (G.over && !room.overAt) {
      room.overAt = Date.now(); room.state = 'over'; stopRoom(room); broadcastRoom(room);
      setTimeout(() => {
        if (!rooms.has(room.code)) return;
        room.state = 'lobby'; room.ctx = null;
        room.players.forEach(p => { p.rerolls = 1; p.uid = 0; });
        room.players.forEach(p => { p.hero = -1; });
        room.players.forEach(p => { p.hero = drawHero(room, p); });
        broadcastRoom(room);
      }, 8000);
    }
  } catch (e) {
    console.error('[room ' + room.code + '] tick error', e);
  }
}
function nid(room, o) { if (!o.nid) o.nid = ++room.nid; return o.nid; }
function teamSnap(room, team, ev) {
  const C = room.ctx, G = C.G, R = Math.round;
  const units = [];
  for (const u of G.units) {
    if (!(u.team === team || C.visibleTo(u, team) || (u.dead && (u.deathT || 0) < 1.5))) continue;
    if (u.kind === 'hero') {
      let f = 0;
      if (u.dead) f |= 1; if (C.isGhost(u)) f |= 2; if (u.slowT > 0) f |= 4; if (u.burnT > 0) f |= 8;
      if (u.dash && u.dash.leap) { f |= 16; if (u.dash.dur > 0.6) f |= 512; }
      if (u.cone) { f |= 32; if (u.cone.ab.n === 'Sweep') f |= 256; }
      if (u.chan) f |= 64; if (C.sumBuff(u, 'aura') > 0) f |= 128;
      const w = u.wind && u.wind.tgt && !u.wind.tgt.dead ? u.wind : null;
      units.push([u.id, 0, u.team, R(u.x), R(u.y), R(u.hp), C.maxHp(u), u.facing, f, u.lvl, R(u.shield),
        w ? w.tgt.id : 0, w ? R(100 * w.t / w.dur) : 0, u.dash && u.dash.leap ? R(100 * u.dash.t / u.dash.dur) : 0,
        u.cone ? R(100 * Math.atan2(u.cone.dir.y, u.cone.dir.x)) : 0, u.cone ? R(u.cone.ab.range) : 0, u.cone ? R(100 * u.cone.ab.ang) : 0,
        R(Math.max(0, u.respawn) * 10), R(100 * ((u.aug && u.aug.scale) || 0)), R(C.aaRange(u)), R(100 * C.aaCd(u))]);
    } else {
      let f = 0; if (u.dead) f |= 1; if (u.slowT > 0) f |= 4; if (u.burnT > 0) f |= 8;
      units.push([u.id, KCODE[u.type], u.team, R(u.x), R(u.y), R(u.hp), u.maxHp, u.facing, f]);
    }
  }
  const mine = G.units.filter(u => u.team === team && !u.dead);
  const out = {
    tm: Math.round(G.time * 1000) / 1000, k: G.kills, w: G.wave, nw: Math.round(G.nextWave * 10) / 10,
    u: units,
    s: G.structs.map(s => [s.id, R(s.hp), s.dead ? 1 : 0, R(Math.max(0, s.respawn) * 10)]),
    r: G.rounds.map(r => [nid(room, r), R(r.x), R(r.y), R(r.lx), R(r.ly), r.team, (r.heavy ? 1 : 0) | (r.hero ? 2 : 0)]),
    p: G.proj.map(p => [nid(room, p), R(p.x), R(p.y), R(p.vx), R(p.vy), PCODE[p.kind] || 0, p.team]),
    l: G.lobs.map(l => [nid(room, l), R(l.x), R(l.y), R(l.sx), R(l.sy), R(l.t * 100), R(l.delay * 100), R(l.r), l.team, (l.single ? 1 : 0) | (l.smoke ? 2 : 0)]),
    m: G.mines.filter(m => m.team === team || mine.some(u => Math.hypot(u.x - m.x, u.y - m.y) < 220)).map(m => [R(m.x), R(m.y), m.team, m.arm > 0 ? 1 : 0]),
    c: G.crates.reduce((b, c, i) => b | (c.up ? 1 << i : 0), 0),
    b: G.barrage ? G.barrage.beams.filter(b => b.x != null).map(b => [R(b.x), R(b.y)]) : 0,
    ev: ev.filter(e => {
      if (e[0] !== 'fx' || !e[1].uid) return true;
      const u = G.units.find(x => x.id === e[1].uid);
      return !!u && (u.team === team || C.visibleTo(u, team));
    })
  };
  return out;
}
function meOf(C, u) {
  const owed = C.ordersOwed(u), base = C.atBase(u);
  return {
    cd: SLOTS.map(s => Math.round(u.cd[s] * 10)), cm: SLOTS.map(s => Math.round((u.cdMax[s] || 1) * 10)),
    xp: Math.round(u.xp), od: u.ordersDone, tag: u.tagMark ? 1 : 0, tg: u.target && !u.target.dead ? u.target.id : 0,
    ag: u.augs.map(a => a.n),
    of: u.offer && owed > 0 && base ? { tier: u.offer.tier, cards: u.offer.cards.map(c => ({ n: c.o.n, d: c.o.d, r: c.rerolled })), spare: u.offer.spare.length } : 0
  };
}

/* ---------------- Commands ---------------- */
function onGameCmd(p, m) {
  const u = heroOf(p); if (!u) return;
  const C = p.room.ctx, G = C.G;
  switch (m.t) {
    case 'move': {
      const x = num(m.x, -1000, 5000), y = num(m.y, -1000, 4000); if (x == null || y == null) return;
      const pt = C.freePoint({ x, y }, u.r);
      u.target = null; u.move = pt; u.amove = m.a ? pt : null; break;
    }
    case 'atk': {
      const id = num(m.id, 1, 1e9);
      const t = G.units.find(x => x.id === id) || G.structs.find(x => x.id === id);
      if (!t || t.team === u.team || t.dead) return;
      if (t.isStruct ? !C.targetable(t) : !C.visibleTo(t, u.team)) return;
      u.target = t; u.move = null; u.amove = null; break;
    }
    case 'cast': {
      if (!SLOTS.includes(m.s)) return;
      const x = num(m.x, -1000, 5000), y = num(m.y, -1000, 4000); if (x == null || y == null) return;
      u.aimPt = { x, y }; C.cast(u, m.s, { x, y }); break;
    }
    case 'aim': { const x = num(m.x, -1000, 5000), y = num(m.y, -1000, 4000); if (x != null && y != null) u.aimPt = { x, y }; break; }
    case 'halt': u.move = null; u.target = null; u.amove = null; break;
    case 'dbg_win': if (process.env.PF_DEBUG === '1') G.structs.filter(s => s.team !== u.team).sort((a, b) => a.order - b.order).forEach(s => C.kill(u, s)); break;
    case 'orders': if (C.ordersOwed(u) > 0 && C.atBase(u) && !u.offer) C.rollOffer(u); break;
    case 'pick': {
      const i = num(m.i, 0, 2); if (i == null || !u.offer || C.ordersOwed(u) <= 0 || !C.atBase(u)) return;
      const c = u.offer.cards[i]; if (!c) return;
      C.applyOrder(u, c.o);
      if (C.ordersOwed(u) > 0) C.rollOffer(u);
      break;
    }
    case 'redraw': {
      const i = num(m.i, 0, 2); if (i == null || !u.offer) return;
      const c = u.offer.cards[i]; if (!c || c.rerolled || !u.offer.spare.length) return;
      c.o = u.offer.spare.shift(); c.rerolled = true; break;
    }
  }
}
function onMessage(p, m) {
  switch (m.t) {
    case 'ping': send(p, { t: 'pong', c: m.c }); return;
    case 'create': {
      const room = createRoom(num(m.size, 1, 5));
      if (!room) return err(p, 'The server is full right now. Try again soon.');
      joinRoom(p, room, m.name); return;
    }
    case 'join': {
      const room = rooms.get(String(m.code || '').toUpperCase());
      if (!room) return err(p, 'No room with that code. Check the letters and try again.');
      if (room.state === 'over') return err(p, 'That room is between matches. Try again in a few seconds.');
      joinRoom(p, room, m.name); return;
    }
    case 'quick': {
      let room = [...rooms.values()].find(r => r.state === 'lobby' && r.players.size < r.size * 2)
        || [...rooms.values()].find(r => r.state === 'game' && r.ctx && r.ctx.G.units.some(u => u.kind === 'hero' && u.bot));
      if (!room) room = createRoom(3);
      if (!room) return err(p, 'The server is full right now. Try again soon.');
      joinRoom(p, room, m.name); return;
    }
    case 'leave': leaveRoom(p); return;
  }
  const room = p.room; if (!room) return;
  if (room.state === 'lobby') {
    switch (m.t) {
      case 'team': { const to = 1 - p.team; if (teamCount(room, to) >= room.size) return err(p, 'That team is full.'); p.team = to; broadcastRoom(room); return; }
      case 'reroll': { if (p.rerolls < 1) return; p.rerolls--; p.hero = drawHero(room, p, p.hero); broadcastRoom(room); return; }
      case 'size': {
        if (room.host !== p.cid) return;
        const s = num(m.size, 1, 5); if (![1, 3, 5].includes(s)) return;
        if (teamCount(room, 0) > s || teamCount(room, 1) > s) return err(p, 'Too many soldiers on one team for that size.');
        room.size = s; broadcastRoom(room); return;
      }
      case 'start': if (room.host !== p.cid) return err(p, 'Only the host can start the match.'); startMatch(room); return;
    }
  } else if (room.state === 'game') onGameCmd(p, m);
}

/* ---------------- WebSocket ---------------- */
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
wss.on('connection', ws => {
  const p = { cid: 'c' + (nextCid++).toString(36) + crypto.randomBytes(2).toString('hex'), ws, name: '', room: null, team: 0, hero: 0, rerolls: 1, uid: 0, alive: true, bucket: 60, last: Date.now() };
  send(p, { t: 'hello', cid: p.cid });
  ws.on('pong', () => { p.alive = true; });
  ws.on('message', data => {
    const now = Date.now();
    p.bucket = Math.min(60, p.bucket + (now - p.last) * 0.04); p.last = now;   // ~40 messages per second sustained
    if (p.bucket < 1) return; p.bucket--;
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    try { onMessage(p, m); } catch (e) { console.error('message error', e); }
  });
  ws.on('close', () => leaveRoom(p));
});
wss.on('connection', ws => ws.on('pong', () => { ws._dead = false; }));

if (require.main === module) {
  setInterval(() => { wss.clients.forEach(ws => { if (ws._dead) return ws.terminate(); ws._dead = true; ws.ping(); }); }, 30000);
  server.listen(PORT, '0.0.0.0', () => console.log('Plastic Front server on http://localhost:' + PORT + '  (WebSocket at /ws)'));
}
module.exports = { createRoom, startMatch, stopRoom, teamSnap, rooms };
