// Smoke test against a deployed server (Cloudflare Worker or Node): room API, two WebSocket players, a match start and live snapshots.
// Usage: node tests/smoke-deploy.js https://plastic-front.example.workers.dev
// Needs Node 22 (global fetch and WebSocket).
'use strict';
const base = (process.argv[2] || '').replace(/\/$/, '');
if (!base) { console.error('usage: node tests/smoke-deploy.js <https://host>'); process.exit(2); }
const wsBase = base.replace(/^http/, 'ws') + '/ws';
const results = [];
function check(name, ok, detail) { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail != null ? '  ' + JSON.stringify(detail) : '')); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
function player(code, name) {
  const p = { name, msgs: [], room: null, start: null, snaps: 0, closed: false, err: null };
  p.ws = new WebSocket(wsBase + '/' + code + '?name=' + encodeURIComponent(name));
  p.open = new Promise((res, rej) => { p.ws.onopen = res; p.ws.onerror = e => rej(new Error('socket error')); });
  p.ws.onmessage = ev => { const m = JSON.parse(ev.data); p.msgs.push(m); if (m.t === 'room') p.room = m; else if (m.t === 'start') p.start = m; else if (m.t === 's') { p.snaps++; p.last = m; } else if (m.t === 'err') p.err = m.msg; };
  p.ws.onclose = () => { p.closed = true; };
  p.send = o => p.ws.send(JSON.stringify(o));
  p.wait = async (f, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 6000)) { if (f()) return true; await sleep(50); } return false; };
  return p;
}
(async () => {
  const t0 = Date.now();
  const health = await fetch(base + '/health').then(r => r.text()).catch(e => 'ERR ' + e.message);
  check('GET /health', health === 'ok', { health, ms: Date.now() - t0 });
  const created = await fetch(base + '/api/room', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ size: 1 }) }).then(r => r.json());
  check('POST /api/room returns a code', /^[A-Z]{4}$/.test(created.code || ''), created);
  const code = created.code;
  const info = await fetch(base + '/api/room/' + code).then(r => r.json());
  check('GET /api/room/CODE', info.state === 'lobby' && info.size === 1, info);
  const nope = await fetch(base + '/api/room/ZZZZ');
  check('unknown code is 404', nope.status === 404);

  const A = player(code, 'SmokeA'); await A.open;
  await A.wait(() => A.room && A.room.players.length === 1);
  check('first player connects and gets the lobby', !!A.room && A.room.players.length === 1 && A.room.host === A.room.players[0].cid, A.room && { code: A.room.code, host: !!A.room.host });
  const B = player(code, 'SmokeB'); await B.open;
  await A.wait(() => A.room && A.room.players.length === 2);
  check('second player joins on the other team', A.room.players.length === 2 && A.room.players[0].team !== A.room.players[1].team, A.room.players.map(p => [p.name, p.team]));
  const quick = await fetch(base + '/api/quick', { method: 'POST' }).then(r => r.json());
  check('quick match is served by the directory', /^[A-Z]{4}$/.test(quick.code || ''), quick);

  A.send({ t: 'start' });
  const started = await A.wait(() => A.start && A.snaps > 10) && await B.wait(() => B.start && B.snaps > 10);
  check('host starts the match; both players receive snapshots', started, { aSnaps: A.snaps, bSnaps: B.snaps, time: A.last && A.last.tm });
  const s0 = A.snaps, t1 = Date.now(); await sleep(2000);
  const rate = (A.snaps - s0) / ((Date.now() - t1) / 1000);
  check('snapshot rate near 30/s', rate > 20, { perSec: Math.round(rate) });
  const me = A.last && A.last.u.find(a => a[0] === A.start.you);
  if (me) { A.send({ t: 'move', x: me[3] + 300, y: me[4] - 150 }); await sleep(1500); const me2 = A.last.u.find(a => a[0] === A.start.you); check('move is applied by the Durable Object sim', me2 && Math.hypot(me2[3] - me[3], me2[4] - me[4]) > 100, me2 && { from: [me[3], me[4]], to: [me2[3], me2[4]] }); }
  else check('move is applied by the Durable Object sim', false, 'no self unit in snapshot');
  const pingAt = Date.now(); A.send({ t: 'ping', c: 1 }); await A.wait(() => A.msgs.some(m => m.t === 'pong'), 3000);
  check('ping/pong', A.msgs.some(m => m.t === 'pong'), { rttMs: Date.now() - pingAt });
  const status = await fetch(base + '/status').then(r => r.json());
  check('/status counts the room', status.rooms >= 1 && status.players >= 2, status);
  A.ws.close(); B.ws.close(); await sleep(1500);
  const gone = await fetch(base + '/api/room/' + code);
  check('room is removed once everyone leaves', gone.status === 404, { status: gone.status });
  const failed = results.filter(r => !r).length;
  console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
