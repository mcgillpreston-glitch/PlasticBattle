// Runs the Cloudflare Worker and its Durable Objects inside Node, against small shims of the Workers runtime
// (WebSocketPair, Durable Object state/storage/hibernation API, stubs). Drives three fake clients through the
// same scenario as online-test.js: create, join, reroll, start, move, cast, snapshots, death + swap, drop-in, leave, end, rematch,
// and a simulated hibernation wake-up of a lobby.
// Usage: node tests/worker-test.js
'use strict';
const path = require('path');
const esbuild = require(process.env.ESBUILD_PATH || 'esbuild');
const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail != null ? '  ' + JSON.stringify(detail) : '')); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- runtime shims ---------- */
class FakeSocket {
  constructor() { this.peer = null; this.readyState = 1; this.handlers = {}; this.attachment = null; this.owner = null; this.tags = []; }
  send(s) { if (this.readyState !== 1) throw new Error('socket not open'); const peer = this.peer; setImmediate(() => peer.deliver(s)); }
  deliver(s) { if (this.readyState !== 1) return; if (this.owner) this.owner.webSocketMessage(this, s); else if (this.handlers.message) this.handlers.message({ data: s }); }
  close(code, reason) { if (this.readyState === 3) return; this.readyState = 3; const peer = this.peer; setImmediate(() => peer.remoteClosed(code, reason)); }
  remoteClosed(code, reason) { if (this.readyState === 3) return; this.readyState = 3; if (this.owner) this.owner.webSocketClose(this, code, reason, true); else if (this.handlers.close) this.handlers.close({ code, reason }); }
  addEventListener(k, f) { this.handlers[k] = f; }
  serializeAttachment(v) { this.attachment = JSON.parse(JSON.stringify(v)); }
  deserializeAttachment() { return this.attachment; }
}
class WebSocketPair { constructor() { const a = new FakeSocket(), b = new FakeSocket(); a.peer = b; b.peer = a; this[0] = a; this[1] = b; } }
class FakeStorage { constructor() { this.m = new Map(); } async get(k) { return this.m.has(k) ? JSON.parse(this.m.get(k)) : undefined; } async put(k, v) { this.m.set(k, JSON.stringify(v)); } async delete(k) { this.m.delete(k); } async deleteAll() { this.m.clear(); } }
class FakeState {
  constructor(name) { this.name = name; this.storage = new FakeStorage(); this.sockets = []; this.owner = null; }
  async blockConcurrencyWhile(f) { return f(); }
  acceptWebSocket(ws, tags) { ws.owner = this.owner; ws.tags = tags || []; this.sockets.push(ws); }
  getWebSockets() { return this.sockets.filter(s => s.readyState === 1); }
}
class FakeResponse {
  constructor(body, init) { this.body = body; this.status = (init && init.status) || 200; this.headers = new Map(Object.entries((init && init.headers) || {})); this.webSocket = init && init.webSocket; this.ok = this.status >= 200 && this.status < 300; }
  async json() { return JSON.parse(this.body); }
  async text() { return String(this.body); }
}
class FakeRequest {
  constructor(url, init) { this.url = url; this.method = (init && init.method) || 'GET'; this._body = init && init.body; this.headers = { get: k => (init && init.headers && init.headers[k.toLowerCase()]) || null }; }
  async json() { return JSON.parse(this._body || '{}'); }
}
globalThis.WebSocketPair = WebSocketPair; globalThis.Response = FakeResponse; globalThis.Request = FakeRequest;

/* a namespace of Durable Objects: instances live as long as the test, or until `evict` */
function makeNamespace(Cls, env) {
  const live = new Map();
  const ns = {
    idFromName: name => ({ name }),
    get: id => ({ fetch: (url, init) => { const inst = ns.instance(id.name); return Promise.resolve(inst.fetch(url instanceof FakeRequest ? url : new FakeRequest(url, init))); } }),
    instance: name => { if (!live.has(name)) { const st = new FakeState(name); const o = new Cls(st, env); st.owner = o; live.set(name, { obj: o, state: st }); } return live.get(name).obj; },
    evict: name => { const e = live.get(name); if (!e) return; live.delete(name); const st = e.state; const o = new Cls(st, env); st.owner = o; st.sockets.forEach(s => { s.owner = o; }); live.set(name, { obj: o, state: st }); return o; }
  };
  return ns;
}

