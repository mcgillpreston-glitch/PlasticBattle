// One room: lobby, hero draws, the authoritative match, per-team snapshots and player commands.
// Transport-agnostic so the same code runs in the Node server (server.js) and the Cloudflare Durable Object (worker/index.js).
// A player is { cid, name, team, hero, rerolls, uid, send(string|object) }; the host owns sockets, rate limits and timers' environment.
'use strict';

const TICK_MS = 50;            // 20 snapshots per second
const SUBSTEPS = 2;            // 40 Hz simulation
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const SLOTS = ['Q', 'W', 'E', 'R', 'D', 'F'];
const KCODE = { melee: 1, rifle: 2, tank: 3, jeep: 4, mortar: 5 };
const PCODE = { shot: 0, bullet: 1, rocket: 2, jack: 3 };
const HERO_COUNT = 16;

function randInt(n) { return Math.floor(Math.random() * n); }
function randomCode() { let c = ''; for (let i = 0; i < 4; i++) c += CODE_CHARS[randInt(CODE_CHARS.length)]; return c; }
function validCode(c) { return typeof c === 'string' && /^[A-Z]{4}$/.test(c); }
function cleanName(n, cid) {
  n = String(n || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 16);
  return n || 'Soldier ' + String(cid).slice(-4);
}
function num(v, lo, hi) { v = Number(v); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

class Room {
  /* opts: { createSim, debug, onChange(room) } */
  constructor(code, size, opts) {
    this.code = code; this.size = [1, 3, 5].includes(size) ? size : 3;
    this.opts = opts || {};
    this.host = null; this.state = 'lobby'; this.players = new Map();
    this.ctx = null; this.timer = null; this.tickN = 0; this.nid = 0; this.overAt = 0; this.roster = null; this.structs = null;
    this.created = Date.now(); this.destroyed = false;
  }

  /* ---------- helpers ---------- */
  send(p, obj) { try { p.send(typeof obj === 'string' ? obj : JSON.stringify(obj)); } catch (e) {} }
  err(p, msg) { this.send(p, { t: 'err', msg }); }
  teamCount(team, except) { let n = 0; this.players.forEach(p => { if (p.team === team && p !== except) n++; }); return n; }
  usedHeroes(except) { const s = new Set(); this.players.forEach(p => { if (p !== except) s.add(p.hero); }); return s; }
  drawHero(except, avoid) {
    const used = this.usedHeroes(except);
    const free = []; for (let h = 0; h < HERO_COUNT; h++) if (!used.has(h) && h !== avoid) free.push(h);
    return free.length ? free[randInt(free.length)] : randInt(HERO_COUNT);
  }
  botFree() { return this.state === 'game' && !!this.ctx && this.ctx.G.units.some(u => u.kind === 'hero' && u.bot); }
  info() { return { code: this.code, state: this.state, size: this.size, players: this.players.size, botFree: this.botFree(), full: this.players.size >= this.size * 2 }; }
  stateMsg() {
    return { t: 'room', code: this.code, host: this.host, size: this.size, state: this.state,
      players: [...this.players.values()].map(p => ({ cid: p.cid, name: p.name, team: p.team, hero: p.hero, rerolls: p.rerolls })) };
  }
  broadcast() {
    const s = JSON.stringify(this.stateMsg());
    this.players.forEach(p => this.send(p, s));
    if (this.opts.onChange) this.opts.onChange(this);
  }

  /* ---------- lobby ---------- */
  /* Adds a connected player. Returns null, or an error message when the player could not be admitted. */
  join(p) {
    if (this.state === 'over') return 'That room is between matches. Try again in a few seconds.';
    if (this.players.size >= this.size * 2) return 'That room is full.';
    p.team = this.teamCount(0) <= this.teamCount(1) ? 0 : 1;
    if (this.teamCount(p.team) >= this.size) p.team = 1 - p.team;
    p.hero = this.drawHero(p);
    p.rerolls = 1; p.uid = 0;
    this.players.set(p.cid, p);
    if (!this.host) this.host = p.cid;
    this.send(p, { t: 'hello', cid: p.cid });
    if (this.state === 'game') return this.joinMatch(p);
    this.broadcast();
    return null;
  }
  /* Puts back players whose records survived a restart (Durable Object wake-up); no draws, no messages. */
  restore(records, meta) {
    this.host = meta.host; this.size = meta.size;
    records.forEach(p => this.players.set(p.cid, p));
    if (this.host == null || !this.players.has(this.host)) this.host = this.players.size ? this.players.keys().next().value : null;
    this.state = 'lobby';
  }
  leave(p) {
    if (!this.players.has(p.cid)) return;
    this.players.delete(p.cid);
    if (this.state === 'game' && this.ctx && p.uid) {
      const u = this.ctx.G.units.find(x => x.id === p.uid);
      if (u) { u.bot = true; u.isPlayer = false; u.move = null; u.target = null; u.amove = null; this.ctx.feed(p.name + ' left; a bot took over the ' + u.name, u.team === 0 ? 'fg' : 'ft'); u.pname = null; this.sendNames(); }
    }
    if (this.players.size === 0) { this.stop(); return; }
    if (this.host === p.cid) this.host = this.players.keys().next().value;
    this.broadcast();
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; if (this.overTimer) clearTimeout(this.overTimer); this.overTimer = null; }
  destroy() { this.stop(); this.destroyed = true; this.ctx = null; }

  /* ---------- match ---------- */
  start() {
    const humans = [...this.players.values()];
    const used = new Set(humans.map(p => p.hero));
    const free = shuffle([...Array(HERO_COUNT).keys()].filter(h => !used.has(h)));
    const roster = [];
    for (let team = 0; team < 2; team++) {
      const hs = humans.filter(p => p.team === team);
      hs.forEach(p => roster.push({ team, hero: p.hero, human: true, name: p.name, pid: p.cid }));
      for (let i = hs.length; i < this.size; i++) roster.push({ team, hero: free.length ? free.pop() : randInt(HERO_COUNT) });
    }
    const ctx = this.opts.createSim();
    ctx.simNewGame(roster);
    this.ctx = ctx; this.state = 'game'; this.tickN = 0; this.nid = 0; this.overAt = 0;
    humans.forEach(p => { const r = roster.find(x => x.pid === p.cid); p.uid = r.uid; });
    this.roster = roster.map(r => ({ uid: r.uid, team: r.team, hero: r.hero, name: r.name || null }));
    this.structs = ctx.G.structs.map(s => [s.id, s.team, s.kind, s.order, s.t]);
    humans.forEach(p => this.sendStart(p));
    this.stop();
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.broadcast();
  }
  sendStart(p) { this.send(p, { t: 'start', you: p.uid, team: p.team, roster: this.roster, structs: this.structs }); }
  sendNames() {
    const n = this.ctx.G.units.filter(u => u.kind === 'hero').map(u => [u.id, u.pname || null]);
    this.roster.forEach(r => { const a = n.find(x => x[0] === r.uid); if (a) r.name = a[1]; });
    const s = JSON.stringify({ t: 'names', n });
    this.players.forEach(p => this.send(p, s));
  }
  joinMatch(p) {
    const C = this.ctx, G = C.G;
    const want = this.teamCount(0, p) <= this.teamCount(1, p) ? 0 : 1;
    const bot = G.units.find(u => u.kind === 'hero' && u.team === want && u.bot) || G.units.find(u => u.kind === 'hero' && u.bot);
    if (!bot) { this.players.delete(p.cid); return 'That match is full.'; }
    bot.bot = false; bot.isPlayer = true; bot.pname = p.name; bot.pid = p.cid; bot.move = null; bot.target = null; bot.retreat = false;
    p.team = bot.team; p.uid = bot.id; p.hero = C.HEROES.indexOf(bot.spec);
    C.feed(p.name + ' joined and took over the ' + bot.name, bot.team === 0 ? 'fg' : 'ft');
    this.sendStart(p);
    this.sendNames();
    this.broadcast();
    return null;
  }
  heroOf(p) { if (this.state !== 'game' || !this.ctx || this.ctx.G.over) return null; return this.ctx.G.units.find(u => u.id === p.uid) || null; }

  tick() {
    const C = this.ctx; if (!C || this.destroyed) return;
    try {
      for (let i = 0; i < SUBSTEPS; i++) C.update(TICK_MS / 1000 / SUBSTEPS);
      const G = C.G, ev = G.ev; G.ev = [];
      this.tickN++;
      const teamBody = [0, 1].map(team => JSON.stringify(this.teamSnap(team, ev)).slice(1, -1));
      this.players.forEach(p => {
        const u = G.units.find(x => x.id === p.uid);
        const me = u ? this.meOf(u) : 0;
        this.send(p, '{"t":"s",' + teamBody[p.team] + ',"me":' + JSON.stringify(me) + '}');
      });
      if (this.tickN % 20 === 0 || G.over) {
        const sb = JSON.stringify({ t: 'sb', h: G.units.filter(u => u.kind === 'hero').map(u => [u.id, u.lvl, u.st.k, u.st.d, u.st.a, u.st.cs, Math.round(u.st.dmgH), Math.round(u.st.dmgS), Math.round(u.st.taken), Math.round(u.st.heal), u.st.best, u.augs.length, u.dead ? 1 : 0, Math.round(Math.max(0, u.respawn) * 10)]) });
        this.players.forEach(p => this.send(p, sb));
      }
      if (G.over && !this.overAt) {
        this.overAt = Date.now(); this.state = 'over'; this.stop(); this.broadcast();
        this.overTimer = setTimeout(() => {
          if (this.destroyed) return;
          this.state = 'lobby'; this.ctx = null; this.overTimer = null;
          this.players.forEach(p => { p.rerolls = 1; p.uid = 0; p.hero = -1; });
          this.players.forEach(p => { p.hero = this.drawHero(p); });
          this.broadcast();
        }, 8000);
      }
    } catch (e) {
      console.error('[room ' + this.code + '] tick error', e);
    }
  }
  nidOf(o) { if (!o.nid) o.nid = ++this.nid; return o.nid; }
  teamSnap(team, ev) {
    const C = this.ctx, G = C.G, R = Math.round;
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
    return {
      tm: Math.round(G.time * 1000) / 1000, k: G.kills, w: G.wave, nw: Math.round(G.nextWave * 10) / 10,
      u: units,
      s: G.structs.map(s => [s.id, R(s.hp), s.dead ? 1 : 0, R(Math.max(0, s.respawn) * 10)]),
      r: G.rounds.map(r => [this.nidOf(r), R(r.x), R(r.y), R(r.lx), R(r.ly), r.team, (r.heavy ? 1 : 0) | (r.hero ? 2 : 0)]),
      p: G.proj.map(p => [this.nidOf(p), R(p.x), R(p.y), R(p.vx), R(p.vy), PCODE[p.kind] || 0, p.team]),
      l: G.lobs.map(l => [this.nidOf(l), R(l.x), R(l.y), R(l.sx), R(l.sy), R(l.t * 100), R(l.delay * 100), R(l.r), l.team, (l.single ? 1 : 0) | (l.smoke ? 2 : 0)]),
      m: G.mines.filter(m => m.team === team || mine.some(u => Math.hypot(u.x - m.x, u.y - m.y) < 220)).map(m => [R(m.x), R(m.y), m.team, m.arm > 0 ? 1 : 0]),
      c: G.crates.reduce((b, c, i) => b | (c.up ? 1 << i : 0), 0),
      b: G.barrage ? G.barrage.beams.filter(b => b.x != null).map(b => [R(b.x), R(b.y)]) : 0,
      ev: ev.filter(e => {
        if (e[0] !== 'fx' || !e[1].uid) return true;
        const u = G.units.find(x => x.id === e[1].uid);
        return !!u && (u.team === team || C.visibleTo(u, team));
      })
    };
  }
  meOf(u) {
    const C = this.ctx, owed = C.ordersOwed(u), base = C.atBase(u);
    return {
      cd: SLOTS.map(s => Math.round(u.cd[s] * 10)), cm: SLOTS.map(s => Math.round((u.cdMax[s] || 1) * 10)),
      xp: Math.round(u.xp), od: u.ordersDone, tag: u.tagMark ? 1 : 0, tg: u.target && !u.target.dead ? u.target.id : 0,
      ag: u.augs.map(a => a.n),
      of: u.offer && owed > 0 && base ? { tier: u.offer.tier, cards: u.offer.cards.map(c => ({ n: c.o.n, d: c.o.d, r: c.rerolled })), spare: u.offer.spare.length } : 0
    };
  }

  /* ---------- commands ---------- */
  gameCmd(p, m) {
    const u = this.heroOf(p); if (!u) return;
    const C = this.ctx, G = C.G;
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
      case 'dbg_win': if (this.opts.debug) G.structs.filter(s => s.team !== u.team).sort((a, b) => a.order - b.order).forEach(s => C.kill(u, s)); break;
      case 'dbg_die': {
        // test only: an enemy hero and a turret hit this player hard enough to kill them, so the death recap can be checked end to end
        if (!this.opts.debug || u.dead) return;
        const foe = G.units.find(x => x.kind === 'hero' && x.team !== u.team && !x.dead), tur = G.structs.find(s => s.team !== u.team && s.kind === 'outpost' && !s.dead);
        if (tur) C.damage(tur, u, 120, {});
        if (foe) { C.damage(foe, u, 90, { ability: 1, n: 'Frag' }); C.damage(foe, u, 1e6, { aa: 1 }); }
        break;
      }
      case 'orders': if (C.ordersOwed(u) > 0 && C.atBase(u) && !u.offer) C.rollOffer(u); break;
      case 'swap': {
        const i = num(m.hero, 0, HERO_COUNT - 1); if (i == null) return;
        if (C.swapHero(u, i)) { const r = this.roster.find(x => x.uid === u.id); if (r) r.hero = i; }
        break;
      }
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
  message(p, m) {
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'ping') { this.send(p, { t: 'pong', c: m.c }); return; }
    if (!this.players.has(p.cid)) return;
    if (this.state === 'lobby') {
      switch (m.t) {
        case 'team': { const to = 1 - p.team; if (this.teamCount(to) >= this.size) return this.err(p, 'That team is full.'); p.team = to; this.broadcast(); return; }
        case 'reroll': { if (p.rerolls < 1) return; p.rerolls--; p.hero = this.drawHero(p, p.hero); this.broadcast(); return; }
        case 'size': {
          if (this.host !== p.cid) return;
          const s = num(m.size, 1, 5); if (![1, 3, 5].includes(s)) return;
          if (this.teamCount(0) > s || this.teamCount(1) > s) return this.err(p, 'Too many soldiers on one team for that size.');
          this.size = s; this.broadcast(); return;
        }
        case 'start': if (this.host !== p.cid) return this.err(p, 'Only the host can start the match.'); this.start(); return;
      }
    } else if (this.state === 'game') this.gameCmd(p, m);
  }
}

module.exports = { Room, randomCode, validCode, cleanName, num, TICK_MS, HERO_COUNT };
