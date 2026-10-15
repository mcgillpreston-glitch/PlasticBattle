// Usage: node harness.js <page.html> <outPrefix> [matchSeconds] [matches]
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs');
const [,, file, out, secsArg, nArg] = process.argv;
const MATCH_SECS = Number(secsArg || 240), MATCHES = Number(nArg || 2);

const geom = `
function vl(x,y){return Math.sqrt(x*x+y*y);}
function segPt(px,py,ax,ay,bx,by){var dx=bx-ax,dy=by-ay,L=dx*dx+dy*dy,t=L?((px-ax)*dx+(py-ay)*dy)/L:0;t=t<0?0:t>1?1:t;return vl(px-ax-dx*t,py-ay-dy*t);}
function surf(b,x,y){ if (b.ax!=null) return segPt(x,y,b.ax,b.ay,b.bx,b.by)-b.r; return vl(x-b.x,y-b.y)-b.r; }
function ext(b){ return (b.h||0)+b.r; }
function valid(PF,p,r){ if (PF.fieldSD(p.x,p.y)<r+2) return false; var bl=PF.G.blockers; for (var i=0;i<bl.length;i++) if (surf(bl[i],p.x,p.y)<r+2) return false; return true; }
function tagOf(PF,b){ if (b.tag) return b.tag; var s=PF.G.structs.find(function(s){return Math.abs(s.x-b.x)<1&&Math.abs(s.y-b.y)<1;}); return s?s.kind:'?'; }
`;

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--allow-file-access-from-files'] } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|fonts/.test(m.text())) errors.push(m.text()); });
  await page.goto('file://' + file);
  await page.waitForTimeout(800);
  await page.evaluate(() => { document.getElementById('deploy').click(); window.__PF.opts.pause = true; window.__PF.opts.sound = false; });

  // ---------- Test 1: obstacle course ----------
  const course = await page.evaluate((geom) => {
    eval(geom);
    var PF = window.__PF, res = [];
    [14, 22, 28].forEach(function (ur) {
      PF.newGame(3, 1);
      var G = PF.G; PF.opts.god = true; PF.opts.passive = true; PF.opts.pause = true;
      var blk = G.blockers.slice(), runs = [];
      blk.forEach(function (b, bi) {
        var tag = tagOf(PF, b);
        for (var a = 0; a < 8; a++) {
          var ang = a * Math.PI / 4, R0 = ext(b) + ur + 30;
          var s = { x: b.x + Math.cos(ang) * R0, y: b.y + Math.sin(ang) * R0 }, g = { x: b.x - Math.cos(ang) * R0, y: b.y - Math.sin(ang) * R0 };
          runs.push({ tag: tag, bi: bi, a: a, s: PF.clampField(s, ur + 2), g: PF.clampField(g, ur + 2) });
        }
      });
      // lane runs: along each lane in steps, and across from one lane to the next at matching progress
      PF.LANES.forEach(function (L, li) {
        for (var t = 0.04; t < 0.9; t += 0.12) { runs.push({ tag: 'lane' + li, bi: 100 + li, a: Math.round(t * 100), s: PF.lanePt(t, 0, li), g: PF.lanePt(t + 0.12, 0, li) }); }
        for (var t2 = 0.3; t2 <= 0.7; t2 += 0.2) { var lj = (li + 1) % 3; runs.push({ tag: 'cross' + li + lj, bi: 200 + li, a: Math.round(t2 * 100), s: PF.lanePt(t2, 0, li), g: PF.lanePt(t2, 0, lj) }); }
      });
      runs.forEach(function (run) {
        var tag = run.tag, bi = run.bi, a = run.a, s = run.s, g = run.g;
        {
          if (!valid(PF, s, ur) || !valid(PF, g, ur)) { res.push({ ur: ur, tag: tag, bi: bi, a: a, skip: 1 }); return; }
          G = PF.G; G.units = [G.player]; G.nextWave = 1e9; G.proj = []; G.lobs = []; G.mines = []; G.fx = [];
          var u = G.player; u.r = ur; u.x = s.x; u.y = s.y; u.move = { x: g.x, y: g.y }; u.target = null; u.amove = null; u.buffs = []; u.slowT = 0; u.kvx = u.kvy = 0; u.path = null; u.dash = null; u.dead = false; u.bot = false;
          var spd = u.spec.spd, straight = vl(g.x - s.x, g.y - s.y), limit = straight / spd * (/cross|lane/.test(tag) ? 2.5 : 1) + 4, t = 0;
          for (; t < limit; t += 1 / 30) { PF.update(1 / 30); if (!u.move) break; }
          var miss = vl(u.x - g.x, u.y - g.y);
          res.push({ ur: ur, tag: tag, bi: bi, a: a, ok: miss < 40, time: t, ideal: straight / spd, miss: Math.round(miss), sx: s.x, sy: s.y, ex: u.x, ey: u.y });
        }
      });
    });
    return res;
  }, geom);

  // ---------- Test 2: bot-only matches with stuck detector ----------
  const events = [], summary = [];
  for (let m = 0; m < MATCHES; m++) {
    await page.evaluate((idx) => { var PF = window.__PF; PF.newGame(idx, 5); PF.G.player.bot = true; PF.opts.god = false; PF.opts.passive = false; PF.opts.pause = true; window.__TRK = {}; window.__EV = []; }, (m * 5 + 2) % 16);
    const step = 30;
    for (let s0 = 0; s0 < MATCH_SECS; s0 += step) {
      await page.evaluate(([geom, step]) => {
        eval(geom);
        var PF = window.__PF, TRK = window.__TRK, EV = window.__EV, dt = 1 / 30, sampleEvery = 0.25;
        for (var t = 0; t < step; t += dt) {
          PF.update(dt);
          var G = PF.G; if (G.over) break;
          if (Math.round(G.time / dt) % Math.round(sampleEvery / dt) !== 0) continue;
          G.units.forEach(function (u) {
            var k = TRK[u.id] || (TRK[u.id] = { hist: [], stuck: null });
            var want = false;
            if (!u.dead && !u.dash && !u.cone && !u.chan && PF.moveSpeed(u) > 0) {
              if (u.target && !u.target.dead) { var rng = PF.aaRange(u) + (u.target.r || 0) + u.r * 0.5; want = vl(u.target.x - u.x, u.target.y - u.y) > rng + 4; }
              else if (u.move) want = vl(u.move.x - u.x, u.move.y - u.y) > 14;
            }
            k.hist.push({ t: G.time, x: u.x, y: u.y, want: want });
            if (k.hist.length > 5) k.hist.shift();
            var h = k.hist, isStuck = h.length === 5 && h.every(function (e) { return e.want; }) && vl(h[4].x - h[0].x, h[4].y - h[0].y) < 8;
            if (isStuck && !k.stuck) {
              var bl = G.blockers, nb = null, nd = 1e9; bl.forEach(function (b) { var d = surf(b, u.x, u.y) - u.r; if (d < nd) { nd = d; nb = b; } });
              var q = PF.laneProj(u, PF.nearestLane(u)), crowd = G.units.filter(function (o) { return o !== u && !o.dead && vl(o.x - u.x, o.y - u.y) < o.r + u.r + 6; }).length;
              var cause = nd < 8 ? 'obstacle:' + tagOf(PF, nb) : PF.fieldSD(u.x, u.y) < u.r + 6 ? 'field edge' : crowd >= 2 ? 'crowd' : 'other';
              k.stuck = { t0: h[0].t, x: u.x, y: u.y, lt: q.t, off: q.off, kind: u.kind === 'hero' ? 'hero' : 'minion:' + u.type, cause: cause, team: u.team, goal: u.target ? 'target' : 'move' };
            } else if (!isStuck && k.stuck) { k.stuck.dur = G.time - k.stuck.t0; EV.push(k.stuck); k.stuck = null; }
          });
        }
      }, [geom, step]);
    }
    const r = await page.evaluate(() => { var PF = window.__PF, G = PF.G; Object.values(window.__TRK).forEach(function (k) { if (k.stuck) { k.stuck.dur = G.time - k.stuck.t0; k.stuck.open = 1; window.__EV.push(k.stuck); } }); return { ev: window.__EV, time: G.time, kills: G.kills, waves: G.wave, structs: G.structs.map(function (s) { return s.team + s.kind + (s.dead ? 'X' : ''); }).join(' ') }; });
    r.ev.forEach(e => { e.match = m; events.push(e); });
    summary.push({ match: m, simSeconds: Math.round(r.time), kills: r.kills, waves: r.waves, structs: r.structs, stuckEvents: r.ev.length });
  }

  // ---------- Map image of stick points ----------
  const png = await page.evaluate(([geom, course, events]) => {
    eval(geom);
    var PF = window.__PF; PF.newGame(3, 1);
    var G = PF.G, MAP = PF.MAP, S = 0.5, c = document.createElement('canvas'); c.width = MAP.W * S; c.height = MAP.H * S;
    var x = c.getContext('2d'); x.scale(S, S);
    x.fillStyle = '#2f3a22'; x.fillRect(0, 0, MAP.W, MAP.H);
    if (PF.ASSETS.map) { x.globalAlpha = 0.5; x.drawImage(PF.ASSETS.map, 0, 0, MAP.W, MAP.H); x.globalAlpha = 1; }
    x.lineCap = 'round'; PF.FIELD_CAPS.forEach(function (cp) { x.strokeStyle = 'rgba(120,100,60,0.55)'; x.lineWidth = cp.r * 2; x.beginPath(); x.moveTo(cp.ax, cp.ay); x.lineTo(cp.bx, cp.by); x.stroke(); });
    x.lineCap = 'butt';
    G.blockers.forEach(function (b) { x.fillStyle = 'rgba(200,200,190,0.85)'; x.strokeStyle = '#111'; x.lineWidth = 3; if (b.ax != null) { x.lineCap = 'round'; x.lineWidth = b.r * 2; x.strokeStyle = 'rgba(200,200,190,0.85)'; x.beginPath(); x.moveTo(b.ax, b.ay); x.lineTo(b.bx, b.by); x.stroke(); x.lineWidth = 3; } else { x.beginPath(); x.arc(b.x, b.y, b.r, 0, 7); x.fill(); x.stroke(); } });
    course.forEach(function (r) { if (r.skip || r.ok) return; x.strokeStyle = '#ffcc33'; x.lineWidth = 3; x.beginPath(); x.moveTo(r.sx, r.sy); x.lineTo(r.ex, r.ey); x.stroke(); x.fillStyle = '#ffcc33'; x.beginPath(); x.arc(r.ex, r.ey, 9, 0, 7); x.fill(); });
    events.forEach(function (e) { var big = Math.min(26, 6 + e.dur * 4); x.fillStyle = e.kind === 'hero' ? 'rgba(255,60,40,0.75)' : 'rgba(80,170,255,0.7)'; x.beginPath(); x.arc(e.x, e.y, big, 0, 7); x.fill(); });
    x.fillStyle = '#fff'; x.font = '44px sans-serif'; x.fillText('red = hero stuck   blue = minion stuck   yellow = failed obstacle course run', 40, 70);
    return c.toDataURL('image/png');
  }, [geom, course, events]);
  fs.writeFileSync(out + '-map.png', Buffer.from(png.split(',')[1], 'base64'));

  // ---------- Report ----------
  const ratios = course.filter(r=>!r.skip).map(r=>r.time/r.ideal).sort((a,b)=>a-b); console.error('RATIO p50', ratios[ratios.length>>1].toFixed(2), 'p90', ratios[Math.floor(ratios.length*0.9)].toFixed(2), 'max', ratios[ratios.length-1].toFixed(2), JSON.stringify(course.filter(r=>!r.skip).sort((a,b)=>b.time/b.ideal-a.time/a.ideal).slice(0,4).map(r=>({ur:r.ur,tag:r.tag,a:r.a,t:+r.time.toFixed(2),ideal:+r.ideal.toFixed(2)})))); const runs = course.filter(r => !r.skip), fails = runs.filter(r => !r.ok), slow = runs.filter(r => r.ok && r.time > r.ideal * 1.6 + 0.5);
  const byKey = (arr, f) => arr.reduce((m, e) => { const k = f(e); m[k] = (m[k] || 0) + 1; return m; }, {});
  const sig = events.filter(e => e.dur >= 1.5);
  const hot = byKey(sig, e => 't=' + (Math.round(e.lt * 50) / 50).toFixed(2) + ' ' + (e.off > 60 ? 'north' : e.off < -60 ? 'south' : 'mid') + ' ' + e.cause);
  const rep = {
    course: { runs: runs.length, skipped: course.length - runs.length, failed: fails.length, slow: slow.length,
      failsBy: byKey(fails, r => 'r' + r.ur + ' ' + r.tag), slowBy: byKey(slow, r => 'r' + r.ur + ' ' + r.tag) },
    matches: summary,
    stuck: { events: events.length, over1_5s: sig.length, totalStuckSeconds: Math.round(events.reduce((a, e) => a + e.dur, 0)),
      byCause: byKey(sig, e => e.cause), byKind: byKey(sig, e => e.kind), longest: Math.round(Math.max(0, ...events.map(e => e.dur)) * 10) / 10,
      hotspots: Object.entries(hot).sort((a, b) => b[1] - a[1]).slice(0, 10) },
    errors
  };
  fs.writeFileSync(out + '-events.json', JSON.stringify(events.filter(e=>e.dur>=1.5), null, 0)); fs.writeFileSync(out + '-report.json', JSON.stringify(rep, null, 1));
  console.log(JSON.stringify(rep, null, 1));
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
