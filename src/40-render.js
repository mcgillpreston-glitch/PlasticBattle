/* Browser only: terrain, units, effects, post-processing, minimap. */

/* ---------------- Rendering ---------------- */
var cv = document.getElementById('game'), ctx = cv.getContext('2d');
var mini = document.getElementById('miniCv'), mctx = mini.getContext('2d');
var DPR = 1, VW = 0, VH = 0, terrain = null, grainCv = null, blendOK = { saturation: false, overlay: false };
function resize() {
  DPR = Math.min(1.5, window.devicePixelRatio || 1);
  VW = cv.clientWidth; VH = cv.clientHeight;
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  SIDE_W = 0;
  cam.zBase = clamp(Math.min((VW - SIDE_W) / 1500, VH / 900) * 1.1, 0.45, 1.25);
  if (!cam.zSet) cam.z = cam.zBase;
}
window.addEventListener('resize', resize);
var SIDE_W = 0;
function viewCX() { return (VW - SIDE_W) / 2; }
function s2w(x, y) { return { x: (x - viewCX()) / cam.z + cam.x, y: (y - VH / 2) / cam.z + cam.y }; }
function w2s(x, y) { return { x: (x - cam.x) * cam.z + viewCX(), y: (y - cam.y) * cam.z + VH / 2 }; }
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
var SAND = { L0: -LLEN / 2 - 330, L1: LLEN / 2 + 330, H: MAP.half + 20, plank: 46 };
function buildTerrain() {
  var T = document.createElement('canvas'); T.width = Math.round(TERR.w * TERR.s); T.height = Math.round(TERR.h * TERR.s);
  var c = T.getContext('2d'), R = seeded(11);
  c.scale(TERR.s, TERR.s); c.translate(-TERR.ox, -TERR.oy);
  // lawn with mow stripes
  c.fillStyle = '#5A8F3C'; c.fillRect(TERR.ox, TERR.oy, TERR.w, TERR.h);
  c.save(); c.translate(LCX, LCY); c.rotate(LANG);
  for (var sx = -3200; sx < 3200; sx += 160) { c.fillStyle = (sx / 160) % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'; c.fillRect(sx, -2600, 160, 5200); }
  c.restore();
  for (var i = 0; i < 2600; i++) { var gx = TERR.ox + R() * TERR.w, gy = TERR.oy + R() * TERR.h, gr = 6 + R() * 26; c.fillStyle = i % 3 ? 'rgba(130,190,80,0.16)' : 'rgba(30,70,20,0.18)'; ell(c, gx, gy, gr, gr * 0.5); c.fill(); }
  for (i = 0; i < 260; i++) { gx = TERR.ox + R() * TERR.w; gy = TERR.oy + R() * TERR.h; c.strokeStyle = 'rgba(190,220,120,0.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + (R() - 0.5) * 8, gy - 8 - R() * 8); c.stroke(); if (R() < 0.2) { c.fillStyle = '#F2D53C'; ell(c, gx, gy - 12, 4, 4); c.fill(); } }
  c.save(); c.translate(LCX, LCY); c.rotate(LANG);
  var L0 = SAND.L0, L1 = SAND.L1, H = SAND.H, PW = SAND.plank, x, y, s;
  // yard furniture outside the box
  function stone(px, py) { c.fillStyle = '#A9A49A'; rrect(c, px - 46, py - 32, 92, 64, 6); c.fill(); c.fillStyle = 'rgba(0,0,0,0.18)'; rrect(c, px - 46, py + 26, 92, 8, 3); c.fill(); c.fillStyle = 'rgba(255,255,255,0.14)'; rrect(c, px - 42, py - 30, 84, 6, 3); c.fill(); }
  for (x = L0 - 60; x < L1 + 60; x += 110) stone(x, -H - PW - 90);
  // garden hose coil
  c.strokeStyle = '#2E7D32'; c.lineWidth = 12; c.lineCap = 'round';
  c.beginPath(); for (var a = 0; a < Math.PI * 7; a += 0.2) { var rr = 40 + a * 5; var hx = L0 - 140 + Math.cos(a) * rr, hy = H + PW + 230 + Math.sin(a) * rr * 0.6; if (!a) c.moveTo(hx, hy); else c.lineTo(hx, hy); } c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 3; c.stroke();
  c.strokeStyle = '#2E7D32'; c.lineWidth = 12; c.beginPath(); c.moveTo(L0 - 140 + 150, H + PW + 230 + 70); c.quadraticCurveTo(L0 + 600, H + PW + 400, L1 - 200, H + PW + 260); c.stroke();
  // flower bed
  for (x = L1 - 900; x < L1 + 200; x += 70) { y = H + PW + 170 + (R() - 0.5) * 40; c.fillStyle = '#4A3321'; ell(c, x, y + 10, 40, 16); c.fill(); c.strokeStyle = '#3F8A2E'; c.lineWidth = 4; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 40); c.stroke(); c.fillStyle = ['#E53935', '#FDD835', '#F06292', '#FF7043'][Math.floor(R() * 4)]; ell(c, x, y - 48, 12, 14); c.fill(); }
  // sprinkler head, dog bowl, tennis ball, gnome
  c.fillStyle = '#3A3F44'; ell(c, L0 + 500, -H - PW - 190, 10, 6); c.fill(); c.fillStyle = '#9AA0A6'; c.fillRect(L0 + 497, -H - PW - 210, 6, 22);
  c.fillStyle = '#D32F2F'; ell(c, L1 - 500, -H - PW - 200, 44, 20); c.fill(); c.fillStyle = '#7B1F1F'; ell(c, L1 - 500, -H - PW - 204, 34, 13); c.fill(); c.fillStyle = '#5D4037'; ell(c, L1 - 500, -H - PW - 206, 26, 9); c.fill();
  c.fillStyle = '#C6E22E'; ell(c, L0 + 260, H + PW + 110, 20, 20); c.fill(); c.strokeStyle = '#F5F7E8'; c.lineWidth = 3; c.beginPath(); c.arc(L0 + 260, H + PW + 110, 14, 0.4, 2.2); c.stroke();
  c.fillStyle = '#1E6BB5'; rrect(c, L1 + 120, -H - 20, 30, 60, 6); c.fill(); c.fillStyle = '#F2C9A0'; ell(c, L1 + 135, -H - 30, 12, 12); c.fill(); c.fillStyle = '#D32F2F'; c.beginPath(); c.moveTo(L1 + 120, -H - 34); c.lineTo(L1 + 135, -H - 74); c.lineTo(L1 + 150, -H - 34); c.closePath(); c.fill(); c.fillStyle = '#F5F5F5'; ell(c, L1 + 135, -H - 18, 10, 8); c.fill();
  // sandbox frame (planks)
  function plank(px, py, w, h) { c.fillStyle = '#9B6B3A'; c.fillRect(px, py, w, h); c.fillStyle = 'rgba(255,220,160,0.25)'; c.fillRect(px, py, w, 6); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(px, py + h - 7, w, 7); c.strokeStyle = '#5A3A1C'; c.lineWidth = 3; c.strokeRect(px, py, w, h); c.strokeStyle = 'rgba(60,35,15,0.35)'; c.lineWidth = 1.5; for (var k = 10; k < h - 6; k += 12) { c.beginPath(); c.moveTo(px + 6, py + k); c.bezierCurveTo(px + w * 0.3, py + k + 3, px + w * 0.7, py + k - 3, px + w - 6, py + k + 1); c.stroke(); } }
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(L0 - PW - 6, -H - PW + 10, L1 - L0 + 2 * PW + 24, 2 * H + 2 * PW + 14);
  plank(L0 - PW, -H - PW, L1 - L0 + 2 * PW, PW); plank(L0 - PW, H, L1 - L0 + 2 * PW, PW);
  c.save(); c.translate(L0 - PW / 2, 0); c.rotate(Math.PI / 2); plank(-H - PW, -PW / 2, 2 * H + 2 * PW, PW); c.restore();
  c.save(); c.translate(L1 + PW / 2, 0); c.rotate(Math.PI / 2); plank(-H - PW, -PW / 2, 2 * H + 2 * PW, PW); c.restore();
  [[L0 - PW, -H - PW], [L1, -H - PW], [L0 - PW, H], [L1, H]].forEach(function (p) { c.fillStyle = '#7A4F26'; c.fillRect(p[0] - 4, p[1] - 4, PW + 8, PW + 8); c.strokeStyle = '#3E2612'; c.lineWidth = 3; c.strokeRect(p[0] - 4, p[1] - 4, PW + 8, PW + 8); c.fillStyle = '#B8B8B8'; ell(c, p[0] + PW / 2, p[1] + PW / 2, 4, 4); c.fill(); });
  // sand
  c.fillStyle = '#E3CB93'; c.fillRect(L0, -H, L1 - L0, 2 * H);
  for (i = 0; i < 4200; i++) { x = L0 + R() * (L1 - L0); y = -H + R() * 2 * H; var sr = 1.5 + R() * 5; c.fillStyle = i % 3 ? 'rgba(170,135,80,0.22)' : 'rgba(255,245,215,0.3)'; ell(c, x, y, sr, sr * 0.7); c.fill(); }
  for (i = 0; i < 14; i++) { x = L0 + R() * (L1 - L0); y = (R() - 0.5) * 2 * H; c.fillStyle = 'rgba(150,115,60,0.28)'; ell(c, x, y, 60 + R() * 120, 30 + R() * 50); c.fill(); }
  var sh = c.createLinearGradient(0, -H, 0, -H + 90); sh.addColorStop(0, 'rgba(60,40,10,0.35)'); sh.addColorStop(1, 'rgba(60,40,10,0)'); c.fillStyle = sh; c.fillRect(L0, -H, L1 - L0, 90);
  sh = c.createLinearGradient(L0, 0, L0 + 90, 0); sh.addColorStop(0, 'rgba(60,40,10,0.3)'); sh.addColorStop(1, 'rgba(60,40,10,0)'); c.fillStyle = sh; c.fillRect(L0, -H, 90, 2 * H);
  // rake lines, footprints, toy tracks
  c.strokeStyle = 'rgba(150,115,60,0.35)'; c.lineWidth = 2;
  for (i = 0; i < 9; i++) { x = L0 + 200 + i * 290; c.beginPath(); for (var k = -H + 20; k < H - 20; k += 10) { var wx = x + Math.sin(k * 0.08 + i) * 18; if (k === -H + 20) c.moveTo(wx, k); else c.lineTo(wx, k); } c.stroke(); }
  for (i = 0; i < 40; i++) { x = L0 + R() * (L1 - L0); y = (R() - 0.5) * 2 * (H - 30); var fa = R() * Math.PI; c.fillStyle = 'rgba(140,105,55,0.35)'; c.save(); c.translate(x, y); c.rotate(fa); ell(c, -10, 0, 7, 4); c.fill(); ell(c, 10, 6, 7, 4); c.fill(); c.restore(); }
  c.strokeStyle = 'rgba(140,105,55,0.4)'; c.lineWidth = 10; c.setLineDash([14, 10]);
  [-44, 44].forEach(function (ry) { c.beginPath(); for (x = L0; x <= L1; x += 60) { var yy = ry + Math.sin(x * 0.011) * 26; if (x === L0) c.moveTo(x, yy); else c.lineTo(x, yy); } c.stroke(); });
  c.setLineDash([]);
  // damp patch near the sprinkler side, and a few sand-castle crumbs
  c.fillStyle = 'rgba(120,95,50,0.35)'; ell(c, L0 + 520, -H + 70, 170, 60); c.fill();
  [[0.19, 120], [0.81, -120], [0.44, -30], [0.63, 40]].forEach(function (p) { x = (p[0] - 0.5) * LLEN; y = p[1]; c.fillStyle = '#CDB27A'; ell(c, x, y, 40, 18); c.fill(); c.fillStyle = '#D9C086'; for (var q = 0; q < 5; q++) { ell(c, x + (q - 2) * 14, y - 6 - (q % 2) * 6, 8, 6); c.fill(); } });
  c.restore();
  return T;
}

function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#5A8F3C'; ctx.fillRect(0, 0, VW, VH);
  if (!G) return;
  ctx.save();
  var shx = G.shake > 0 ? (Math.random() - 0.5) * G.shake * 2 : 0, shy = G.shake > 0 ? (Math.random() - 0.5) * G.shake * 2 : 0;
  ctx.translate(viewCX() + shx, VH / 2 + shy); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(terrain, TERR.ox, TERR.oy, TERR.w, TERR.h);
  [0, 1].forEach(function (t) { var fp = fountain(t); ctx.fillStyle = t === MYTEAM ? 'rgba(91,214,107,0.12)' : 'rgba(240,69,58,0.12)'; ell(ctx, fp.x, fp.y, 330, 330); ctx.fill(); });
  G.fx.forEach(function (f) { if (f.k === 'scorch' || f.k === 'glow' || f.k === 'castring') drawFx(f); });
  G.crates.forEach(function (c) { if (c.up) drawCrate(c.x, c.y); else { ctx.strokeStyle = 'rgba(20,19,15,0.4)'; ctx.setLineDash([4, 4]); ctx.strokeRect(c.x - 16, c.y - 16, 32, 32); ctx.setLineDash([]); } });
  G.mines.forEach(function (m) { if (m.team !== MYTEAM && m.arm <= 0 && dist(m, G.player) > 200) return; ctx.fillStyle = m.arm > 0 ? '#6B6B60' : '#3A3A30'; ell(ctx, m.x, m.y, 16, 8); ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#B4432E'; ell(ctx, m.x, m.y - 3, 3, 3); ctx.fill(); });
  G.lobs.forEach(function (l) { if (l.single) return; var p = Math.min(1, l.t / l.delay); ctx.strokeStyle = l.team === MYTEAM ? 'rgba(91,214,107,0.85)' : 'rgba(240,69,58,0.9)'; ctx.lineWidth = 3; ell(ctx, l.x, l.y, l.r, l.r * 0.6); ctx.stroke(); ctx.fillStyle = l.team === MYTEAM ? 'rgba(91,214,107,0.18)' : 'rgba(240,69,58,0.2)'; ell(ctx, l.x, l.y, l.r * p, l.r * 0.6 * p); ctx.fill(); });
  if (opts.ranges) {
    G.structs.forEach(function (s) { if (s.dead || s.kind === 'depot') return; ctx.strokeStyle = 'rgba(224,112,63,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ell(ctx, s.x, s.y, s.range, s.range); ctx.stroke(); ctx.setLineDash([]); });
    G.units.forEach(function (u) { if (u.kind !== 'hero' || u.dead) return; ctx.strokeStyle = u.team === MYTEAM ? 'rgba(91,214,107,0.5)' : 'rgba(240,69,58,0.5)'; ctx.lineWidth = 2; ell(ctx, u.x, u.y, aaRange(u), aaRange(u)); ctx.stroke(); });
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
      ctx.strokeStyle = u.team === MYTEAM ? 'rgba(200,240,140,0.9)' : 'rgba(255,200,190,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
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
  if (G.barrage) G.barrage.beams.forEach(function (b) { if (b.x == null) return; var r = G.barrage.r; ctx.fillStyle = 'rgba(90,160,230,0.22)'; ell(ctx, b.x, b.y, r, r * 0.65); ctx.fill(); ctx.strokeStyle = 'rgba(190,225,255,0.85)'; ctx.lineWidth = 3; ctx.setLineDash([6, 10]); ell(ctx, b.x, b.y, r, r * 0.65); ctx.stroke(); ctx.setLineDash([]); for (var q = 0; q < 10; q++) { var qa = G.time * 3 + q * 0.63, qf = (G.time * 0.9 + q * 0.1) % 1, qr = r * (0.3 + 0.7 * qf); ctx.fillStyle = 'rgba(200,235,255,0.8)'; ell(ctx, b.x + Math.cos(qa) * qr, b.y + Math.sin(qa) * qr * 0.65 - 20 - 30 * Math.sin(qf * Math.PI), 3, 5); ctx.fill(); } });
  G.fx.forEach(function (f) { if (f.k !== 'scorch' && f.k !== 'glow' && f.k !== 'castring' && f.k !== 'callout') drawFx(f); });
  G.structs.forEach(function (s) { if (!s.dead) bar(s.x, s.y - (s.kind === 'hq' ? 178 : s.kind === 'depot' ? 100 : 116), s.kind === 'hq' ? 150 : 110, 9, s.hp / s.maxHp, s.team, targetable(s) ? null : 'locked'); });
  G.units.forEach(function (u) {
    if (u.dead || !visibleTo(u, MYTEAM)) return;
    var hh = unitH(u);
    if (u.kind === 'hero') {
      bar(u.x, u.y - hh - 16, 84, 8, u.hp / maxHp(u), u.team, null, u.shield / maxHp(u), u.lvl);
      ctx.font = '400 11px Russo One, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = u.team === MYTEAM ? '#CFF5D3' : '#FFD6D2'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      var nm = u.isPlayer ? 'YOU' : (u.pname ? u.pname.toUpperCase() : u.name.toUpperCase()); ctx.strokeText(nm, u.x, u.y - hh - 23); ctx.fillText(nm, u.x, u.y - hh - 23);
    } else bar(u.x, u.y - hh - 10, 40, 4, u.hp / u.maxHp, u.team);
  });
  if (G.player && !G.player.dead) {
    if (G.player.target) drawBracket(G.player.target, '#D9532F', 3, true);
    if (hoverT && hoverT !== G.player.target && !hoverT.dead) drawBracket(hoverT, 'rgba(214,203,170,0.8)', 2, false);
  }
  G.fx.forEach(function (f) { if (f.k === 'callout') drawFx(f); });
  G.texts.forEach(function (t) { var pop = t.t < 0.1 ? 1.5 - t.t * 5 : 1; ctx.save(); ctx.translate(t.x, t.y); ctx.scale(pop, pop); ctx.globalAlpha = t.t < 0.6 ? 1 : 1 - (t.t - 0.6) / 0.3; ctx.font = '400 ' + (t.big ? 24 : 17) + 'px Russo One, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(t.txt, 0, 0); ctx.fillStyle = t.color; ctx.fillText(t.txt, 0, 0); ctx.restore(); ctx.globalAlpha = 1; });
  ctx.restore();
  postProcess();
  drawMini();
}
function postProcess() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (blendOK.overlay) { ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = 'rgba(255,214,150,0.2)'; ctx.fillRect(0, 0, VW, VH); }
  ctx.globalCompositeOperation = blendOK.overlay ? 'overlay' : 'source-over';
  ctx.globalAlpha = blendOK.overlay ? 0.07 : 0.03;
  var ox = -Math.floor(Math.random() * 192), oy = -Math.floor(Math.random() * 192);
  ctx.save(); ctx.translate(ox, oy); var gp = ctx.createPattern(grainCv, 'repeat'); ctx.fillStyle = gp; ctx.fillRect(-ox, -oy, VW + 192, VH + 192); ctx.restore();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  var cx = viewCX(), cy = VH / 2;
  var vg = ctx.createRadialGradient(cx, cy, Math.min(VW, VH) * 0.45, cx, cy, Math.max(VW, VH) * 0.8);
  vg.addColorStop(0, 'rgba(10,12,8,0)'); vg.addColorStop(1, 'rgba(10,12,8,0.42)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  var p = G.player, low = p && !p.dead ? clamp(1 - (p.hp / maxHp(p)) / 0.3, 0, 1) : 0;
  var hurt = Math.max(G.hurtT > 0 ? clamp(G.hurtT, 0, 0.6) : 0, low * (0.3 + 0.18 * Math.sin(G.time * 7)));
  if (hurt > 0) { var hg = ctx.createRadialGradient(cx, cy, Math.min(VW, VH) * 0.25, cx, cy, Math.max(VW, VH) * 0.7); hg.addColorStop(0, 'rgba(170,20,20,0)'); hg.addColorStop(1, 'rgba(170,20,20,' + hurt + ')'); ctx.fillStyle = hg; ctx.fillRect(0, 0, VW, VH); }
  if (G.hitDirs && G.hitDirs.length && p && !p.dead) {
    var ps = w2s(p.x, p.y - unitH(p) * 0.45);
    G.hitDirs.forEach(function (h) {
      var a = h.t / 0.9; ctx.strokeStyle = 'rgba(230,40,40,' + (0.9 * a) + ')'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(ps.x, ps.y, 92 + (1 - a) * 10, h.ang - 0.42, h.ang + 0.42); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,120,110,' + (0.9 * a) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ps.x, ps.y, 98 + (1 - a) * 10, h.ang - 0.3, h.ang + 0.3); ctx.stroke();
    });
    ctx.lineCap = 'butt';
  }
}
function bar(x, y, w, h, frac, team, locked, sh, lvl) {
  frac = clamp(frac, 0, 1);
  ctx.fillStyle = 'rgba(8,10,12,0.8)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = team === MYTEAM ? '#5BD66B' : '#F0453A'; ctx.fillRect(x - w / 2, y, w * frac, h);
  if (sh > 0) { ctx.fillStyle = 'rgba(120,200,255,0.9)'; ctx.fillRect(x - w / 2 + w * frac, y, Math.min(w * (1 - frac), w * sh), h); }
  if (locked) { ctx.fillStyle = 'rgba(8,10,12,0.5)'; ctx.fillRect(x - w / 2, y, w, h); }
  for (var k = 1; k < 4 && h >= 6; k++) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x - w / 2 + w * k / 4 - 0.5, y, 1, h); }
  if (lvl) { ctx.fillStyle = team === MYTEAM ? '#5BD66B' : '#F0453A'; ctx.fillRect(x - w / 2 - 20, y - 3, 17, h + 6); ctx.fillStyle = '#0A0C0E'; ctx.font = '400 11px Russo One, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(lvl, x - w / 2 - 11.5, y + h + 1); }
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
  ctx.fillStyle = '#E8E8E8'; rrect(ctx, x - 18, y - 24, 36, 32, 4); ctx.fill(); ctx.fillStyle = '#F7F7F7'; rrect(ctx, x - 18, y - 30, 36, 8, 3); ctx.fill();
  ctx.strokeStyle = '#8F9196'; ctx.lineWidth = 2; rrect(ctx, x - 18, y - 30, 36, 38, 4); ctx.stroke();
  ctx.fillStyle = '#D32F2F'; ctx.fillRect(x - 10, y - 14, 20, 6); ctx.fillRect(x - 3, y - 21, 6, 20);
}
function drawProp(p) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ell(ctx, p.x + 8, p.y + 6, p.r + 8, p.r * 0.45); ctx.fill();
  if (p.kind === 'wall') {
    var L = p.len; ctx.save(); laneSkew(ctx, p.x, p.y);
    ctx.fillStyle = '#CDB27A'; ctx.fillRect(-L / 2, -40, L, 40);
    ctx.fillStyle = '#DCC48E'; ctx.fillRect(-L / 2, -48, L, 10);
    for (var i = 0; i < 6; i++) { ctx.fillStyle = '#DCC48E'; ctx.fillRect(-L / 2 + 6 + i * (L / 6), -62, L / 6 - 10, 16); ctx.strokeStyle = '#8E7443'; ctx.lineWidth = 1.5; ctx.strokeRect(-L / 2 + 6 + i * (L / 6), -62, L / 6 - 10, 16); }
    ctx.strokeStyle = '#8E7443'; ctx.lineWidth = 2; ctx.strokeRect(-L / 2, -48, L, 48);
    ctx.fillStyle = 'rgba(80,60,30,0.2)'; for (var k = 0; k < 20; k++) { ell(ctx, -L / 2 + 10 + (k * 37) % L, -34 + (k * 13) % 26, 3, 2); ctx.fill(); }
    ctx.restore();
  } else if (p.kind === 'jeep') {
    ctx.save(); laneSkew(ctx, p.x, p.y);
    ctx.fillStyle = '#222'; [-34, 30].forEach(function (x) { ell(ctx, x, -8, 15, 13); ctx.fill(); ctx.fillStyle = '#9A9A9A'; ell(ctx, x, -8, 7, 6); ctx.fill(); ctx.fillStyle = '#222'; });
    ctx.fillStyle = '#F2B600'; rrect(ctx, -54, -48, 76, 36, 4); ctx.fill(); ctx.strokeStyle = '#8A6500'; ctx.lineWidth = 2; rrect(ctx, -54, -48, 76, 36, 4); ctx.stroke();
    ctx.fillStyle = '#F2B600'; rrect(ctx, 20, -40, 34, 30, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9AD3F5'; ctx.fillRect(26, -36, 18, 12);
    ctx.fillStyle = '#D9A300'; ctx.fillRect(-50, -70, 68, 24); ctx.strokeStyle = '#8A6500'; ctx.strokeRect(-50, -70, 68, 24);
    ctx.fillStyle = '#E3CB93'; ell(ctx, -16, -72, 30, 10); ctx.fill();
    ctx.restore();
  } else if (p.kind === 'cart') {
    ctx.save(); laneSkew(ctx, p.x, p.y); ctx.rotate(-0.1);
    ctx.fillStyle = '#1E6BB5'; ctx.fillRect(-52, -14, 70, 8); ctx.strokeStyle = '#0D3F70'; ctx.lineWidth = 2; ctx.strokeRect(-52, -14, 70, 8);
    ctx.fillStyle = '#F44336'; ctx.beginPath(); ctx.moveTo(18, -24); ctx.lineTo(56, -22); ctx.lineTo(54, 6); ctx.lineTo(20, 4); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#8E1F17'; ctx.stroke();
    ctx.fillStyle = '#1E6BB5'; ctx.fillRect(-60, -20, 10, 20);
    ctx.restore();
  } else {
    // toy bucket
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.fillStyle = '#D32F2F'; ctx.beginPath(); ctx.moveTo(-24, -44); ctx.lineTo(24, -44); ctx.lineTo(30, 0); ctx.lineTo(-30, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#7B1F1F'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#EF5350'; ell(ctx, 0, -44, 24, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#E3CB93'; ell(ctx, 0, -46, 18, 5); ctx.fill();
    ctx.strokeStyle = '#F5F5F5'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -44, 26, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-18, -40, 6, 36);
    ctx.restore();
  }
  ctx.restore();
}
function drawThicket(b, i) {
  var inside = G.player && !G.player.dead && inBrush(G.player) === i;
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(LANG); ctx.globalAlpha = inside ? 0.45 : 0.95;
  var R = seeded(31 + i);
  for (var k = 0; k < 26; k++) {
    var x = (R() - 0.5) * b.rx * 1.7, y = (R() - 0.5) * b.ry * 1.5, hgt = 34 + R() * 30;
    ctx.strokeStyle = R() < 0.5 ? '#4E9A2E' : '#6BBE3A'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (var q = -1; q <= 1; q++) { ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + q * 10, y - hgt * 0.6, x + q * 22, y - hgt); ctx.stroke(); }
    if (R() < 0.25) { ctx.fillStyle = '#F2D53C'; ell(ctx, x + 4, y - hgt - 4, 6, 6); ctx.fill(); }
  }
  ctx.lineCap = 'butt';
  ctx.restore();
}
function sandTower(x, y, r, h, dead, C) {
  ctx.fillStyle = dead ? '#C9B07A' : '#D9C086'; ell(ctx, x, y, r, r * 0.45); ctx.fill();
  if (dead) { ctx.fillStyle = '#C9B07A'; ell(ctx, x, y - 6, r * 1.2, r * 0.5); ctx.fill(); ctx.fillStyle = '#B99F6B'; ell(ctx, x + r * 0.3, y - 14, r * 0.5, r * 0.25); ctx.fill(); return; }
  ctx.fillStyle = '#D9C086'; ctx.fillRect(x - r, y - h, 2 * r, h);
  ctx.fillStyle = 'rgba(120,90,40,0.25)'; ctx.fillRect(x + r * 0.45, y - h, r * 0.55, h);
  ctx.fillStyle = '#E3CB93'; ell(ctx, x, y - h, r, r * 0.45); ctx.fill();
  for (var i = -2; i <= 2; i++) { ctx.fillStyle = '#D9C086'; ctx.fillRect(x + i * r * 0.5 - r * 0.16, y - h - 12, r * 0.32, 12); ctx.strokeStyle = '#A48A55'; ctx.lineWidth = 1.5; ctx.strokeRect(x + i * r * 0.5 - r * 0.16, y - h - 12, r * 0.32, 12); }
  ctx.strokeStyle = '#A48A55'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - r, y - h); ctx.lineTo(x - r, y); ctx.moveTo(x + r, y - h); ctx.lineTo(x + r, y); ctx.stroke();
  ctx.fillStyle = C.hi; ctx.fillRect(x + r * 0.6, y - h - 44, 3, 34); ctx.beginPath(); ctx.moveTo(x + r * 0.6 + 3, y - h - 44); ctx.lineTo(x + r * 0.6 + 26, y - h - 38); ctx.lineTo(x + r * 0.6 + 3, y - h - 30); ctx.closePath(); ctx.fill();
}
function drawStruct(s) {
  ctx.save(); ctx.translate(s.x, s.y);
  var C = TEAMC[s.team], dead = s.dead, rec = s.recoilT > 0 ? s.recoilT * 20 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ell(ctx, 6, 8, s.r + 24, (s.r + 24) * 0.42); ctx.fill();
  if (s.kind === 'outpost') {
    ctx.fillStyle = 'rgba(120,95,50,0.3)'; ell(ctx, 0, 0, 74, 34); ctx.fill();
    sandTower(0, 0, 44, 46, dead, C);
    if (!dead) { var sp = sprite('gunner', s.team, 70, s.team === 1); ctx.drawImage(sp.cv, -sp.w / 2 - (s.team === 1 ? -rec : rec), -46 - sp.h * 0.9, sp.w, sp.h); }
    if (s.flashT > 0 && !dead) { ctx.globalAlpha = s.flashT / 0.08 * 0.6; ctx.fillStyle = '#fff'; ctx.fillRect(-46, -60, 92, 60); ctx.globalAlpha = 1; }
  } else if (s.kind === 'depot') {
    if (dead) { ctx.fillStyle = '#1E6BB5'; ctx.save(); ctx.rotate(1.2); rrect(ctx, -22, -40, 44, 44, 6); ctx.fill(); ctx.restore(); ctx.fillStyle = '#D9C086'; ell(ctx, 30, 4, 40, 14); ctx.fill(); }
    else {
      ctx.fillStyle = '#1E6BB5'; ctx.beginPath(); ctx.moveTo(-30, -66); ctx.lineTo(30, -66); ctx.lineTo(38, 0); ctx.lineTo(-38, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#0D3F70'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#4A90D9'; ell(ctx, 0, -66, 30, 9); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-24, -60, 7, 56);
      ctx.fillStyle = '#7E7148'; rrect(ctx, -78, -24, 26, 24, 3); ctx.fill(); rrect(ctx, 52, -22, 24, 22, 3); ctx.fill(); rrect(ctx, -70, -46, 22, 22, 3); ctx.fill(); ctx.strokeStyle = '#3A3220'; rrect(ctx, -78, -24, 26, 24, 3); ctx.stroke(); rrect(ctx, 52, -22, 24, 22, 3); ctx.stroke(); rrect(ctx, -70, -46, 22, 22, 3); ctx.stroke();
      ctx.fillStyle = '#F5F5F5'; ctx.font = '400 10px Russo One, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SUPPLY', 0, -30);
    }
  } else if (s.team === 0) {
    // sandcastle fort
    if (dead) ctx.rotate(0.08);
    ctx.fillStyle = 'rgba(120,95,50,0.3)'; ell(ctx, 0, 4, 150, 62); ctx.fill();
    ctx.fillStyle = dead ? '#C9B07A' : '#D9C086'; ctx.fillRect(-100, -70, 200, 70); ctx.strokeStyle = '#A48A55'; ctx.lineWidth = 2; ctx.strokeRect(-100, -70, 200, 70);
    ctx.fillStyle = 'rgba(120,90,40,0.18)'; ctx.fillRect(60, -70, 40, 70);
    for (var i = 0; i < 7; i++) { ctx.fillStyle = dead ? '#C9B07A' : '#DCC48E'; ctx.fillRect(-96 + i * 30, -84, 18, 14); ctx.strokeRect(-96 + i * 30, -84, 18, 14); }
    [[-92, 40, 120], [92, 40, 120], [-30, 30, 92], [30, 30, 92]].forEach(function (t) { sandTower(t[0], 0, t[1], t[2], dead, C); });
    ctx.fillStyle = '#4A3A26'; ctx.fillRect(-18, -44, 36, 44);
    if (!dead) { ctx.fillStyle = '#F5F5F5'; ctx.font = '400 15px Russo One, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('FORT', 0, -54); }
    if (s.flashT > 0 && !dead) { ctx.globalAlpha = s.flashT / 0.08 * 0.5; ctx.fillStyle = '#fff'; ctx.fillRect(-130, -160, 260, 160); ctx.globalAlpha = 1; }
  } else {
    // overturned bucket bunker
    if (dead) ctx.rotate(-0.12);
    ctx.fillStyle = 'rgba(120,95,50,0.3)'; ell(ctx, 0, 4, 140, 58); ctx.fill();
    ctx.fillStyle = dead ? '#C9B07A' : '#D9C086'; ell(ctx, 0, 0, 120, 44); ctx.fill();
    ctx.fillStyle = dead ? '#8E1F17' : '#D32F2F'; ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(70, 0); ctx.lineTo(60, -120); ctx.lineTo(-60, -120); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#7B1F1F'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = dead ? '#A52A20' : '#EF5350'; ell(ctx, 0, -120, 60, 18); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(-52, -110, 10, 100);
    ctx.fillStyle = '#12110D'; ctx.fillRect(-26, -56, 52, 16);
    for (var k = -4; k <= 4; k++) { if (Math.abs(k) < 2) continue; sandbagS(k * 26, 6, dead); }
    if (dead) { ctx.strokeStyle = '#4A1010'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-30, -118); ctx.lineTo(-6, -70); ctx.lineTo(-24, -20); ctx.stroke(); }
    ctx.fillStyle = '#F5F5F5'; ctx.font = '400 15px Russo One, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('BUNKER', 0, -74);
    if (s.flashT > 0 && !dead) { ctx.globalAlpha = s.flashT / 0.08 * 0.5; ctx.fillStyle = '#fff'; ctx.fillRect(-120, -140, 240, 150); ctx.globalAlpha = 1; }
  }
  ctx.restore();
}
function sandbagS(x, y, dead) { ctx.fillStyle = dead ? '#B99F6B' : '#D9C086'; ell(ctx, x, y, 14, 8); ctx.fill(); ctx.strokeStyle = '#A48A55'; ctx.lineWidth = 1.5; ctx.stroke(); }
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
    var s = f.heavy ? 1.8 : 1; ctx.save(); ctx.translate(f.x, f.y); ctx.globalAlpha = 1 - p;
    ctx.fillStyle = 'rgba(227,203,147,0.7)'; ell(ctx, 0, 6 + p * 4, (6 + 18 * p) * s, (4 + 10 * p) * s); ctx.fill();
    ctx.strokeStyle = '#FFF4C8'; ctx.lineWidth = 2 * s;
    for (var i = 0; i < 5; i++) { var a = i * Math.PI * 2 / 5 + 0.3 + f.x % 1, r0 = 3 * s, r1 = (8 + 14 * p) * s; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1 * 0.7); ctx.stroke(); }
    ctx.fillStyle = '#FFFBE6'; ell(ctx, 0, 0, 5 * s * (1 - p) + 1, 5 * s * (1 - p) + 1); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1; return;
  }
  if (f.k === 'hitmark') {
    var kill = f.kill, sc = kill ? 1.5 : 1, g0 = (6 + p * 4) * sc, g1 = g0 + 10 * sc;
    ctx.save(); ctx.translate(f.x, f.y); ctx.globalAlpha = 1 - p * p; ctx.lineCap = 'round';
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (q) { ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 5 * sc; ctx.beginPath(); ctx.moveTo(q[0] * g0, q[1] * g0); ctx.lineTo(q[0] * g1, q[1] * g1); ctx.stroke(); ctx.strokeStyle = kill ? '#FF3B30' : '#FFFFFF'; ctx.lineWidth = 2.5 * sc; ctx.beginPath(); ctx.moveTo(q[0] * g0, q[1] * g0); ctx.lineTo(q[0] * g1, q[1] * g1); ctx.stroke(); });
    ctx.restore(); ctx.globalAlpha = 1; ctx.lineCap = 'butt'; return;
  }
  if (f.k === 'splash') { ctx.globalAlpha = 1 - p; ctx.fillStyle = 'rgba(160,210,255,0.6)'; ell(ctx, f.x, f.y, 8 + 30 * p, 4 + 14 * p); ctx.fill(); ctx.fillStyle = 'rgba(220,240,255,0.9)'; for (var d = 0; d < 6; d++) { var da = d * 1.05 + f.x % 2, dr = 6 + 34 * p; ell(ctx, f.x + Math.cos(da) * dr, f.y - 28 * Math.sin(p * Math.PI) + Math.sin(da) * dr * 0.5, 3, 4); ctx.fill(); } ctx.globalAlpha = 1; return; }
  if (f.k === 'banner') {
    var al = p < 0.1 ? p / 0.1 : p > 0.8 ? (1 - p) / 0.2 : 1, sc2 = p < 0.1 ? 1.6 - p * 6 : 1;
    ctx.save(); ctx.translate(f.x, f.y); ctx.scale(sc2, sc2); ctx.globalAlpha = al; ctx.textAlign = 'center';
    ctx.font = '400 26px Russo One, Impact, sans-serif'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(f.txt, 0, 0); ctx.fillStyle = f.c || '#FFFFFF'; ctx.fillText(f.txt, 0, 0);
    if (f.sub) { ctx.font = '400 15px Russo One, Impact, sans-serif'; ctx.lineWidth = 4; ctx.strokeText(f.sub, 0, 24); ctx.fillStyle = '#FFD24A'; ctx.fillText(f.sub, 0, 24); }
    ctx.restore(); ctx.globalAlpha = 1; return;
  }
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
    ctx.font = (f.ult ? '400 22px' : '400 15px') + " 'Russo One', Impact, sans-serif"; ctx.textAlign = 'center';
    var tw = ctx.measureText(f.txt).width + 18, th = f.ult ? 32 : 25;
    ctx.fillStyle = 'rgba(8,10,12,0.85)'; ctx.fillRect(-tw / 2, -th + 7, tw, th);
    ctx.fillStyle = cu.team === MYTEAM ? '#5BD66B' : '#F0453A'; ctx.fillRect(-tw / 2, -th + 7, 4, th);
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
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2;
  if (ab.t === 'proj' || ab.t === 'jack' || ab.t === 'chan') { var rr = ab.range; ctx.save(); ctx.translate(u.x, u.y); ctx.rotate(Math.atan2(dy, dx)); ctx.fillRect(0, -(ab.w || 16), rr, (ab.w || 16) * 2); ctx.strokeRect(0, -(ab.w || 16), rr, (ab.w || 16) * 2); ctx.restore(); }
  else if (ab.t === 'lob' || ab.t === 'leap' || ab.t === 'mine') { var d = Math.min(L, ab.range), x = u.x + dx / L * d, y = u.y + dy / L * d; ell(ctx, u.x, u.y, ab.range, ab.range); ctx.stroke(); ell(ctx, x, y, ab.r || 40, (ab.r || 40) * 0.6); ctx.fill(); ctx.stroke(); }
  else if (ab.t === 'nova') { ell(ctx, u.x, u.y, ab.r, ab.r * 0.6); ctx.fill(); ctx.stroke(); }
  else if (ab.t === 'cone') { var a = Math.atan2(dy, dx); ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.arc(u.x, u.y, ab.range, a - ab.ang / 2, a + ab.ang / 2); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  else if (ab.t === 'dash') { var dd = Math.min(ab.dist, L); ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(u.x + dx / L * dd, u.y + dy / L * dd); ctx.lineWidth = 10; ctx.stroke(); }
}
function drawMini() {
  var W = mini.width, H = mini.height, sx = W / MAP.W, sy = H / MAP.H;
  mctx.fillStyle = '#071A0B'; mctx.fillRect(0, 0, W, H);
  mctx.save(); mctx.scale(sx, sy);
  mctx.save(); mctx.translate(LCX, LCY); mctx.rotate(LANG);
  mctx.fillStyle = '#1E4D22'; mctx.fillRect(SAND.L0 - 60, -SAND.H - 60, SAND.L1 - SAND.L0 + 120, SAND.H * 2 + 120);
  mctx.fillStyle = '#5C5A2A'; mctx.fillRect(SAND.L0, -SAND.H, SAND.L1 - SAND.L0, SAND.H * 2);
  mctx.restore();
  G.structs.forEach(function (s) { mctx.fillStyle = s.dead ? '#3A3A30' : s.team === MYTEAM ? '#5BD66B' : '#F0453A'; var z = s.kind === 'hq' ? 76 : 50; mctx.fillRect(s.x - z / 2, s.y - z / 2, z, z); });
  if (G.barrage) G.barrage.beams.forEach(function (b) { if (b.x == null) return; mctx.strokeStyle = '#7EC8FF'; mctx.lineWidth = 10; mctx.beginPath(); mctx.arc(b.x, b.y, G.barrage.r, 0, Math.PI * 2); mctx.stroke(); });
  G.units.forEach(function (u) { if (u.dead || !visibleTo(u, MYTEAM)) return; mctx.fillStyle = u.isPlayer ? '#FFFFFF' : u.team === MYTEAM ? '#5BD66B' : '#F0453A'; var z = u.kind === 'hero' ? 46 : 22; mctx.beginPath(); mctx.arc(u.x, u.y, z / 2, 0, Math.PI * 2); mctx.fill(); });
  mctx.strokeStyle = 'rgba(255,255,255,0.85)'; mctx.lineWidth = 8; mctx.strokeRect(cam.x - (VW - SIDE_W) / 2 / cam.z, cam.y - VH / 2 / cam.z, (VW - SIDE_W) / cam.z, VH / cam.z);
  mctx.restore();
  mctx.strokeStyle = 'rgba(80,200,90,0.18)'; mctx.lineWidth = 1;
  for (var gx = 0; gx < W; gx += 40) { mctx.beginPath(); mctx.moveTo(gx, 0); mctx.lineTo(gx, H); mctx.stroke(); }
  for (var gy = 0; gy < H; gy += 40) { mctx.beginPath(); mctx.moveTo(0, gy); mctx.lineTo(W, gy); mctx.stroke(); }
  var sa = (G.time * 1.6) % (Math.PI * 2), sg = mctx.createConicGradient ? mctx.createConicGradient(sa, W / 2, H / 2) : null;
  if (sg) { sg.addColorStop(0, 'rgba(90,230,110,0.35)'); sg.addColorStop(0.12, 'rgba(90,230,110,0)'); sg.addColorStop(1, 'rgba(90,230,110,0)'); mctx.fillStyle = sg; mctx.fillRect(0, 0, W, H); }
}