/* a fake browser client: connects through the Worker like the page does */
async function client(worker, env, name) {
  const c = { name, msgs: [], snaps: 0, bytes: 0, room: null, start: null, me: null, units: new Map(), feed: [], ws: null, closed: false };
  c.connect = async code => {
    const req = new FakeRequest('https://pf.test/ws/' + code + '?name=' + encodeURIComponent(name), { headers: { upgrade: 'websocket' } });
    const res = await worker.fetch(req, env);
    if (res.status !== 101) throw new Error('upgrade failed ' + res.status);
    c.ws = res.webSocket; c.closed = false;
    c.ws.addEventListener('message', ev => {
      c.bytes += ev.data.length;
      const m = JSON.parse(ev.data); c.msgs.push(m);
      if (m.t === 'room') c.room = m;
      else if (m.t === 'start') { c.start = m; c.me = null; }
      else if (m.t === 's') { c.snaps++; c.tm = m.tm; m.u.forEach(a => c.units.set(a[0], a)); c.meData = m.me; m.ev.forEach(e => { if (e[0] === 'feed') c.feed.push(e[2]); if (e[0] === 'kia' && e[1] === c.start.you) c.kia = e; if (e[0] === 'swap') c.swapEv = e; }); }
      else if (m.t === 'names') c.names = m.n;
      else if (m.t === 'err') c.err = m.msg;
    });
    c.ws.addEventListener('close', () => { c.closed = true; });
    await sleep(20);
  };
  c.send = o => c.ws.send(JSON.stringify(o));
  c.hero = () => c.units.get(c.start.you);
  c.wait = async (f, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 5000)) { if (f()) return true; await sleep(25); } return false; };
  return c;
}

