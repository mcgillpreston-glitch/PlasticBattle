// Plastic Front on Cloudflare: a Worker in front of two Durable Object classes.
//   RoomDO  - one per room (keyed by the 4-letter code): lobby, the authoritative match, snapshots. Uses the same Room logic as the Node server.
//   LobbyDO - a single directory of rooms, for quick match and status.
// The page and the art are served as static assets from dist/ (see wrangler.toml); the Worker only handles /api and /ws.
import { Room, randomCode, validCode, cleanName, num } from '../server/room.js';
import { createSim } from './sim.gen.js';

const DEBUG = false;
const json = (obj, status) => new Response(JSON.stringify(obj), { status: status || 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'no-store' } });
const text = (s, status) => new Response(s, { status: status || 200, headers: { 'content-type': 'text/plain', 'access-control-allow-origin': '*' } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url), p = url.pathname;
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'content-type' } });
    if (p === '/health') return text('ok');
    if (p === '/status') return lobby(env).fetch('https://do/status');
    if (p === '/api/room' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const size = [1, 3, 5].includes(Number(body.size)) ? Number(body.size) : 3;
      const r = await (await lobby(env).fetch('https://do/alloc', { method: 'POST', body: JSON.stringify({ size }) })).json();
      if (!r.code) return json({ error: 'Could not create a room right now. Try again soon.' }, 503);
      await roomStub(env, r.code).fetch('https://do/create', { method: 'POST', body: JSON.stringify({ code: r.code, size }) });
      return json({ code: r.code });
    }
    if (p === '/api/quick' && request.method === 'POST') {
      const r = await (await lobby(env).fetch('https://do/quick', { method: 'POST' })).json();
      if (!r.code) return json({ error: 'Could not find a room right now. Try again soon.' }, 503);
      if (r.fresh) await roomStub(env, r.code).fetch('https://do/create', { method: 'POST', body: JSON.stringify({ code: r.code, size: 3 }) });
      return json({ code: r.code });
    }
    const mr = p.match(/^\/api\/room\/([A-Za-z]{4})$/);
    if (mr && request.method === 'GET') return roomStub(env, mr[1].toUpperCase()).fetch('https://do/info');
    const mw = p.match(/^\/ws\/([A-Za-z]{4})$/);
    if (mw) {
      if (request.headers.get('Upgrade') !== 'websocket') return text('Expected a WebSocket upgrade', 426);
      return roomStub(env, mw[1].toUpperCase()).fetch(request);
    }
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return text('not found', 404);
  }
};
function lobby(env) { return env.LOBBY.get(env.LOBBY.idFromName('main')); }
function roomStub(env, code) { return env.ROOMS.get(env.ROOMS.idFromName(code)); }

