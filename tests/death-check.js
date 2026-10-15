// Death experience check: the player takes damage from several sources, dies, and the recap panel, countdown and thermal feed are verified and screenshotted.
// Usage: node tests/death-check.js /abs/path/index.html outPrefix
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--allow-file-access-from-files'] } : {});
  const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_TUNNEL|ERR_NAME/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.goto('file://' + process.argv[2]); await p.waitForTimeout(600);
  await p.selectOption('#squadSize', '5'); await p.click('#deploy');
  // Let the match develop, then push the player into the enemy line and let them die to real damage.
  await p.evaluate(() => { const PF = window.__PF; PF.opts.pause = true; PF.opts.sound = false; for (let i = 0; i < 30 * 40; i++) PF.update(1 / 30); PF.opts.pause = false; });
  await p.evaluate(() => {
    const PF = window.__PF, G = PF.G, me = G.player;
    const foe = G.units.find(u => u.kind === 'hero' && u.team === 1 && !u.dead) || G.units.find(u => u.team === 1 && !u.dead);
    me.hp = Math.min(me.hp, 260); me.x = foe.x - 120; me.y = foe.y + 10; me.move = null; me.target = null;
    G.units.forEach(u => { if (u.team === 1 && u.kind === 'hero' && !u.dead) { u.x = me.x + 150 + Math.random() * 60; u.y = me.y + (Math.random() - 0.5) * 120; u.target = me; } });
  });
  let dead = false;
  for (let i = 0; i < 60 && !dead; i++) { await p.waitForTimeout(250); dead = await p.evaluate(() => window.__PF.G.player.dead); }
  await p.waitForTimeout(900);
  const st = await p.evaluate(() => {
    const G = window.__PF.G, d = document.getElementById('death');
    return { dead: G.player.dead, respawn: G.player.respawn, thermal: G.thermal, panelShown: !d.hidden, killer: document.getElementById('dKiller').textContent, total: document.getElementById('dTotal').textContent, win: document.getElementById('dWin').textContent, rows: [...document.querySelectorAll('#dRows .drow')].map(r => r.querySelector('.nm').textContent + ' | ' + r.querySelector('.wp').textContent + ' | ' + r.querySelector('.amt').textContent), count: document.getElementById('dCount').textContent, ring: document.getElementById("dRing").style.width };
  });
  console.log(JSON.stringify(st, null, 1));
  await p.screenshot({ path: process.argv[3] + '-death.png' });
  // thermal pixel sample: the centre of the screen should be cold (blue/purple) or hot (yellow/white), never backyard green
  const px = await p.evaluate(() => { const c = document.getElementById('game'), x = c.getContext('2d'); const d = x.getImageData(Math.round(c.width * 0.5), Math.round(c.height * 0.7), 1, 1).data; return [d[0], d[1], d[2]]; });
  console.log('centre pixel', px, 'green-dominant:', px[1] > px[0] && px[1] > px[2]);
  // change figure while reinforcing: open the reassignment screen from the death panel, pick the first available figure
  const before = await p.evaluate(() => window.__PF.G.player.name);
  await p.click('#swapBtn'); await p.waitForTimeout(150);
  const grid = await p.evaluate(() => ({ open: !document.getElementById('swapModal').hidden, buttons: document.querySelectorAll('#swapGrid button').length, disabled: document.querySelectorAll('#swapGrid button:disabled').length, timer: document.getElementById('swapTimer').textContent }));
  await p.screenshot({ path: process.argv[3] + '-swap.png' });
  await p.click('#swapGrid button:not(:disabled)'); await p.waitForTimeout(150);
  const swapped = await p.evaluate(() => { const G = window.__PF.G, u = G.player; return { name: u.name, pose: u.pose, dead: u.dead, lvl: u.lvl, closed: document.getElementById('swapModal').hidden, abil: document.querySelector('#abil .ab .n').textContent, feed: G.feed[0] && G.feed[0].txt }; });
  console.log('swap', JSON.stringify({ before, grid, swapped }));
  // wait for the respawn, then make sure everything is restored
  for (let i = 0; i < 120; i++) { const alive = await p.evaluate(() => !window.__PF.G.player.dead); if (alive) break; await p.waitForTimeout(250); }
  await p.waitForTimeout(600);
  const after = await p.evaluate(() => ({ dead: window.__PF.G.player.dead, thermal: window.__PF.G.thermal, panelHidden: document.getElementById('death').hidden, death: window.__PF.G.death, name: window.__PF.G.player.name, hp: Math.round(window.__PF.G.player.hp), maxHp: window.__PF.maxHp ? window.__PF.maxHp(window.__PF.G.player) : null }));
  console.log('after respawn', JSON.stringify(after));
  await p.screenshot({ path: process.argv[3] + '-respawn.png' });
  // thermal frame cost
  const cost = await p.evaluate(() => { const PF = window.__PF; PF.G.player.dead = true; PF.G.player.respawn = 10; PF.G.thermal = 1; const t0 = performance.now(); for (let i = 0; i < 30; i++) window.__PF.draw(); const ms = (performance.now() - t0) / 30; PF.G.player.dead = false; PF.G.thermal = 0; return ms; });
  console.log('thermal draw ms/frame', cost.toFixed(2));
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
  const swapOk = grid.open && grid.buttons === 16 && swapped.name !== before && swapped.closed && after.name === swapped.name && !after.dead;
  console.log('swap ok:', swapOk);
  process.exit(st.panelShown && st.rows.length > 0 && st.thermal > 0.9 && after.panelHidden && !after.dead && swapOk && errs.length === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
