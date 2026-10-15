// Plastic Front game server (Node): serves the game page and runs authoritative real-time matches over WebSocket.
// Usage: node server/server.js   (PORT env var, default 8080)
// The room logic lives in room.js and is shared with the Cloudflare Durable Object in worker/.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { createSim } = require('./sim');
const { Room, randomCode, validCode, cleanName, num } = require('./room');

const PORT = Number(process.env.PORT) || 8080;
const DEBUG = process.env.PF_DEBUG === '1';
const INDEX = path.join(__dirname, '..', 'index.html');
const ASSETS = path.join(__dirname, '..', 'assets');
const MAX_ROOMS = 200;

const rooms = new Map();       // code -> Room
let nextCid = 1;

/* ---------------- Rooms ---------------- */
function createRoom(size) {
  if (rooms.size >= MAX_ROOMS) return null;
  let code = null; for (let k = 0; k < 50 && !code; k++) { const c = randomCode(); if (!rooms.has(c)) code = c; }
  if (!code) return null;
  const room = new Room(code, size, { createSim, debug: DEBUG });
  rooms.set(code, room);
  return room;
}
function dropIfEmpty(room) { if (room.players.size === 0) { room.destroy(); rooms.delete(room.code); } }
function quickRoom() {
  return [...rooms.values()].find(r => r.state === 'lobby' && r.players.size < r.size * 2)
    || [...rooms.values()].find(r => r.botFree())
    || createRoom(3);
}
setInterval(() => { rooms.forEach(r => { if (r.players.size === 0 && Date.now() - r.created > 120000) { r.destroy(); rooms.delete(r.code); } }); }, 60000);

/* ---------------- HTTP ---------------- */
let indexHtml = null;
function loadIndex() { try { indexHtml = fs.readFileSync(INDEX); } catch (e) { indexHtml = null; } }
loadIndex();
function json(res, status, obj) { res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); }
function readBody(req) { return new Promise(resolve => { let b = ''; req.on('data', d => { b += d; if (b.length > 4096) req.destroy(); }); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { resolve({}); } }); req.on('error', () => resolve({})); }); }
const server = http.createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'content-type' }); res.end(); return; }
  if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (url === '/health') { res.writeHead(200, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' }); res.end('ok'); return; }
  if (url === '/status') {
    let players = 0; rooms.forEach(r => { players += r.players.size; });
    return json(res, 200, { rooms: rooms.size, players });
  }
  if (url === '/api/room' && req.method === 'POST') {
    const body = await readBody(req), room = createRoom(num(body.size, 1, 5));
    return room ? json(res, 200, { code: room.code }) : json(res, 503, { error: 'The server is full right now. Try again soon.' });
  }
  if (url === '/api/quick' && req.method === 'POST') {
    const room = quickRoom();
    return room ? json(res, 200, { code: room.code }) : json(res, 503, { error: 'The server is full right now. Try again soon.' });
  }
  const mr = url.match(/^\/api\/room\/([A-Za-z]{4})$/);
  if (mr && req.method === 'GET') {
    const room = rooms.get(mr[1].toUpperCase());
    return room ? json(res, 200, room.info()) : json(res, 404, { error: 'No room with that code. Check the letters and try again.' });
  }
  if (url === '/' || url === '/index.html') {
    if (!indexHtml) loadIndex();
    if (!indexHtml) { res.writeHead(500); res.end('index.html missing: run node build.js'); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' });
    res.end(indexHtml); return;
  }
  if (url.startsWith('/assets/') && !url.includes('..')) {
    // the painted map and the soldier illustrations; immutable files, so let browsers cache them for a week
    const file = path.join(ASSETS, url.slice('/assets/'.length));
    const type = file.endsWith('.webp') ? 'image/webp' : file.endsWith('.png') ? 'image/png' : file.endsWith('.jpg') ? 'image/jpeg' : null;
    if (type && file.startsWith(ASSETS)) {
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return; }
        res.writeHead(200, { 'content-type': type, 'cache-control': 'public, max-age=604800', 'x-content-type-options': 'nosniff' }); res.end(data);
      });
      return;
    }
  }
  res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found');
});

/* ---------------- WebSocket: one socket per room, ws://host/ws/CODE?name=... ---------------- */
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
server.on('upgrade', (req, socket, head) => {
  const u = new URL(req.url, 'http://x');
  const m = u.pathname.match(/^\/ws\/([A-Za-z]{4})$/);
  const room = m && rooms.get(m[1].toUpperCase());
  if (!room) { socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n'); socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => {
    const cid = 'c' + (nextCid++).toString(36) + crypto.randomBytes(2).toString('hex');
    const p = { cid, name: cleanName(u.searchParams.get('name'), cid), team: 0, hero: 0, rerolls: 1, uid: 0, bucket: 60, last: Date.now(), send: s => { if (ws.readyState === 1) ws.send(s); } };
    const fail = room.join(p);
    if (fail) { p.send(JSON.stringify({ t: 'err', msg: fail })); ws.close(4000, fail); dropIfEmpty(room); return; }
    ws.on('message', data => {
      const now = Date.now();
      p.bucket = Math.min(60, p.bucket + (now - p.last) * 0.04); p.last = now;   // ~40 messages per second sustained
      if (p.bucket < 1) return; p.bucket--;
      let msg; try { msg = JSON.parse(data); } catch (e) { return; }
      try { room.message(p, msg); } catch (e) { console.error('message error', e); }
    });
    ws.on('close', () => { room.leave(p); dropIfEmpty(room); });
    ws.on('pong', () => { ws._dead = false; });
  });
});

if (require.main === module) {
  setInterval(() => { wss.clients.forEach(ws => { if (ws._dead) return ws.terminate(); ws._dead = true; ws.ping(); }); }, 30000);
  server.listen(PORT, '0.0.0.0', () => console.log('Plastic Front server on http://localhost:' + PORT + '  (WebSocket at /ws/CODE)'));
}
module.exports = { createRoom, rooms, Room };
