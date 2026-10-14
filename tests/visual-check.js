const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } : {});
  const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + process.argv[2]); await p.waitForTimeout(600);
  await p.selectOption('#squadSize', '5'); await p.click('#deploy');
  await p.evaluate(() => { const PF = window.__PF; PF.opts.pause = true; PF.opts.sound = false; PF.G.player.bot = true; PF.opts.god = true; for (let i = 0; i < 30 * 70; i++) PF.update(1 / 30); PF.opts.pause = false; });
  // wait until the player is fighting a hero, up to 20s real time
  for (let i = 0; i < 40; i++) { const busy = await p.evaluate(() => { const u = window.__PF.G.player; return !!(u.target && u.target.kind === 'hero') || window.__PF.G.rounds.length > 6; }); if (busy) break; await p.waitForTimeout(500); }
  await p.waitForTimeout(250);
  await p.screenshot({ path: process.argv[3] + '-fight.png' });
  await p.keyboard.down('Tab'); await p.waitForTimeout(400);
  await p.screenshot({ path: process.argv[3] + '-tab.png' });
  await p.keyboard.up('Tab'); await p.waitForTimeout(200);
  const hidden = await p.evaluate(() => document.getElementById('sb').hidden);
  console.log('scoreboard hides on release:', hidden, 'errors:', errs.length ? errs : 'none');
  await b.close();
})();