(async () => {
  const out = await esbuild.build({ entryPoints: [path.join(__dirname, '..', 'worker', 'index.js')], bundle: true, format: 'cjs', platform: 'node', write: false, logLevel: 'error' });
  const mod = {}; new Function('module', 'exports', 'require', out.outputFiles[0].text)(mod, mod, require);
  const worker = mod.exports.default, { RoomDO, LobbyDO } = mod.exports;
  const env = {};
  env.ROOMS = makeNamespace(RoomDO, env); env.LOBBY = makeNamespace(LobbyDO, env);
  const api = async (method, p, body) => { const r = await worker.fetch(new FakeRequest('https://pf.test' + p, { method, body: body && JSON.stringify(body) }), env); return { status: r.status, body: await r.json().catch(() => null) }; };

  // room lifecycle
  const created = await api('POST', '/api/room', { size: 3 });
  check('POST /api/room allocates a 4-letter code through the directory', created.status === 200 && /^[A-Z]{4}$/.test(created.body.code), created.body);
  const code = created.body.code;
  const info = await api('GET', '/api/room/' + code);
  check('GET /api/room/CODE reports the lobby', info.status === 200 && info.body.state === 'lobby' && info.body.players === 0, info.body);
  const bad = await api('GET', '/api/room/ZZZZ');
  check('unknown codes are refused', bad.status === 404, bad.body);

  const A = await client(worker, env, 'Alpha'); await A.connect(code);
  const B = await client(worker, env, 'Bravo'); await B.connect(code);
  await A.wait(() => A.room && A.room.players.length === 2);
  check('two players in the lobby on opposite teams, host is the creator', A.room && A.room.players.length === 2 && A.room.players[0].team !== A.room.players[1].team && A.room.host === A.room.players[0].cid, A.room);
  const quick = await api('POST', '/api/quick');
  check('quick match finds the open lobby', quick.body.code === code, quick.body);
  const h0 = B.room.players.find(p => p.name === 'Bravo').hero;
  B.send({ t: 'reroll' }); await B.wait(() => B.room.players.find(p => p.name === 'Bravo').rerolls === 0);
  check('reroll changes the hero once', B.room.players.find(p => p.name === 'Bravo').hero !== h0);

  // hibernation: evict the room object while it is a lobby; the attachments must bring the lobby back
  env.ROOMS.evict(code);
  A.send({ t: 'size', size: 3 }); await sleep(60);
  await A.wait(() => A.msgs.some(m => m.t === 'room' && m.players.length === 2) && A.room.players.length === 2);
  check('lobby survives a Durable Object wake-up (players and host restored from attachments)', A.room.players.length === 2 && A.room.host === A.room.players.find(p => p.name === 'Alpha').cid && A.room.players.every(p => p.hero >= 0), A.room);

  // start and play
  B.send({ t: 'start' }); await sleep(50);
  check('only the host can start', !!B.err && /host/.test(B.err) && !A.start, B.err);
  A.send({ t: 'start' });
  await A.wait(() => A.start && A.snaps > 5); await B.wait(() => B.start && B.snaps > 5);
  check('match starts for both with snapshots flowing', A.start && B.start && A.start.team !== B.start.team && A.snaps > 5 && B.snaps > 5, { a: A.start.team, b: B.start.team, snaps: A.snaps });
  const hA0 = A.hero(); A.send({ t: 'move', x: hA0[3] + 400, y: hA0[4] - 200 });
  await sleep(1500);
  const hA1 = A.hero();
  check('move command is applied by the simulation', Math.hypot(hA1[3] - hA0[3], hA1[4] - hA0[4]) > 150, { from: [hA0[3], hA0[4]], to: [hA1[3], hA1[4]] });
  A.send({ t: 'cast', s: 'Q', x: hA1[3] + 300, y: hA1[4] }); await sleep(200);
  check('cast puts Q on cooldown', A.meData && A.meData.cd[0] > 0, A.meData && A.meData.cd);
  const t0 = Date.now(), s0 = A.snaps, b0 = A.bytes; await sleep(3000);
  const secs = (Date.now() - t0) / 1000;
  check('about 20 snapshots a second', (A.snaps - s0) / secs > 15, { perSec: Math.round((A.snaps - s0) / secs), bytesPerSec: Math.round((A.bytes - b0) / secs) });
  const st = await api('GET', '/status');
  check('directory status counts the live room', st.body.rooms === 1 && st.body.players === 2, st.body);

  // debug kill is off in production; verify it does nothing here, then swap is refused while alive
  B.send({ t: 'dbg_die' }); await sleep(300);
  check('debug commands are disabled in the Worker', !(B.hero()[8] & 1));
  B.send({ t: 'swap', hero: 0 }); await sleep(200);
  check('swap is refused while alive', !B.swapEv);

  // drop-in: Charlie quick-matches into the running game and takes over a bot
  const q2 = await api('POST', '/api/quick');
  check('quick match drops into a running match with bots', q2.body.code === code, q2.body);
  const C = await client(worker, env, 'Charlie'); await C.connect(code);
  await C.wait(() => C.start && C.snaps > 2);
  check('the new player takes over a bot and gets snapshots', !!C.start && C.snaps > 2, C.start && { you: C.start.you, team: C.start.team });
  await A.wait(() => A.names && A.names.some(n => n[1] === 'Charlie'));
  check('everyone learns the new player name', A.names && A.names.some(n => n[1] === 'Charlie'));

  // leave: Bravo closes the socket; a bot takes over
  B.ws.close(); await sleep(200);
  await A.wait(() => A.feed.some(f => /Bravo left/.test(f)));
  check('leaving hands the hero to a bot', A.feed.some(f => /Bravo left/.test(f)), A.feed.slice(-2));
  const st2 = await api('GET', '/status');
  check('directory follows player counts', st2.body.players === 2, st2.body);

  // end of match: force it through the room (the Worker has no debug commands), then rematch
  const roomObj = env.ROOMS.instance(code).room, Cx = roomObj.ctx, meU = Cx.G.units.find(u => u.id === A.start.you);
  Cx.G.structs.filter(s => s.team !== meU.team).sort((a, b) => a.order - b.order).forEach(s => Cx.kill(meU, s));
  await A.wait(() => A.room && A.room.state === 'over');
  check('match end is broadcast', A.room.state === 'over' && A.msgs.some(m => m.t === 's' && m.ev.some(e => e[0] === 'end')));
  await A.wait(() => A.room.state === 'lobby', 10000);
  check('room returns to the lobby with fresh draws', A.room.state === 'lobby' && A.room.players.every(p => p.rerolls === 1 && p.hero >= 0));
  A.send({ t: 'start' }); await A.wait(() => A.start && A.snaps > 5 && A.room.state === 'game');
  check('rematch starts', A.room.state === 'game');

  // everyone leaves: the room forgets itself and the code is free again
  A.ws.close(); C.ws.close(); await sleep(200);
  const gone = await api('GET', '/api/room/' + code);
  const st3 = await api('GET', '/status');
  check('an empty room is removed and its code freed', gone.status === 404 && st3.body.rooms === 0, { gone: gone.status, st: st3.body });

  const failed = results.filter(r => !r.ok).length;
  console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
