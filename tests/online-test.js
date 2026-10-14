// Online end-to-end test: starts the server, drives real browser clients through lobby and a live match.
// Usage: node tests/online-test.js [outPrefix]
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { spawn } = require('child_process');
const path = require('path');
const out = process.argv[2] || path.join(__dirname, 'out-online');
const PORT = 8099, URL = 'http://localhost:' + PORT + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail != null ? '  ' + JSON.stringify(detail) : '')); }

(async () => {
  const srv = global.__srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), PF_DEBUG: '1' }), stdio: ['ignore', 'pipe', 'pipe'] });
  let srvLog = ''; srv.stdout.on('data', d => srvLog += d); srv.stderr.on('data', d => srvLog += d);
  await sleep(800);
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } : {});
  const errors = []; global.__errors = errors; global.__srvLog = () => srvLog;
  async function client(name) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(name + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_TUNNEL|ERR_NAME/.test(m.text())) errors.push(name + ' console: ' + m.text()); });
    page.bytes = 0; page.frames = 0;
    page.on('websocket', ws => ws.on('framereceived', f => { page.bytes += (f.payload || '').length; page.frames++; }));
    await page.goto(URL); await page.waitForTimeout(700);
    await page.click('#tabOnline');
    await page.fill('#oName', name);
    return page;
  }
  const st = p => p.evaluate(() => { const PF = window.__PF, G = PF.G, me = G && G.player; return { mode: PF.NET.mode, time: G ? G.time : 0, units: G ? G.units.length : 0, visible: G ? G.units.filter(u => !u._hidden).length : 0, hidden: G ? G.units.filter(u => u._hidden).length : 0, me: me ? { id: me.id, team: me.team, x: Math.round(me.x), y: Math.round(me.y), name: me.name, cdQ: me.cd.Q, hp: me.hp, lvl: me.lvl } : null, kills: G ? G.kills : null, rounds: G ? G.rounds.length : 0, hurtMinions: G ? G.units.filter(u => u.kind === 'minion' && u.hp < u.maxHp).length : 0, feed: G ? G.feed.map(f => f.txt) : [], draftHidden: document.getElementById('draft').hidden }; });

  const A = await client('Alpha');
  await A.click('#oCreate');
  await A.waitForSelector('#lobbyPanel:not([hidden])', { timeout: 8000 });
  const code = (await A.textContent('#lCode')).trim();
  check('room created with a 4-letter code', /^[A-Z]{4}$/.test(code), code);

  const B = await client('Bravo');
  await B.fill('#oCode', code); await B.click('#oJoin');
  await B.waitForSelector('#lobbyPanel:not([hidden])', { timeout: 8000 });
  await A.waitForFunction(() => document.querySelectorAll('#lTeam0 li:not(.bot), #lTeam1 li:not(.bot)').length === 2, null, { timeout: 5000 });
  const lobbyA = await A.evaluate(() => ({ t0: [...document.querySelectorAll('#lTeam0 li')].map(l => l.textContent), t1: [...document.querySelectorAll('#lTeam1 li')].map(l => l.textContent), start: !document.getElementById('lStart').hidden }));
  check('both players listed on opposite teams, bots fill the rest', lobbyA.t0.some(t => /Alpha/.test(t)) && lobbyA.t1.some(t => /Bravo/.test(t)) && lobbyA.t0.filter(t => /Bot/.test(t)).length === 2, lobbyA);
  check('host sees Start, guest does not', lobbyA.start && await B.evaluate(() => document.getElementById('lStart').hidden));
  await A.screenshot({ path: out + '-lobby.png' });

  const heroBefore = await B.textContent('#lHero');
  await B.click('#lReroll'); await sleep(400);
  const heroAfter = await B.textContent('#lHero');
  check('reroll draws a different hero and uses the one reroll', heroBefore !== heroAfter && await B.evaluate(() => document.getElementById('lReroll').disabled), [heroBefore, heroAfter]);

  await A.click('#lStart');
  await A.waitForFunction(() => window.__PF.NET.mode === 'online' && window.__PF.G.time > 1, null, { timeout: 8000 });
  await B.waitForFunction(() => window.__PF.NET.mode === 'online' && window.__PF.G.time > 1, null, { timeout: 8000 });
  let a = await st(A), b = await st(B);
  check('match started for both with opposite teams', a.me && b.me && a.me.team === 0 && b.me.team === 1 && a.draftHidden && b.draftHidden, { a: a.me, b: b.me });
  check('3v3 roster: 6 heroes known to each client', a.units >= 6 && b.units >= 6, { a: a.units, b: b.units });

  // Move both players toward mid by clicking the ground ahead of them
  const startA = a.me;
  await A.mouse.move(1000, 250); await A.mouse.click(1000, 250);
  await B.mouse.move(200, 600); await B.mouse.click(200, 600);
  await sleep(2500);
  a = await st(A); b = await st(B);
  const movedA = Math.hypot(a.me.x - startA.x, a.me.y - startA.y);
  check('click-to-move is applied by the server and shown on the client', movedA > 150, { movedA: Math.round(movedA) });
  await A.mouse.move(1000, 250); await A.keyboard.press('q'); await sleep(500);
  a = await st(A);
  check('ability cast goes through the server (Q on cooldown)', a.me.cdQ > 0, { cdQ: a.me.cdQ });

  // Let the armies meet
  const t0 = Date.now(), b0 = A.bytes, f0 = A.frames;
  await sleep(14000);
  const secs = (Date.now() - t0) / 1000;
  a = await st(A); b = await st(B);
  check('snapshots keep flowing (~20 per second)', A.frames - f0 > secs * 15, { perSec: Math.round((A.frames - f0) / secs) });
  check('bandwidth per player stays modest', (A.bytes - b0) / secs < 60000, { bytesPerSec: Math.round((A.bytes - b0) / secs) });
  check('clients agree on match time', Math.abs(a.time - b.time) < 0.5, { a: a.time, b: b.time });
  check('combat is happening (damaged reserves seen)', a.hurtMinions + b.hurtMinions > 0 || a.rounds + b.rounds > 0, { hurtA: a.hurtMinions, hurtB: b.hurtMinions });
  await A.screenshot({ path: out + '-match.png' });

  await A.keyboard.down('Tab'); await sleep(1300);
  const sbRows = await A.evaluate(() => document.querySelectorAll('#sbTeams tbody tr').length);
  await A.screenshot({ path: out + '-scoreboard.png' });
  await A.keyboard.up('Tab');
  check('Tab scoreboard lists all 6 heroes online', sbRows === 6, { rows: sbRows });

  // Drop-in: a third player quick-matches into the running game and takes over a bot
  const C = await client('Charlie');
  await C.click('#oQuick');
  await C.waitForFunction(() => window.__PF.NET.mode === 'online' && window.__PF.G && window.__PF.G.time > 1, null, { timeout: 8000 });
  const c = await st(C);
  check('quick match drops a new player into the live game', !!c.me, c.me);
  await sleep(1500);
  const namesOnA = await A.evaluate(() => window.__PF.G.units.filter(u => u.pname).map(u => u.pname));
  check('everyone sees the new player name', namesOnA.includes('Charlie'), namesOnA);

  // Disconnect: Bravo leaves, a bot takes over
  await B.close(); await sleep(2500);
  a = await st(A);
  check('when a player leaves, a bot takes over their hero', a.feed.some(t => /Bravo left/.test(t)), a.feed);


  // End of match -> back to lobby -> rematch
  await A.evaluate(() => window.__PF.netSend({ t: 'dbg_win' }));
  await A.waitForSelector('#endModal:not([hidden])', { timeout: 5000 });
  await C.waitForSelector('#endModal:not([hidden])', { timeout: 5000 });
  const endA = await A.textContent('#endTitle'), endBtn = await A.textContent('#again');
  check('match end shows the result to everyone', /accomplished|secured/.test(endA) && /lobby/i.test(endBtn), { endA, endBtn });
  await A.screenshot({ path: out + '-end.png' });
  await A.click('#again');
  await A.waitForFunction(() => !document.getElementById('lobbyPanel').hidden && /host/.test(document.getElementById('lStatus').textContent), null, { timeout: 15000 });
  check('room returns to the lobby with fresh hero draws', await A.evaluate(() => !document.getElementById('lReroll').disabled));
  await C.click('#again');
  await A.click('#lStart');
  await A.waitForFunction(() => window.__PF.G && !window.__PF.G.over && window.__PF.G.time > 0.5 && document.getElementById('draft').hidden, null, { timeout: 8000 });
  await C.waitForFunction(() => window.__PF.G && !window.__PF.G.over && window.__PF.G.time > 0.5 && document.getElementById('draft').hidden, null, { timeout: 8000 });
  check('rematch starts for everyone in the room', true);
  const status = await (await fetch(URL + 'status')).json();
  check('server status endpoint', status.rooms === 1 && status.players === 2, status);
  check('no page errors', errors.length === 0, errors.slice(0, 5));
  check('no server errors', !/error/i.test(srvLog), srvLog.slice(-400));


  // Fog of war: the server must not send an enemy hiding in a thicket unless one of your units is close
  {
    const S = require(path.join(__dirname, '..', 'server', 'server.js'));
    const room = S.createRoom(1); const fake = cid => ({ cid, ws: { readyState: 0 }, team: 0, hero: 0, name: cid });
    const p0 = fake('t0'), p1 = fake('t1'); p1.team = 1; p1.hero = 1; room.players.set('t0', p0); room.players.set('t1', p1);
    S.startMatch(room); S.stopRoom(room);
    const C = room.ctx, G = C.G, me = G.units.find(u => u.team === 0 && u.kind === 'hero'), foe = G.units.find(u => u.team === 1 && u.kind === 'hero');
    const bush = C.BRUSH[0]; foe.x = bush.x; foe.y = bush.y; me.x = bush.x - 600; me.y = bush.y + 200;
    const hidden = !S.teamSnap(room, 0, []).u.some(a => a[0] === foe.id);
    me.x = bush.x - 120; me.y = bush.y;
    const spotted = S.teamSnap(room, 0, []).u.some(a => a[0] === foe.id);
    const ownTeamSeesIt = S.teamSnap(room, 1, []).u.some(a => a[0] === foe.id);
    check('fog: enemy in a thicket is not sent until you get close', hidden && spotted && ownTeamSeesIt, { hidden, spotted, ownTeamSeesIt });
    S.rooms.delete(room.code);
  }
  await browser.close(); srv.kill();
  const failed = results.filter(r => !r.ok).length;
  console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('FAIL', e); console.error('PAGE ERRORS', JSON.stringify(global.__errors || [])); console.error('SERVER LOG', global.__srvLog ? global.__srvLog() : ''); if (global.__srv) global.__srv.kill(); process.exit(1); });
