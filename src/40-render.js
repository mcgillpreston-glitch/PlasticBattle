/* Browser only: terrain, units, effects, post-processing, minimap. */

/* ---------------- Rendering ---------------- */
var cv = document.getElementById('game'), ctx = cv.getContext('2d');
var mini = document.getElementById('miniCv'), mctx = mini.getContext('2d');
var DPR = 1, VW = 0, VH = 0, terrain = null, grainCv = null, blendOK = { saturation: false, overlay: false };
function resize() {
  DPR = Math.min(1.5, window.devicePixelRatio || 1);
  VW = cv.clientWidth; VH = cv.clientHeight;
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  cam.zBase = clamp(Math.min(VW / 1500, VH / 900) * 1.1, 0.45, 1.25);
  if (!cam.zSet) cam.z = cam.zBase;
}
window.addEventListener('resize', resize);
function s2w(x, y) { return { x: (x - VW / 2) / cam.z + cam.x, y: (y - VH / 2) / cam.z + cam.y }; }
function ell(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); }
function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath(); }
function laneSkew(c, x, y) { c.transform(Math.cos(LANG), Math.sin(LANG), 0, 1, x, y); }

function checkBlend() {
  var t = document.createElement('canvas').getContext('2d');
  ['saturation', 'overlay'].forEach(function (m) { t.globalCompositeOperation = m; blendOK[m] = t.globalCompositeOperation === m; });
}
function makeGrain() {
  grainCv = document.createElement('canvas'); grainCv.width = 192; grainCv.height = 192;
  var c = grainCv.getContext('2d'), img = c.createImageData(192, 192), d = img.data;
  for (var i = 0; i < d.length; i += 4) { var v = 100 + Math.random() * 110; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  c.putImageData(img, 0, 0);
}
var TERR = { ox: -700, oy: -700, w: MAP.W + 1400, h: MAP.H + 1400, s: 0.7 };
function buildTerrain() {
  var T = document.createElement('canvas'); T.width = Math.round(TERR.w * TERR.s); T.height = Math.round(TERR.h * TERR.s);
  var c = T.getContext('2d'), R = seeded(11);
  c.scale(TERR.s, TERR.s); c.translate(-TERR.ox, -TERR.oy);
  c.fillStyle = '#3E4929'; c.fillRect(TERR.ox, TERR.oy, TERR.w, TERR.h);
  for (var i = 0; i < 2600; i++) { var gx = TERR.ox + R() * TERR.w, gy = TERR.oy + R() * TERR.h, gr = 8 + R() * 36; c.fillStyle = i % 2 ? 'rgba(96,118,58,0.16)' : 'rgba(26,34,16,0.22)'; ell(c, gx, gy, gr, gr * 0.5); c.fill(); }
  c.save(); c.translate(LCX, LCY); c.rotate(LANG);
  var L0 = -LLEN / 2 - 520, L1 = LLEN / 2 + 520, H = MAP.half, s, x, y;
  // trees beyond the hedges
  for (s = -1; s <= 1; s += 2) for (x = L0; x < L1; x += 120 + R() * 90) {
    y = s * (370 + R() * 90); var tr = 40 + R() * 36;
    c.fillStyle = '#2A2016'; c.fillRect(x - 5, y - 10, 10, 30);
    c.fillStyle = '#28371B'; ell(c, x, y - 20, tr, tr * 0.8); c.fill();
    c.fillStyle = '#334622'; ell(c, x - tr * 0.25, y - 28, tr * 0.6, tr * 0.45); c.fill();
  }
  // hedgerow bands
  for (s = -1; s <= 1; s += 2) {
    c.fillStyle = '#263418'; c.fillRect(L0, s > 0 ? H : -H - 110, L1 - L0, 110);
    for (x = L0; x < L1; x += 40) {
      var rx = 28 + R() * 16, ry = 22 + R() * 12; y = s * (H + 28 + R() * 48);
      c.fillStyle = R() < 0.5 ? '#33461F' : '#3B5224'; ell(c, x, y, rx, ry); c.fill();
      c.fillStyle = 'rgba(120,150,80,0.22)'; ell(c, x - rx * 0.3, y - ry * 0.35, rx * 0.5, ry * 0.4); c.fill();
    }
    var sh = c.createLinearGradient(0, s * H, 0, s * (H - 80));
    sh.addColorStop(0, 'rgba(10,14,6,0.45)'); sh.addColorStop(1, 'rgba(10,14,6,0)');
    c.fillStyle = sh; c.fillRect(L0, s > 0 ? H - 80 : -H, L1 - L0, 80);
  }
  // road
  c.fillStyle = '#6A563A'; c.fillRect(L0, -H, L1 - L0, 2 * H);
  for (i = 0; i < 3000; i++) { x = L0 + R() * (L1 - L0); y = -H + R() * 2 * H; var sr = 2 + R() * 9; c.fillStyle = i % 3 ? 'rgba(40,30,18,0.22)' : 'rgba(150,130,92,0.16)'; ell(c, x, y, sr, sr * 0.6); c.fill(); }
  c.fillStyle = 'rgba(130,112,78,0.18)'; c.fillRect(L0, -34, L1 - L0, 68);
  c.strokeStyle = 'rgba(58,44,26,0.8)'; c.lineWidth = 14; c.lineCap = 'round';
  [-56, 56].forEach(function (ry) { c.beginPath(); for (x = L0; x <= L1; x += 60) { var yy = ry + Math.sin(x * 0.013) * 9; if (x === L0) c.moveTo(x, yy); else c.lineTo(x, yy); } c.stroke(); });
  c.strokeStyle = 'rgba(90,72,46,0.5)'; c.lineWidth = 3;
  [-70, -42, 42, 70].forEach(function (ry) { c.beginPath(); for (x = L0; x <= L1; x += 60) { var yy = ry + Math.sin(x * 0.013) * 9; if (x === L0) c.moveTo(x, yy); else c.lineTo(x, yy); } c.stroke(); });
  // puddles and craters (cosmetic)
  [[0.15, -92], [0.32, 70], [0.47, -150], [0.56, 150], [0.72, -60], [0.86, 95]].forEach(function (p) {
    x = (p[0] - 0.5) * LLEN; y = p[1];
    c.fillStyle = 'rgba(80,86,88,0.85)'; ell(c, x, y, 46, 17); c.fill();
    c.fillStyle = 'rgba(190,196,196,0.22)'; ell(c, x - 12, y - 5, 18, 5); c.fill();
  });
  [[0.19, 120], [0.81, -120], [0.44, -30], [0.63, 40]].forEach(function (p) {
    x = (p[0] - 0.5) * LLEN; y = p[1];
    c.strokeStyle = '#4A3A24'; c.lineWidth = 12; ell(c, x, y, 54, 26); c.stroke();
    c.fillStyle = '#3A2D1C'; ell(c, x, y, 46, 20); c.fill();
    c.fillStyle = 'rgba(110,92,60,0.5)'; ell(c, x + 10, y - 30, 40, 8); c.fill();
  });
  // fence posts along hedge inner edge
  for (s = -1; s <= 1; s += 2) {
    c.strokeStyle = 'rgba(40,40,36,0.7)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(L0, s * (H + 4) - 14); c.lineTo(L1, s * (H + 4) - 14); c.stroke();
    for (x = L0 + 40; x < L1; x += 170) { c.fillStyle = '#3B2E1B'; c.fillRect(x - 4, s * (H + 4) - 26, 8, 28); }
  }
  // base lines: sandbag row with a gap, and a trench
  [-1, 1].forEach(function (side) {
    var bx = side * (0.5 - 0.075) * LLEN;
    c.fillStyle = 'rgba(30,24,14,0.5)'; c.fillRect(bx - 6, -H, 12, 2 * H);
    for (y = -H + 14; y < H - 10; y += 24) { if (Math.abs(y) < 60) continue; c.fillStyle = '#A99763'; ell(c, bx, y, 15, 9); c.fill(); c.strokeStyle = '#5E5236'; c.lineWidth = 1.5; c.stroke(); }
  });
  c.restore();
  // brush thickets are drawn live (they fade when you stand in them)
  return T;
}

function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#3E4929'; ctx.fillRect(0, 0, VW, VH);
  if (!G) return;
  ctx.save();
  var shx = G.shake > 0 ? (Math.random() - 0.5) * G.shake * 2 : 0, shy = G.shake > 0 ? (Math.random() - 0.5) * G.shake * 2 : 0;
  ctx.translate(VW / 2 + shx, VH / 2 + shy); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(terrain, TERR.ox, TERR.oy, TERR.w, TERR.h);
  [0, 1].forEach(function (t) { var fp = fountain(t); ctx.fillStyle = t === 0 ? 'rgba(94,138,44,0.14)' : 'rgba(201,166,107,0.16)'; ell(ctx, fp.x, fp.y, 330, 330); ctx.fill(); });
  G.fx.forEach(function (f) { if (f.k === 'scorch' || f.k === 'glow' || f.k === 'castring') drawFx(f); });
  G.crates.forEach(function (c) { if (c.up) drawCrate(c.x, c.y); else { ctx.strokeStyle = 'rgba(20,19,15,0.4)'; ctx.setLineDash([4, 4]); ctx.strokeRect(c.x - 16, c.y - 16, 32, 32); ctx.setLineDash([]); } });
  G.mines.forEach(function (m) { if (m.team !== MYTEAM && m.arm <= 0 && dist(m, G.player) > 200) return; ctx.fillStyle = m.arm > 0 ? '#6B6B60' : '#3A3A30'; ell(ctx, m.x, m.y, 16, 8); ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#B4432E'; ell(ctx, m.x, m.y - 3, 3, 3); ctx.fill(); });
  G.lobs.forEach(function (l) { if (l.single) return; var p = Math.min(1, l.t / l.delay); ctx.strokeStyle = l.team === 0 ? 'rgba(157,180,100,0.8)' : 'rgba(224,112,63,0.85)'; ctx.lineWidth = 3; ell(ctx, l.x, l.y, l.r, l.r * 0.6); ctx.stroke(); ctx.fillStyle = l.team === 0 ? 'rgba(157,180,100,0.18)' : 'rgba(224,112,63,0.2)'; ell(ctx, l.x, l.y, l.r * p, l.r * 0.6 * p); ctx.fill(); });
  if (opts.ranges) {
    G.structs.forEach(function (s) { if (s.dead || s.kind === 'depot') return; ctx.strokeStyle = 'rgba(224,112,63,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ell(ctx, s.x, s.y, s.range, s.range); ctx.stroke(); ctx.setLineDash([]); });
    G.units.forEach(function (u) { if (u.kind !== 'hero' || u.dead) return; ctx.strokeStyle = u.team === 0 ? 'rgba(157,180,100,0.5)' : 'rgba(224,200,144,0.5)'; ctx.lineWidth = 2; ell(ctx, u.x, u.y, aaRange(u), aaRange(u)); ctx.stroke(); });
  } else if (G.player && !G.player.dead) {
    G.structs.forEach(function (s) { if (s.dead || s.team === MYTEAM || s.kind === 'depot') return; var d = dist(s, G.player); if (d < s.range + 160) { ctx.strokeStyle = 'rgba(224,112,63,' + clamp((s.range + 160 - d) / 160, 0, 0.8) + ')'; ctx.lineWidth = 3; ctx.setLineDash([12, 8]); ell(ctx, s.x, s.y, s.range, s.range); ctx.stroke(); ctx.setLineDash([]); } });
  }
  if (opts.col) {
    ctx.lineCap = 'round';
    G.blockers.forEach(function (b) {
      ctx.strokeStyle = 'rgba(255,90,60,0.35)'; ctx.fillStyle = 'rgba(255,90,60,0.35)';
      if (b.ax != null) { ctx.lineWidth = b.r * 2; ctx.beginPath(); ctx.moveTo(b.ax, b.ay); ctx.lineTo(b.bx, b.by); ctx.stroke(); }
      else { ell(ctx, b.x, b.y, b.r, b.r); ctx.fill(); }
    });
    ctx.lineCap = 'butt';
    G.units.forEach(function (u) {
      if (u.dead || !u.path || !u.path.length) return;
      ctx.strokeStyle = u.team === 0 ? 'rgba(200,240,140,0.9)' : 'rgba(255,220,150,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(u.x, u.y); u.path.forEach(function (p) { ctx.lineTo(p.x, p.y); }); ctx.stroke(); ctx.setLineDash([]);
    });
  }
  if (G.moveMark) { var mm = G.moveMark, ma = Math.min(1, mm.t / 0.3); ctx.strokeStyle = 'rgba(214,203,170,' + ma + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(mm.x - 10, mm.y - 6); ctx.lineTo(mm.x + 10, mm.y + 6); ctx.moveTo(mm.x + 10, mm.y - 6); ctx.lineTo(mm.x - 10, mm.y + 6); ctx.stroke(); ell(ctx, mm.x, mm.y, 18, 9); ctx.stroke(); }
  if (aimSlot && G.player && !G.player.dead) drawAim(G.player, aimSlot);
  if (G.player && !G.player.dead && G.player.target) drawAttackArc(G.player);
  drawAimLines();
  var items = [];
  G.structs.forEach(function (s) { items.push({ y: s.y, f: function () { drawStruct(s); } }); });
  PROPS.forEach(function (p) { items.push({ y: p.y, f: function () { drawProp(p); } }); });
  G.units.forEach(function (u) { if (u.dead && u.deathT > 1.4) return; if (!u.dead && !visibleTo(u, MYTEAM)) return; items.push({ y: u.y, f: function () { drawUnit(u); } }); });
  items.sort(function (a, b) { return a.y - b.y; });
  items.forEach(function (it) { it.f(); });
  BRUSH.forEach(function (b, i) { drawThicket(b, i); });
  G.proj.forEach(function (p) {
    var pa = Math.atan2(p.vy, p.vx);
    if (p.kind === 'rocket') {
      if (Math.random() < 0.6) addFx({ k: 'smoke', x: p.x, y: p.y, t: 0, dur: 0.5 });
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(pa);
      var fl = ctx.createRadialGradient(-22, 0, 1, -22, 0, 26); fl.addColorStop(0, 'rgba(255,230,150,0.95)'); fl.addColorStop(1, 'rgba(255,140,40,0)'); ctx.fillStyle = fl; ell(ctx, -26, 0, 26, 12); ctx.fill();
      ctx.fillStyle = '#3F4A2A'; ctx.fillRect(-16, -6, 32, 12); ctx.fillStyle = '#596640'; ctx.beginPath(); ctx.moveTo(16, -6); ctx.lineTo(26, 0); ctx.lineTo(16, 6); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (p.kind === 'jack') { streak(p.x, p.y, pa, 44, 4, '#E0703F', 'rgba(224,112,63,0)'); }
    else { var big = p.kind === 'shot'; streak(p.x, p.y, pa, big ? 70 : 40, big ? 5 : 3, p.team === 0 ? '#F4FFD0' : '#FFE6B0', p.team === 0 ? 'rgba(169,196,110,0)' : 'rgba(224,160,80,0)'); if (big) { ctx.fillStyle = '#FFFFFF'; ell(ctx, p.x, p.y, 4, 4); ctx.fill(); } }
  });
  G.rounds.forEach(function (r) {
    var a = Math.atan2(r.ly - r.y, r.lx - r.x), heavy = r.heavy;
    streak(r.x, r.y, a, heavy ? 56 : r.hero ? 46 : 30, heavy ? 5 : r.hero ? 3.5 : 2.2, heavy ? '#FFD08A' : r.team === 0 ? '#F4FFD0' : '#FFE6B0', heavy ? 'rgba(255,150,60,0)' : r.team === 0 ? 'rgba(169,196,110,0)' : 'rgba(224,160,80,0)');
    if (heavy || r.hero) { ctx.fillStyle = '#FFFFFF'; ell(ctx, r.x, r.y, heavy ? 4 : 2.5, heavy ? 4 : 2.5); ctx.fill(); }
  });
  G.lobs.forEach(function (l) {
    var p = Math.min(1, l.t / l.delay), gx = l.sx + (l.x - l.sx) * p, gy = (l.sy + 50) + (l.y - l.sy - 50) * p, x = l.sx + (l.x - l.sx) * p, y = l.sy + (l.y - l.sy) * p - Math.sin(p * Math.PI) * 220;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ell(ctx, gx, gy, 10 + 6 * p, 4 + 2 * p); ctx.fill();
    ctx.fillStyle = '#2E3320'; ell(ctx, x, y, l.single ? 7 : 10, l.single ? 7 : 10); ctx.fill(); ctx.strokeStyle = '#F2EBD6'; ctx.lineWidth = 1.5; ctx.stroke();
  });
  if (G.barrage) G.barrage.beams.forEach(function (b) { if (b.x == null) return; ctx.strokeStyle = 'rgba(180,67,46,0.8)'; ctx.lineWidth = 4; ctx.setLineDash([14, 10]); ell(ctx, b.x, b.y, G.barrage.r, G.barrage.r * 0.65); ctx.stroke(); ctx.setLineDash([]); });
  G.fx.forEach(function (f) { if (f.k !== 'scorch' && f.k !== 'glow' && f.k !== 'castring' && f.k !== 'callout') drawFx(f); });
  G.structs.forEach(function (s) { if (!s.dead) bar(s.x, s.y - (s.kind === 'hq' ? 178 : s.kind === 'depot' ? 100 : 116), s.kind === 'hq' ? 150 : 110, 9, s.hp / s.maxHp, s.team, targetable(s) ? null : 'locked'); });
  G.units.forEach(function (u) {
    if (u.dead || !visibleTo(u, MYTEAM)) return;
    var hh = unitH(u);
    if (u.kind === 'hero') {
      bar(u.x, u.y - hh - 16, 84, 8, u.hp / maxHp(u), u.team, null, u.shield / maxHp(u), u.lvl);
      ctx.font = '500 13px Oswald, Arial Narrow, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#EDE6D2'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      var nm = (u.isPlayer ? 'YOU · ' : '') + u.name.toUpperCase(); ctx.strokeText(nm, u.x, u.y - hh - 23); ctx.fillText(nm, u.x, u.y - hh - 23);
    } else bar(u.x, u.y - hh - 10, 40, 4, u.hp / u.maxHp, u.team);
  });
  if (G.player && !G.player.dead) {
    if (G.player.target) drawBracket(G.player.target, '#D9532F', 3, true);
    if (hoverT && hoverT !== G.player.target && !hoverT.dead) drawBracket(hoverT, 'rgba(214,203,170,0.8)', 2, false);
  }
  G.fx.forEach(function (f) { if (f.k === 'callout') drawFx(f); });
  G.texts.forEach(function (t) { ctx.globalAlpha = 1 - t.t / 0.9; ctx.font = '600 20px Oswald, Arial Narrow, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(t.txt, t.x, t.y); ctx.fillStyle = t.color; ctx.fillText(t.txt, t.x, t.y); ctx.globalAlpha = 1; });
  ctx.restore();
  postProcess();
  drawMini();
}
function postProcess() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (blendOK.saturation) { ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = 'rgba(128,128,128,0.32)'; ctx.fillRect(0, 0, VW, VH); }
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#E3DCC4'; ctx.fillRect(0, 0, VW, VH);
  ctx.globalCompositeOperation = blendOK.overlay ? 'overlay' : 'source-over';
  ctx.globalAlpha = blendOK.overlay ? 0.14 : 0.05;
  var ox = -Math.floor(Math.random() * 192), oy = -Math.floor(Math.random() * 192);
  ctx.save(); ctx.translate(ox, oy); var gp = ctx.createPattern(grainCv, 'repeat'); ctx.fillStyle = gp; ctx.fillRect(-ox, -oy, VW + 192, VH + 192); ctx.restore();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  var vg = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.35, VW / 2, VH / 2, Math.max(VW, VH) * 0.75);
  vg.addColorStop(0, 'rgba(12,12,8,0)'); vg.addColorStop(1, 'rgba(12,12,8,0.62)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  if (G.hurtT > 0) { var hg = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.3, VW / 2, VH / 2, Math.max(VW, VH) * 0.7); hg.addColorStop(0, 'rgba(150,30,20,0)'); hg.addColorStop(1, 'rgba(150,30,20,' + clamp(G.hurtT, 0, 0.6) + ')'); ctx.fillStyle = hg; ctx.fillRect(0, 0, VW, VH); }
}
function bar(x, y, w, h, frac, team, locked, sh, lvl) {
  frac = clamp(frac, 0, 1);
  ctx.fillStyle = 'rgba(12,12,8,0.85)'; ctx.fillRect(x - w / 2 - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = TEAMC[team].bar; ctx.fillRect(x - w / 2, y, w * frac, h);
  if (sh > 0) { ctx.fillStyle = 'rgba(214,203,170,0.75)'; ctx.fillRect(x - w / 2 + w * frac, y, Math.min(w * (1 - frac), w * sh), h); }
  if (locked) { ctx.fillStyle = 'rgba(12,12,8,0.5)'; ctx.fillRect(x - w / 2, y, w, h); }
  if (lvl) { ctx.fillStyle = '#E0C890'; ctx.fillRect(x - w / 2 - 22, y - 4, 18, h + 8); ctx.fillStyle = '#14130F'; ctx.font = '600 12px Oswald, Arial Narrow, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(lvl, x - w / 2 - 13, y + h + 1); }
}
function drawBracket(t, color, lw, spin) {
  var w, h, cx = t.x, cy;
  if (t.isStruct) { w = t.r * 2.2; h = t.kind === 'hq' ? 200 : 100; cy = t.y - h / 2 + 10; }
  else { h = unitH(t); w = t.kind === 'hero' ? 64 : 44; cy = t.y - h / 2; }
  var g = 10, ex = w / 2 + 6, ey = h / 2 + 6;
  ctx.save(); ctx.translate(cx, cy);
  if (spin) { var p = 1 + 0.06 * Math.sin(G.time * 10); ctx.scale(p, p); }
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'square';
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (s) { ctx.beginPath(); ctx.moveTo(s[0] * ex, s[1] * (ey - g)); ctx.lineTo(s[0] * ex, s[1] * ey); ctx.lineTo(s[0] * (ex - g), s[1] * ey); ctx.stroke(); });
  ctx.restore();
}
function drawAttackArc(u) {
  if (u.aaT == null) return;
  var p = 1 - clamp(u.aaT / aaCd(u), 0, 1);
  ctx.strokeStyle = 'rgba(214,203,170,0.85)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(u.x, u.y + 2, 34, 13, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); ctx.stroke();
}
function drawCrate(x, y) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ell(ctx, x, y + 12, 24, 8); ctx.fill();
  ctx.fillStyle = '#7E7148'; ctx.fillRect(x - 18, y - 22, 36, 32); ctx.fillStyle = '#9A8B5A'; ctx.fillRect(x - 18, y - 28, 36, 8);
  ctx.strokeStyle = '#3A3220'; ctx.lineWidth = 2; ctx.strokeRect(x - 18, y - 28, 36, 38); ctx.beginPath(); ctx.moveTo(x - 18, y - 22); ctx.lineTo(x + 18, y - 22); ctx.stroke();
  ctx.fillStyle = '#E8E0C6'; ctx.font = '400 11px Black Ops One, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('MED', x, y - 2);
}
function drawProp(p) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ell(ctx, p.x + 8, p.y + 6, p.r + 8, p.r * 0.45); ctx.fill();
  if (p.kind === 'wall') {
    var L = p.len; ctx.save(); laneSkew(ctx, p.x, p.y);
    ctx.fillStyle = '#6E6A5E'; ctx.fillRect(-L / 2, -38, L, 38);
    var R = seeded(p.t * 1000);
    for (var i = 0; i < 16; i++) { var sx = -L / 2 + R() * (L - 24), sy = -36 + R() * 24; ctx.fillStyle = R() < 0.5 ? '#8A857A' : '#7B766A'; rrect(ctx, sx, sy, 18 + R() * 14, 9 + R() * 6, 3); ctx.fill(); }
    ctx.fillStyle = '#A09C8F'; ctx.fillRect(-L / 2, -46, L, 9);
    ctx.strokeStyle = '#2A2822'; ctx.lineWidth = 2; ctx.strokeRect(-L / 2, -46, L, 46);
    ctx.restore();
  } else if (p.kind === 'jeep') {
    ctx.save(); laneSkew(ctx, p.x, p.y);
    ctx.fillStyle = '#222'; [-32, 30].forEach(function (x) { ell(ctx, x, -8, 14, 12); ctx.fill(); ctx.fillStyle = '#3A3A36'; ell(ctx, x, -8, 7, 6); ctx.fill(); ctx.fillStyle = '#222'; });
    ctx.fillStyle = '#3F3B30'; ctx.fillRect(-52, -46, 104, 34); ctx.strokeStyle = '#1C1A14'; ctx.lineWidth = 2; ctx.strokeRect(-52, -46, 104, 34);
    ctx.fillStyle = '#2E2B22'; ctx.fillRect(-20, -62, 42, 16); ctx.fillRect(28, -58, 24, 12);
    ctx.fillStyle = '#4A4538'; ctx.fillRect(-48, -52, 30, 8);
    ctx.fillStyle = '#1C1A14'; ell(ctx, 10, -40, 14, 6); ctx.fill();
    ctx.restore();
    if (Math.random() < 0.08) addFx({ k: 'smoke', x: p.x + rnd(-10, 10), y: p.y - 50, t: 0, dur: 1.6, big: 1 });
  } else if (p.kind === 'cart') {
    ctx.save(); laneSkew(ctx, p.x, p.y); ctx.rotate(-0.12);
    ctx.fillStyle = '#5F4628'; ctx.fillRect(-42, -34, 84, 26); ctx.strokeStyle = '#2A1E10'; ctx.lineWidth = 2; ctx.strokeRect(-42, -34, 84, 26);
    for (var k = -34; k < 40; k += 14) { ctx.beginPath(); ctx.moveTo(k, -34); ctx.lineTo(k, -8); ctx.stroke(); }
    ctx.strokeStyle = '#3A2C18'; ctx.lineWidth = 6; ell(ctx, 26, -6, 18, 18); ctx.stroke(); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(8, -6); ctx.lineTo(44, -6); ctx.moveTo(26, -24); ctx.lineTo(26, 12); ctx.stroke();
    ctx.fillStyle = '#5F4628'; ctx.fillRect(-60, -16, 24, 6);
    ctx.restore();
  } else {
    ctx.fillStyle = '#4A3A26'; ctx.beginPath(); ctx.moveTo(-26 + p.x, p.y); ctx.lineTo(-18 + p.x, p.y - 44); ctx.lineTo(-4 + p.x, p.y - 60); ctx.lineTo(6 + p.x, p.y - 40); ctx.lineTo(16 + p.x, p.y - 50); ctx.lineTo(22 + p.x, p.y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2A2014'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#3A2D1C'; ell(ctx, p.x, p.y, 30, 12); ctx.fill();
    ctx.strokeStyle = '#4A3A26'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(p.x - 20, p.y + 2); ctx.lineTo(p.x - 40, p.y + 10); ctx.moveTo(p.x + 18, p.y + 4); ctx.lineTo(p.x + 38, p.y + 12); ctx.stroke();
  }
  ctx.restore();
}
function drawThicket(b, i) {
  var inside = G.player && !G.player.dead && inBrush(G.player) === i;
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(LANG); ctx.globalAlpha = inside ? 0.45 : 0.95;
  var R = seeded(31 + i);
  for (var k = 0; k < 9; k++) { var x = (R() - 0.5) * b.rx * 1.5, y = (R() - 0.5) * b.ry * 1.4, rx = 34 + R() * 26, ry = 22 + R() * 16; ctx.fillStyle = R() < 0.5 ? '#36491F' : '#3F5626'; ell(ctx, x, y, rx, ry); ctx.fill(); ctx.fillStyle = 'rgba(130,160,90,0.2)'; ell(ctx, x - rx * 0.3, y - ry * 0.35, rx * 0.5, ry * 0.4); ctx.fill(); }
  ctx.restore();
}
function sandbag(x, y, rot, dead) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = dead ? '#7D7560' : '#A99763'; ell(ctx, 0, 0, 15, 9); ctx.fill(); ctx.strokeStyle = '#4C4330'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.stroke(); ctx.restore(); }
function drawStruct(s) {
  ctx.save(); ctx.translate(s.x, s.y);
  var C = TEAMC[s.team], dead = s.dead, rec = s.recoilT > 0 ? s.recoilT * 20 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ell(ctx, 6, 8, s.r + 24, (s.r + 24) * 0.42); ctx.fill();
  if (s.kind === 'outpost') {
    var R = seeded(s.id * 7);
    function ring(front) { for (var i = 0; i < 14; i++) { var a = i / 14 * Math.PI * 2, x = Math.cos(a) * 54, y = Math.sin(a) * 28 - 6; if ((Math.sin(a) > 0) !== front) continue; if (dead) { x += (R() - 0.5) * 50; y += (R() - 0.5) * 30; } sandbag(x, y, a + Math.PI / 2 + (dead ? R() : 0), dead); } }
    ring(false);
    if (!dead) { var sp = sprite('gunner', s.team, 74, s.team === 1); ctx.drawImage(sp.cv, -sp.w / 2 - (s.team === 1 ? -rec : rec), -sp.h * 0.94 + 2, sp.w, sp.h); ctx.fillStyle = '#4A3A26'; ctx.fillRect(-70, -30, 6, 34); ctx.fillRect(64, -30, 6, 34); ctx.fillStyle = '#5B4A2C'; ctx.fillRect(-20, -36, 22, 14); }
    ring(true);
    if (s.flashT > 0 && !dead) { ctx.globalAlpha = s.flashT / 0.08 * 0.6; ctx.fillStyle = '#fff'; ell(ctx, 0, -20, 60, 34); ctx.fill(); ctx.globalAlpha = 1; }
  } else if (s.kind === 'depot') {
    if (dead) { ctx.fillStyle = '#3A3528'; ctx.beginPath(); ctx.moveTo(-50, 4); ctx.lineTo(-20, -18); ctx.lineTo(30, -10); ctx.lineTo(54, 6); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#2A2419'; ctx.fillRect(-60, -14, 22, 16); }
    else {
      ctx.fillStyle = '#4C5530'; ctx.beginPath(); ctx.moveTo(-56, 0); ctx.lineTo(0, -74); ctx.lineTo(56, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5F6A3A'; ctx.beginPath(); ctx.moveTo(-56, 0); ctx.lineTo(0, -74); ctx.lineTo(8, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#23281A'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-56, 0); ctx.lineTo(0, -74); ctx.lineTo(56, 0); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = '#1C1A14'; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(0, -34); ctx.lineTo(14, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7E7148'; ctx.fillRect(-82, -22, 22, 22); ctx.fillRect(62, -20, 20, 20); ctx.strokeStyle = '#3A3220'; ctx.strokeRect(-82, -22, 22, 22); ctx.strokeRect(62, -20, 20, 20);
      ctx.fillStyle = C.c1; ctx.font = '400 11px Black Ops One, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SUPPLY', -30, -8);
    }
  } else if (s.team === 0) {
    if (dead) ctx.rotate(0.12);
    ctx.fillStyle = dead ? '#4A4234' : '#5C4A32'; ctx.fillRect(-110, -104, 220, 104);
    for (var y = -100; y < -8; y += 16) { ctx.fillStyle = dead ? '#3E3628' : '#4A3824'; ctx.fillRect(-110, y, 220, 7); ctx.fillStyle = dead ? '#55493A' : '#6E5538'; ctx.fillRect(-110, y + 7, 220, 9); }
    ctx.strokeStyle = '#1C1A14'; ctx.lineWidth = 3; ctx.strokeRect(-110, -104, 220, 104);
    ctx.fillStyle = '#4F4430'; ell(ctx, 0, -108, 118, 22); ctx.fill();
    for (var bx = -104; bx <= 104; bx += 23) sandbag(bx, -124, 0, dead);
    ctx.fillStyle = '#0F0E0A'; ctx.fillRect(-20, -52, 40, 52);
    ctx.strokeStyle = '#2B2B2B'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(72, -118); ctx.lineTo(80, -200); ctx.stroke(); ctx.beginPath(); ctx.moveTo(74, -180); ctx.lineTo(92, -186); ctx.stroke();
    ctx.fillStyle = '#C9BD9B'; ctx.font = '400 26px Black Ops One, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('CP', -62, -40);
    if (s.flashT > 0 && !dead) { ctx.globalAlpha = s.flashT / 0.08 * 0.5; ctx.fillStyle = '#fff'; ctx.fillRect(-110, -104, 220, 104); ctx.globalAlpha = 1; }
  } else {
    if (dead) ctx.rotate(-0.1);
    ctx.fillStyle = dead ? '#5C5A52' : '#7E7C72'; ctx.fillRect(-90, -124, 180, 124);
    ctx.fillStyle = dead ? '#6E6C64' : '#9C9A90'; ctx.beginPath(); ctx.moveTo(-90, -124); ctx.lineTo(-68, -156); ctx.lineTo(68, -156); ctx.lineTo(90, -124); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#1C1A14'; ctx.lineWidth = 3; ctx.strokeRect(-90, -124, 180, 124);
    ctx.fillStyle = '#12110D'; ctx.fillRect(-64, -104, 128, 14);
    ctx.fillStyle = 'rgba(40,36,28,0.45)'; ctx.fillRect(-78, -86, 10, 80); ctx.fillRect(30, -80, 14, 76); ctx.fillRect(-30, -60, 8, 56);
    if (dead) { ctx.strokeStyle = '#2A2822'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-40, -124); ctx.lineTo(-10, -70); ctx.lineTo(-30, -20); ctx.stroke(); }
    ctx.fillStyle = '#2E2C25'; ctx.font = '400 24px Black Ops One, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('HQ', 0, -34);
    if (s.flashT > 0 && !dead) { ctx.globalAlpha = s.flashT / 0.08 * 0.5; ctx.fillStyle = '#fff'; ctx.fillRect(-90, -156, 180, 156); ctx.globalAlpha = 1; }
  }
  ctx.restore();
}
function drawUnit(u) {
  var alpha = 1;
  if (u.team === MYTEAM && (isGhost(u) || inBrush(u) >= 0)) alpha = 0.55;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.translate(u.x, u.y);
  var h = unitH(u), veh = u.type === 'tank' || u.type === 'jeep';
  if (u.dead) {
    var fallT = u.kind === 'hero' ? 0.5 : 0.4, p = Math.min(1, u.deathT / fallT);
    if (u.deathT > 0.8) ctx.globalAlpha = alpha * Math.max(0, 1 - (u.deathT - 0.8) / 0.6);
    if (!veh) { var e = 1 - (1 - p) * (1 - p); ctx.rotate(u.facing * e * Math.PI * 0.48); }
  } else {
    if (u.dash && u.dash.leap) { var lp = Math.sin(Math.min(1, u.dash.t / u.dash.dur) * Math.PI); ctx.translate(0, -lp * (u.dash.dur > 0.6 ? 160 : 70)); }
    if (u.movedT > 0 && !veh) { var ph = u.walk / 15; ctx.rotate(Math.sin(ph) * 0.07); ctx.translate(0, -Math.abs(Math.sin(ph)) * 4); }
    if (u.recoilT > 0) ctx.translate(-u.facing * u.recoilT * 55, 0);
    if (u.lungeT > 0) ctx.translate(u.facing * 22 * Math.sin((1 - u.lungeT / 0.16) * Math.PI), 0);
    if (u.stagT > 0) ctx.rotate(u.stagDir * 0.16 * (u.stagT / 0.14));
    if (u.fireT > 0) { var fk = u.fireT / 0.14; ctx.scale(1 + 0.09 * fk, 1 - 0.08 * fk); }
    if (u.wind && !veh) { var wk = u.wind.t / u.wind.dur; ctx.rotate(u.facing * 0.05 * wk); }
  }
  if (u.isPlayer && !u.dead) { ctx.strokeStyle = 'rgba(214,203,170,0.9)'; ctx.lineWidth = 2.5; ctx.setLineDash([8, 6]); ell(ctx, 0, 2, 40, 14); ctx.stroke(); ctx.setLineDash([]); }
  if (u.kind === 'hero' && !u.dead && (u.wind || u.fireT > 0 || u.cone || u.chan)) {
    ctx.fillStyle = u.team === MYTEAM ? 'rgba(169,196,110,0.35)' : 'rgba(217,83,47,0.35)'; ell(ctx, 0, 2, 34, 12); ctx.fill();
  }
  if (veh) drawVehicle(u);
  else {
    var sp = sprite(u.pose, u.team, h, u.facing < 0);
    ctx.drawImage(sp.cv, -sp.w / 2, -h * 226 / 240, sp.w, h);
    if (u.flashT > 0 && !u.dead) { var fs = sprite(u.pose, u.team, h, u.facing < 0, true); ctx.globalAlpha = alpha * (u.flashT / 0.08) * 0.85; ctx.drawImage(fs.cv, -sp.w / 2, -h * 226 / 240, sp.w, h); ctx.globalAlpha = alpha; }
  }
  if (u.shield > 0 && !u.dead) { ctx.strokeStyle = 'rgba(214,203,170,0.7)'; ctx.lineWidth = 3; ell(ctx, 0, -h * 0.45, 40, h * 0.6); ctx.stroke(); }
  if (u.burnT > 0 && !u.dead && Math.random() < 0.4) addFx({ k: 'flame', x: u.x + rnd(-12, 12), y: u.y - rnd(10, 60), t: 0, dur: 0.3 });
  if (u.tagMark && !u.dead) { ctx.fillStyle = '#E0703F'; ell(ctx, 0, -h - 34, 5, 5); ctx.fill(); }
  ctx.restore();
  if (u.slowT > 0 && !u.dead) { ctx.fillStyle = 'rgba(120,170,230,0.45)'; ell(ctx, u.x, u.y + 2, 26, 9); ctx.fill(); }
}
function drawVehicle(u) {
  var C = TEAMC[u.team], f = u.facing;
  ctx.save(); ctx.scale(f, 1);
  if (u.dead) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; }
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ell(ctx, 0, 4, 40, 10); ctx.fill();
  var body = u.dead ? '#3A3A30' : C.c2, top = u.dead ? '#4A4A40' : C.c1;
  if (u.type === 'tank') {
    ctx.fillStyle = '#2B2E22'; ctx.fillRect(-36, -14, 72, 16);
    for (var i = -30; i <= 30; i += 12) { ctx.fillStyle = '#4A4E3C'; ell(ctx, i, -6, 5, 5); ctx.fill(); }
    ctx.fillStyle = body; ctx.strokeStyle = C.ol; ctx.lineWidth = 2; ctx.fillRect(-32, -32, 64, 20); ctx.strokeRect(-32, -32, 64, 20);
    ctx.fillStyle = top; ell(ctx, -2, -36, 18, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.c3; ctx.fillRect(10 - (u.recoilT > 0 ? u.recoilT * 30 : 0), -40, 36, 6);
    ctx.fillStyle = '#C9C2A8'; ctx.fillRect(-40, -30, 6, 6);
  } else {
    ctx.fillStyle = '#222'; [-20, 20].forEach(function (x) { ell(ctx, x, -6, 9, 9); ctx.fill(); });
    ctx.fillStyle = body; ctx.strokeStyle = C.ol; ctx.lineWidth = 2; ctx.fillRect(-32, -30, 64, 20); ctx.strokeRect(-32, -30, 64, 20);
    ctx.fillStyle = top; ctx.fillRect(-8, -44, 6, 16); ctx.fillRect(16, -36, 16, 8);
  }
  if (u.flashT > 0 && !u.dead) { ctx.globalAlpha = u.flashT / 0.08 * 0.6; ctx.fillStyle = '#fff'; ctx.fillRect(-36, -44, 72, 46); ctx.globalAlpha = 1; }
  if (u.dead && Math.random() < 0.3) addFx({ k: 'smoke', x: u.x + rnd(-10, 10), y: u.y - 30, t: 0, dur: 1.2, big: 1 });
  ctx.restore();
}
function streak(x, y, a, len, w, head, tail) {
  var tx = x - Math.cos(a) * len, ty = y - Math.sin(a) * len, g = ctx.createLinearGradient(tx, ty, x, y);
  g.addColorStop(0, tail); g.addColorStop(1, head);
  ctx.strokeStyle = g; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke(); ctx.lineCap = 'butt';
}
function drawAimLines() {
  G.units.forEach(function (u) {
    if (!u.wind || u.dead || u.kind !== 'hero' || !visibleTo(u, MYTEAM)) return;
    if (aaStyle(u) === 'melee') return;
    var t = u.wind.tgt; if (!t || t.dead) return;
    var k = clamp(u.wind.t / u.wind.dur, 0, 1), m = muzzle(u), ap = aimPoint(t);
    var col = u.isPlayer ? '242,235,214' : u.team === MYTEAM ? '169,196,110' : '230,90,55';
    ctx.strokeStyle = 'rgba(' + col + ',' + (0.2 + 0.65 * k) + ')'; ctx.lineWidth = u.isPlayer ? 2.2 : 1.6; ctx.setLineDash([10, 7]);
    ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + (ap.x - m.x) * k, m.y + (ap.y - m.y) * k); ctx.stroke(); ctx.setLineDash([]);
    if (u.isPlayer || t.isPlayer) { var rr = 28 - 16 * k; ctx.strokeStyle = 'rgba(' + col + ',' + (0.4 + 0.5 * k) + ')'; ctx.lineWidth = 2; ell(ctx, ap.x, ap.y, rr, rr); ctx.stroke(); }
  });
}
function drawFx(f) {
  var p = f.t / f.dur;
  if (f.k === 'impact') {
    var s = f.heavy ? 1.8 : 1; ctx.save(); ctx.translate(f.x, f.y); ctx.globalAlpha = 1 - p; ctx.strokeStyle = '#FFF4C8'; ctx.lineWidth = 2 * s;
    for (var i = 0; i < 6; i++) { var a = i * Math.PI / 3 + 0.3, r0 = 4 * s, r1 = (10 + 16 * p) * s; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke(); }
    ctx.fillStyle = '#FFFBE6'; ell(ctx, 0, 0, 7 * s * (1 - p) + 1, 7 * s * (1 - p) + 1); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1; return;
  }
  if (f.k === 'hitmark') { ctx.globalAlpha = 1 - p; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3; var gp = 8 + p * 5; [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (q) { ctx.beginPath(); ctx.moveTo(f.x + q[0] * gp, f.y + q[1] * gp); ctx.lineTo(f.x + q[0] * (gp + 9), f.y + q[1] * (gp + 9)); ctx.stroke(); }); ctx.globalAlpha = 1; return; }
  if (f.k === 'glow') { var gg = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r); gg.addColorStop(0, 'rgba(255,220,140,' + (0.5 * (1 - p)) + ')'); gg.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = gg; ell(ctx, f.x, f.y, f.r, f.r * 0.55); ctx.fill(); return; }
  if (f.k === 'puff') { ctx.globalAlpha = 0.45 * (1 - p); ctx.fillStyle = '#CFC8B4'; ell(ctx, f.x + p * 10, f.y - p * 26, 6 + p * 16, 5 + p * 11); ctx.fill(); ctx.globalAlpha = 1; return; }
  if (f.k === 'scorch') { ctx.globalAlpha = 0.4 * (1 - p); ctx.fillStyle = '#1C1710'; ell(ctx, f.x, f.y, f.r, f.r * 0.5); ctx.fill(); ctx.globalAlpha = 1; return; }
  if (f.k === 'castring') {
    ctx.globalAlpha = 1 - p; ctx.strokeStyle = f.c; ctx.lineWidth = f.ult ? 6 : 4; var R = (f.ult ? 96 : 58) * (0.4 + 0.6 * p);
    ell(ctx, f.x, f.y, R, R * 0.42); ctx.stroke(); if (f.ult) { ctx.lineWidth = 3; ell(ctx, f.x, f.y, R * 0.6, R * 0.25); ctx.stroke(); }
    ctx.globalAlpha = 1; return;
  }
  if (f.k === 'callout') {
    var cu = f.u; if (!cu) return;
    var hh = unitH(cu), cy = cu.y - hh - 46 - p * 14, al = p < 0.12 ? p / 0.12 : p > 0.75 ? (1 - p) / 0.25 : 1, sc = p < 0.12 ? 1.4 - p * 3.3 : 1;
    ctx.save(); ctx.translate(cu.x, cy); ctx.scale(sc, sc); ctx.globalAlpha = al;
    ctx.font = (f.ult ? '400 24px' : '400 17px') + " 'Black Ops One', Impact, sans-serif"; ctx.textAlign = 'center';
    var tw = ctx.measureText(f.txt).width + 18, th = f.ult ? 32 : 25;
    ctx.fillStyle = cu.team === 0 ? 'rgba(28,38,16,0.88)' : 'rgba(64,26,14,0.88)'; ctx.fillRect(-tw / 2, -th + 7, tw, th);
    ctx.fillStyle = cu.team === 0 ? '#9DB464' : '#E0703F'; ctx.fillRect(-tw / 2, -th + 7, 4, th);
    ctx.fillStyle = f.ult ? '#FFE29A' : '#F2EBD6'; ctx.fillText(f.txt, 2, 0);
    ctx.restore(); ctx.globalAlpha = 1; return;
  }
  if (f.k === 'tracer') { ctx.strokeStyle = f.c; ctx.globalAlpha = 1 - p; ctx.lineWidth = f.w; ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke(); ctx.globalAlpha = 1; }
  else if (f.k === 'muzzle') { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a); ctx.globalAlpha = 1 - p; var s = f.s * (1 + p * 0.6); var g = ctx.createRadialGradient(0, 0, 2, 0, 0, 60 * s); g.addColorStop(0, 'rgba(255,230,160,0.5)'); g.addColorStop(1, 'rgba(255,200,100,0)'); ctx.fillStyle = g; ell(ctx, 0, 0, 60 * s, 40 * s); ctx.fill(); ctx.fillStyle = '#FFF1C0'; ctx.beginPath(); ctx.moveTo(0, -5 * s); ctx.lineTo(26 * s, 0); ctx.lineTo(0, 5 * s); ctx.lineTo(8 * s, 0); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(4 * s, -11 * s); ctx.lineTo(14 * s, 0); ctx.lineTo(4 * s, 11 * s); ctx.closePath(); ctx.fill(); ctx.restore(); }
  else if (f.k === 'boom') { ctx.globalAlpha = 1 - p; ctx.fillStyle = '#3A3225'; ell(ctx, f.x, f.y - 10 - p * 30, f.r * (0.5 + 0.7 * p), f.r * 0.5 * (0.5 + 0.7 * p)); ctx.fill(); ctx.fillStyle = '#FFB347'; ell(ctx, f.x, f.y, f.r * (0.4 + 0.6 * p) * (1 - p * 0.5), f.r * 0.6 * (0.4 + 0.6 * p) * (1 - p * 0.5)); ctx.fill(); ctx.fillStyle = '#FFF0B8'; ell(ctx, f.x, f.y - 10, f.r * 0.4 * (1 - p), f.r * 0.25 * (1 - p)); ctx.fill(); ctx.globalAlpha = 1; }
  else if (f.k === 'ring') { ctx.globalAlpha = 1 - p; ctx.strokeStyle = f.c; ctx.lineWidth = 4; ell(ctx, f.x, f.y, f.r * (0.5 + 0.5 * p), f.r * 0.55 * (0.5 + 0.5 * p)); ctx.stroke(); ctx.globalAlpha = 1; }
  else if (f.k === 'chip') { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot + f.t * 10); ctx.globalAlpha = 1 - p; ctx.fillStyle = f.c; ctx.fillRect(-4, -2, 8, 4); ctx.restore(); ctx.globalAlpha = 1; }
  else if (f.k === 'spark') { ctx.globalAlpha = 1 - p; ctx.fillStyle = '#FFE9A8'; ell(ctx, f.x, f.y, 6 * (1 - p) + 2, 6 * (1 - p) + 2); ctx.fill(); ctx.globalAlpha = 1; }
  else if (f.k === 'cone') { ctx.globalAlpha = 0.5 * (1 - p); ctx.fillStyle = f.c; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.arc(f.x, f.y, f.r, f.a - f.ang / 2, f.a + f.ang / 2); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
  else if (f.k === 'flame') { ctx.globalAlpha = 1 - p; ctx.fillStyle = p < 0.5 ? '#FFB347' : '#E0703F'; ell(ctx, f.x, f.y - p * 30, 9 * (1 - p) + 3, 9 * (1 - p) + 3); ctx.fill(); ctx.globalAlpha = 1; }
  else if (f.k === 'smoke' || f.k === 'dust') { var big = f.big ? 2.2 : 1; ctx.globalAlpha = (f.k === 'smoke' ? 0.35 : 0.3) * (1 - p); ctx.fillStyle = f.k === 'smoke' ? '#3C3A33' : '#B3A077'; ell(ctx, f.x, f.y - (f.big ? p * 50 : 0), (8 + p * 14) * big, (8 + p * 14) * big * 0.8); ctx.fill(); ctx.globalAlpha = 1; }
  else if (f.k === 'smokecloud') { ctx.globalAlpha = 0.5 * (1 - p * p); ctx.fillStyle = '#8F8B7E'; ell(ctx, f.x, f.y - 20, f.r, f.r * 0.6); ctx.fill(); ctx.globalAlpha = 1; }
  else if (f.k === 'slash') {
    var base = f.dir > 0 ? Math.PI : 0, R2 = f.big ? 40 : 28, sweep = Math.min(1, p * 2.2);
    ctx.globalAlpha = 1 - p; ctx.strokeStyle = '#FFF6DA'; ctx.lineCap = 'round';
    ctx.lineWidth = f.big ? 7 : 4; ctx.beginPath(); ctx.arc(f.x, f.y, R2, base - 1.2 * f.dir, base - 1.2 * f.dir + 2.4 * f.dir * sweep, f.dir < 0); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,246,218,0.5)'; ctx.beginPath(); ctx.arc(f.x, f.y, R2 + 8, base - 1.0 * f.dir, base - 1.0 * f.dir + 2.0 * f.dir * sweep, f.dir < 0); ctx.stroke();
    ctx.lineCap = 'butt'; ctx.globalAlpha = 1;
  }
}
function drawAim(u, slot) {
  var ab = abilityOf(u, slot); if (!ab) return;
  var dx = mouse.wx - u.x, dy = mouse.wy - u.y, L = vlen(dx, dy) || 1;
  ctx.strokeStyle = 'rgba(214,203,170,0.85)'; ctx.fillStyle = 'rgba(214,203,170,0.15)'; ctx.lineWidth = 2;
  if (ab.t === 'proj' || ab.t === 'jack' || ab.t === 'chan') { var rr = ab.range; ctx.save(); ctx.translate(u.x, u.y); ctx.rotate(Math.atan2(dy, dx)); ctx.fillRect(0, -(ab.w || 16), rr, (ab.w || 16) * 2); ctx.strokeRect(0, -(ab.w || 16), rr, (ab.w || 16) * 2); ctx.restore(); }
  else if (ab.t === 'lob' || ab.t === 'leap' || ab.t === 'mine') { var d = Math.min(L, ab.range), x = u.x + dx / L * d, y = u.y + dy / L * d; ell(ctx, u.x, u.y, ab.range, ab.range); ctx.stroke(); ell(ctx, x, y, ab.r || 40, (ab.r || 40) * 0.6); ctx.fill(); ctx.stroke(); }
  else if (ab.t === 'nova') { ell(ctx, u.x, u.y, ab.r, ab.r * 0.6); ctx.fill(); ctx.stroke(); }
  else if (ab.t === 'cone') { var a = Math.atan2(dy, dx); ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.arc(u.x, u.y, ab.range, a - ab.ang / 2, a + ab.ang / 2); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  else if (ab.t === 'dash') { var dd = Math.min(ab.dist, L); ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(u.x + dx / L * dd, u.y + dy / L * dd); ctx.lineWidth = 10; ctx.stroke(); }
}
function drawMini() {
  var W = mini.width, H = mini.height, sx = W / MAP.W, sy = H / MAP.H;
  mctx.fillStyle = '#CDC19F'; mctx.fillRect(0, 0, W, H);
  mctx.strokeStyle = 'rgba(60,50,30,0.18)'; mctx.lineWidth = 1;
  for (var gx = 0; gx < W; gx += 40) { mctx.beginPath(); mctx.moveTo(gx, 0); mctx.lineTo(gx, H); mctx.stroke(); }
  for (var gy = 0; gy < H; gy += 40) { mctx.beginPath(); mctx.moveTo(0, gy); mctx.lineTo(W, gy); mctx.stroke(); }
  mctx.save(); mctx.scale(sx, sy);
  mctx.save(); mctx.translate(LCX, LCY); mctx.rotate(LANG);
  mctx.fillStyle = '#6E7A48'; mctx.fillRect(-LLEN / 2 - 300, -MAP.half - 110, LLEN + 600, MAP.half * 2 + 220);
  mctx.fillStyle = '#9C8A62'; mctx.fillRect(-LLEN / 2 - 300, -MAP.half, LLEN + 600, MAP.half * 2);
  mctx.restore();
  G.structs.forEach(function (s) { mctx.fillStyle = s.dead ? '#5A5448' : TEAMC[s.team].ui; var z = s.kind === 'hq' ? 76 : 50; mctx.fillRect(s.x - z / 2, s.y - z / 2, z, z); mctx.strokeStyle = '#2B2619'; mctx.lineWidth = 8; mctx.strokeRect(s.x - z / 2, s.y - z / 2, z, z); });
  if (G.barrage) G.barrage.beams.forEach(function (b) { if (b.x == null) return; mctx.strokeStyle = '#B4432E'; mctx.lineWidth = 10; mctx.beginPath(); mctx.arc(b.x, b.y, G.barrage.r, 0, Math.PI * 2); mctx.stroke(); });
  G.units.forEach(function (u) { if (u.dead || !visibleTo(u, MYTEAM)) return; mctx.fillStyle = u.isPlayer ? '#F5EFD8' : TEAMC[u.team].ui; var z = u.kind === 'hero' ? 46 : 22; mctx.beginPath(); mctx.arc(u.x, u.y, z / 2, 0, Math.PI * 2); mctx.fill(); if (u.kind === 'hero') { mctx.strokeStyle = '#2B2619'; mctx.lineWidth = 8; mctx.stroke(); } });
  mctx.strokeStyle = '#2B2619'; mctx.lineWidth = 10; mctx.strokeRect(cam.x - VW / 2 / cam.z, cam.y - VH / 2 / cam.z, VW / cam.z, VH / cam.z);
  mctx.restore();
}