/* ---------------- Room ---------------- */
export class RoomDO {
  constructor(state, env) {
    this.state = state; this.env = env;
    this.room = null; this.meta = null; this.byWs = new Map(); this.nextCid = 1;
    // After a hibernation wake-up the lobby is rebuilt from the per-socket attachments; a match cannot survive a wake-up (its timer keeps the object awake, so one only happens after a restart).
    this.ready = state.blockConcurrencyWhile(async () => {
      this.meta = (await state.storage.get('meta')) || null;
      if (!this.meta) return;
      this.room = this.makeRoom(this.meta.code, this.meta.size);
      const records = [];
      for (const ws of state.getWebSockets()) {
        const a = ws.deserializeAttachment(); if (!a) continue;
        const p = this.player(ws, a); records.push(p);
      }
      if (records.length) {
        this.room.restore(records, this.meta);
        if (this.meta.state === 'game') { this.meta.state = 'lobby'; records.forEach(p => { p.uid = 0; p.rerolls = 1; }); this.room.players.forEach(p => this.room.err(p, 'The match was interrupted by a server restart; back to the lobby.')); }
        this.room.broadcast();
        await this.settle();
      }
    });
  }
  makeRoom(code, size) {
    return new Room(code, size, { createSim, debug: DEBUG, onChange: r => this.report(r) });
  }
  player(ws, a) {
    const p = { cid: a.cid, name: a.name, team: a.team || 0, hero: a.hero || 0, rerolls: a.rerolls == null ? 1 : a.rerolls, uid: a.uid || 0, bucket: 60, last: Date.now(), ws,
      send: s => { try { ws.send(s); } catch (e) {} } };
    this.byWs.set(ws, p);
    return p;
  }
  /* keep the directory and the socket attachments in step with the room */
  report(room) {
    room.players.forEach(p => { try { p.ws.serializeAttachment({ cid: p.cid, name: p.name, team: p.team, hero: p.hero, rerolls: p.rerolls, uid: p.uid }); } catch (e) {} });
    if (this.meta) { this.meta.host = room.host; this.meta.size = room.size; this.meta.state = room.state; this.state.storage.put('meta', this.meta); }
    this.lobbyFetch('/report', room.info());
  }
  /* directory calls are queued so each event handler can await them before it returns */
  lobbyFetch(path, body) {
    const stub = this.env.LOBBY.get(this.env.LOBBY.idFromName('main'));
    const pr = stub.fetch('https://do' + path, { method: 'POST', body: JSON.stringify(body) }).catch(() => {});
    this.pending = (this.pending || Promise.resolve()).then(() => pr);
    return pr;
  }
  settle() { const p = this.pending; this.pending = null; return p || Promise.resolve(); }
  async fetch(request) {
    await this.ready;
    const url = new URL(request.url), p = url.pathname;
    if (p === '/create' && request.method === 'POST') {
      const b = await request.json().catch(() => ({}));
      if (!this.meta) { this.meta = { code: b.code, size: [1, 3, 5].includes(b.size) ? b.size : 3, host: null, state: 'lobby', created: Date.now() }; await this.state.storage.put('meta', this.meta); this.room = this.makeRoom(this.meta.code, this.meta.size); }
      return json({ ok: true, code: this.meta.code });
    }
    if (p === '/info') return this.room ? json(this.room.info()) : json({ error: 'No room with that code. Check the letters and try again.' }, 404);
    if (p.startsWith('/ws/')) {
      if (!this.room) return text('No room with that code.', 404);
      if (request.headers.get('Upgrade') !== 'websocket') return text('Expected a WebSocket upgrade', 426);
      const pair = new WebSocketPair(), client = pair[0], server = pair[1];
      const cid = 'c' + (this.nextCid++).toString(36) + Math.floor(Math.random() * 65536).toString(16) + Date.now().toString(36).slice(-3);
      const name = cleanName(url.searchParams.get('name'), cid);
      this.state.acceptWebSocket(server, [cid]);
      const pl = this.player(server, { cid, name });
      const fail = this.room.join(pl);
      if (fail) { pl.send(JSON.stringify({ t: 'err', msg: fail })); this.byWs.delete(server); try { server.close(4000, fail); } catch (e) {} }
      else this.report(this.room);
      await this.settle();
      return new Response(null, { status: 101, webSocket: client });
    }
    return text('not found', 404);
  }
  async webSocketMessage(ws, data) {
    await this.ready;
    const p = this.byWs.get(ws); if (!p || !this.room) return;
    if (typeof data !== 'string' || data.length > 4096) return;
    const now = Date.now();
    p.bucket = Math.min(60, p.bucket + (now - p.last) * 0.04); p.last = now;   // ~40 messages per second sustained
    if (p.bucket < 1) return; p.bucket--;
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    try { this.room.message(p, m); } catch (e) { console.error('message error', e); }
    await this.settle();
  }
  async webSocketClose(ws) { await this.ready; this.drop(ws); try { ws.close(); } catch (e) {} await this.settle(); }
  async webSocketError(ws) { await this.ready; this.drop(ws); await this.settle(); }
  drop(ws) {
    const p = this.byWs.get(ws); this.byWs.delete(ws);
    if (!p || !this.room) return;
    this.room.leave(p);
    if (this.room.players.size === 0) this.close();
  }
  /* the last player left: forget the room so the code can be reused */
  close() {
    const code = this.meta && this.meta.code;
    if (this.room) this.room.destroy();
    this.room = null; this.meta = null;
    this.state.storage.deleteAll();
    if (code) this.lobbyFetch('/remove', { code });
  }
}

/* ---------------- Directory ---------------- */
export class LobbyDO {
  constructor(state, env) {
    this.state = state; this.env = env; this.rooms = {};
    this.ready = state.blockConcurrencyWhile(async () => { this.rooms = (await state.storage.get('rooms')) || {}; });
  }
  save() { return this.state.storage.put('rooms', this.rooms); }
  purge() { const cut = Date.now() - 2 * 3600 * 1000; for (const c in this.rooms) if (this.rooms[c].updated < cut) delete this.rooms[c]; }
  alloc(size) {
    this.purge();
    if (Object.keys(this.rooms).length >= 2000) return null;
    let code = null; for (let k = 0; k < 50 && !code; k++) { const c = randomCode(); if (!this.rooms[c]) code = c; }
    if (!code) return null;
    this.rooms[code] = { state: 'lobby', players: 0, size, botFree: false, updated: Date.now() };
    return code;
  }
  async fetch(request) {
    await this.ready;
    const p = new URL(request.url).pathname;
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    switch (p) {
      case '/alloc': { const code = this.alloc([1, 3, 5].includes(body.size) ? body.size : 3); await this.save(); return json({ code }); }
      case '/quick': {
        this.purge();
        const list = Object.entries(this.rooms).map(([code, r]) => Object.assign({ code }, r)).sort((a, b) => b.updated - a.updated);
        const open = list.find(r => r.state === 'lobby' && r.players > 0 && r.players < r.size * 2) || list.find(r => r.state === 'game' && r.botFree);
        if (open) return json({ code: open.code });
        const code = this.alloc(3); await this.save(); return json({ code, fresh: true });
      }
      case '/report': {
        if (!validCode(body.code)) return json({ ok: false }, 400);
        this.rooms[body.code] = { state: body.state, players: body.players | 0, size: body.size | 0, botFree: !!body.botFree, updated: Date.now() };
        await this.save(); return json({ ok: true });
      }
      case '/remove': { if (validCode(body.code)) { delete this.rooms[body.code]; await this.save(); } return json({ ok: true }); }
      case '/status': {
        this.purge();
        let players = 0, rooms = 0; for (const c in this.rooms) { const r = this.rooms[c]; if (r.players > 0) { rooms++; players += r.players; } }
        return json({ rooms, players });
      }
    }
    return text('not found', 404);
  }
}
