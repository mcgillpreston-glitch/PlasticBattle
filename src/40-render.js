/* Browser only: terrain, units, effects, post-processing, minimap. */

/* ---------------- Rendering ---------------- */
var cv = document.getElementById('game'), ctx = cv.getContext('2d');
var mini = document.getElementById('miniCv'), mctx = mini.getContext('2d');
var DPR = 1, VW = 0, VH = 0, terrain = null, grainCv = null, blendOK = { saturation: false, overlay: false };
function resize() {
  DPR = Math.min(opts.lowRes ? 1 : 1.5, window.devicePixelRatio || 1);
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
function checkBlend() {
  var t = document.createElement('canvas').getContext('2d');
  ['saturation', 'overlay'].forEach(function (m) { t.globalCompositeOperation = m; blendOK[m] = t.globalCompositeOperation === m; });
}
var grainPat = null;
function makeGrain() {
  grainCv = document.createElement('canvas'); grainCv.width = 192; grainCv.height = 192;
  var c = grainCv.getContext('2d'), img = c.createImageData(192, 192), d = img.data;
  for (var i = 0; i < d.length; i += 4) { var v = 100 + Math.random() * 110; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 40; }
  c.putImageData(img, 0, 0);
  grainPat = ctx.createPattern(grainCv, 'repeat');
}
/* The battlefield is the painted sandbox (assets/map.webp, one world unit per pixel). ASSETS is filled by loadAssets() before the game starts. */
var ASSETS = { map: null, miniCv: null, tiles: null };
/* The map is cut into 512 px tiles at three scales (1, 1/2, 1/4) so a frame draws only the tiles in view, at a size near the zoom level;
   that keeps per-frame pixel work small on any renderer instead of scaling the whole 4K image every frame. */
var TILE = 512;
function buildTiles() {
  if (!ASSETS.map) return;
  var levels = [];
  [1, 0.5, 0.25].forEach(function (sc) {
    var ts = TILE * sc, nx = Math.ceil(MAP.W / TILE), ny = Math.ceil(MAP.H / TILE), tiles = [];
    for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) {
      var w = Math.min(TILE, MAP.W - i * TILE), h = Math.min(TILE, MAP.H - j * TILE);
      var c = document.createElement('canvas'); c.width = Math.ceil(w * sc); c.height = Math.ceil(h * sc);
      var x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      x.drawImage(ASSETS.map, i * TILE, j * TILE, w, h, 0, 0, c.width, c.height);
      tiles.push({ cv: c, x: i * TILE, y: j * TILE, w: w, h: h });
    }
    levels.push({ sc: sc, nx: nx, ny: ny, tiles: tiles });
  });
  ASSETS.tiles = levels;
}
function buildTerrain() {
  /* a small, radar-tinted copy of the map for the minimap */
  buildTiles();
  var mc = document.createElement('canvas'); mc.width = 440; mc.height = Math.round(440 * MAP.H / MAP.W);
  var c = mc.getContext('2d');
  if (ASSETS.map) { c.drawImage(ASSETS.map, 0, 0, mc.width, mc.height); c.globalCompositeOperation = 'saturation'; c.fillStyle = '#000'; c.fillRect(0, 0, mc.width, mc.height); c.globalCompositeOperation = 'multiply'; c.fillStyle = '#4FA85A'; c.fillRect(0, 0, mc.width, mc.height); c.globalCompositeOperation = 'source-over'; }
  else { c.fillStyle = '#1E4D22'; c.fillRect(0, 0, mc.width, mc.height); }
  ASSETS.miniCv = mc;
  return mc;
}
function drawTerrain(zoom) {
  if (!ASSETS.tiles) { if (ASSETS.map) ctx.drawImage(ASSETS.map, 0, 0, MAP.W, MAP.H); else { ctx.fillStyle = '#D9C086'; ctx.fillRect(0, 0, MAP.W, MAP.H); } return; }
  var z = zoom || cam.z, L = ASSETS.tiles[z > 0.7 ? 0 : z > 0.35 ? 1 : 2];
  var tl = s2w(0, 0), br = s2w(VW, VH), pad = 4;
  var i0 = Math.max(0, Math.floor(tl.x / TILE)), i1 = Math.min(L.nx - 1, Math.floor(br.x / TILE)), j0 = Math.max(0, Math.floor(tl.y / TILE)), j1 = Math.min(L.ny - 1, Math.floor(br.y / TILE));
  if (i0 > i1 || j0 > j1) return;
  for (var j = j0; j <= j1; j++) for (var i = i0; i <= i1; i++) { var t = L.tiles[j * L.nx + i]; ctx.drawImage(t.cv, t.x, t.y, t.w + (i < i1 ? 0.5 : 0), t.h + (j < j1 ? 0.5 : 0)); }
}
function camXf(shx, shy) { ctx.translate(viewCX() + shx, VH / 2 + shy); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y); }
function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#4C7A33'; ctx.fillRect(0, 0, VW, VH);
  if (!G) return;
  var shx = G.shake > 0 ? (Math.random() - 0.5) * G.shake * 2 : 0, shy = G.shake > 0 ? (Math.random() - 0.5) * G.shake * 2 : 0;
  var therm = G.thermal || 0;
  if (therm < 1) drawScene(shx, shy);
  if (therm > 0) thermalPass(therm, shx, shy);
  drawOverlays(shx, shy);
  postProcess();
  drawMini();
}
/* The world: terrain, props, structures, units, shots and effects. Draws through whatever `ctx` currently is (the screen, or the small thermal canvas). */
function drawScene(shx, shy, zoomHint) {
  ctx.save();
  camXf(shx, shy);
  ctx.imageSmoothingEnabled = true;
  drawTerrain(zoomHint || cam.z);
  [0, 1].forEach(function (t) { var fp = fountain(t); ctx.fillStyle = t === MYTEAM ? 'rgba(91,214,107,0.12)' : 'rgba(240,69,58,0.12)'; ell(ctx, fp.x, fp.y, 330, 330); ctx.fill(); });
  BRUSH.forEach(function (b, i) { drawThicket(b, i); });
  G.fx.forEach(function (f) { if (f.k === 'scorch' || f.k === 'glow' || f.k === 'castring') drawFx(f); });
  G.crates.forEach(function (c) { if (c.up) drawCrate(c.x, c.y); else { ctx.strokeStyle = 'rgba(20,19,15,0.4)'; ctx.setLineDash([4, 4]); ctx.strokeRect(c.x - 16, c.y - 16, 32, 32); ctx.setLineDash([]); } });
  G.mines.forEach(function (m) { if (m.team !== MYTEAM && m.arm <= 0 && dist(m, G.player) > 200) return; ctx.fillStyle = m.arm > 0 ? '#6B6B60' : '#3A3A30'; ell(ctx, m.x, m.y, 16, 8); ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#B4432E'; ell(ctx, m.x, m.y - 3, 3, 3); ctx.fill(); });
  G.lobs.forEach(function (l) { if (l.single) return; var p = Math.min(1, l.t / l.delay); ctx.strokeStyle = l.team === MYTEAM ? 'rgba(91,214,107,0.85)' : 'rgba(240,69,58,0.9)'; ctx.lineWidth = 3; ell(ctx, l.x, l.y, l.r, l.r * 0.6); ctx.stroke(); ctx.fillStyle = l.team === MYTEAM ? 'rgba(91,214,107,0.18)' : 'rgba(240,69,58,0.2)'; ell(ctx, l.x, l.y, l.r * p, l.r * 0.6 * p); ctx.fill(); });
  if (opts.ranges) {
    G.structs.forEach(function (s) { if (s.dead) return; ctx.strokeStyle = 'rgba(224,112,63,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ell(ctx, s.x, s.y, s.range, s.range); ctx.stroke(); ctx.setLineDash([]); });
    G.units.forEach(function (u) { if (u.kind !== 'hero' || u.dead) return; ctx.strokeStyle = u.team === MYTEAM ? 'rgba(91,214,107,0.5)' : 'rgba(240,69,58,0.5)'; ctx.lineWidth = 2; ell(ctx, u.x, u.y, aaRange(u), aaRange(u)); ctx.stroke(); });
  } else if (G.player && !G.player.dead) {
    G.structs.forEach(function (s) { if (s.dead || s.team === MYTEAM) return; var d = dist(s, G.player); if (d < s.range + 160) { ctx.strokeStyle = 'rgba(224,112,63,' + clamp((s.range + 160 - d) / 160, 0, 0.8) + ')'; ctx.lineWidth = 3; ctx.setLineDash([12, 8]); ell(ctx, s.x, s.y, s.range, s.range); ctx.stroke(); ctx.setLineDash([]); } });
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
  if (G.moveMark) {
    // move order marker: a bright green ring that pulses inward over a dark outline, with a centre dot, so it reads on bright sand
    var mm = G.moveMark, age = 1.2 - mm.t, ma = Math.min(1, mm.t / 0.3), pr = 1 - ((age * 2.2) % 1), col = mm.amove ? '255,120,60' : '120,255,110';
    ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(0,0,0,' + (0.6 * ma) + ')'; ell(ctx, mm.x, mm.y, 26, 13); ctx.stroke(); ell(ctx, mm.x, mm.y, 12 + 30 * pr, (12 + 30 * pr) * 0.5); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(' + col + ',' + ma + ')'; ell(ctx, mm.x, mm.y, 26, 13); ctx.stroke();
    ctx.strokeStyle = 'rgba(' + col + ',' + (ma * (1 - pr)) + ')'; ell(ctx, mm.x, mm.y, 12 + 30 * pr, (12 + 30 * pr) * 0.5); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,' + (0.7 * ma) + ')'; ell(ctx, mm.x, mm.y, 6, 4); ctx.fill(); ctx.fillStyle = 'rgba(' + col + ',' + ma + ')'; ell(ctx, mm.x, mm.y, 4, 2.5); ctx.fill();
    if (G.player && !G.player.dead) { ctx.setLineDash([8, 10]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(' + col + ',' + (0.5 * ma) + ')'; ctx.beginPath(); ctx.moveTo(G.player.x, G.player.y); ctx.lineTo(mm.x, mm.y); ctx.stroke(); ctx.setLineDash([]); }
  }
  if (aimSlot && G.player && !G.player.dead) drawAim(G.player, aimSlot);
  if (G.player && !G.player.dead && G.player.target) drawAttackArc(G.player);
  drawAimLines();
  var items = [];
  G.structs.forEach(function (s) { items.push({ y: s.y, f: function () { drawStruct(s); } }); });
  G.units.forEach(function (u) { if (u.dead && u.deathT > 1.4) return; if (!u.dead && !visibleTo(u, MYTEAM)) return; items.push({ y: u.y, f: function () { drawUnit(u); } }); });
  items.sort(function (a, b) { return a.y - b.y; });
  items.forEach(function (it) { it.f(); });
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
  ctx.restore();
}
/* Nameplates, health bars, target brackets, callouts and damage numbers: always crisp, drawn over the scene or the thermal feed. */
function drawOverlays(shx, shy) {
  ctx.save();
  camXf(shx, shy);
  G.structs.forEach(function (s) { if (!s.dead) bar(s.x, s.y - structTop(s), s.kind === 'hq' ? 170 : 110, 9, s.hp / s.maxHp, s.team, targetable(s) ? null : 'locked'); });
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
}
/* Thermal feed while reinforcing: the scene is downsampled, heat is painted onto bodies, shots and blasts, and every pixel is mapped through an ironbow palette (cold blue to white-hot). */
var THERM = { cv: null, x: null, lut: null, scan: null, seed: 1 };
function thermLut() {
  var stops = [[0, 2, 0, 12], [0.14, 14, 0, 58], [0.3, 76, 0, 138], [0.44, 158, 12, 118], [0.57, 212, 44, 40], [0.7, 246, 124, 18], [0.84, 255, 206, 48], [1, 255, 255, 255]];
  var L = new Uint8ClampedArray(256 * 3);
  for (var i = 0; i < 256; i++) {
    var v = i / 255, j = 1; while (j < stops.length - 1 && stops[j][0] < v) j++;
    var a = stops[j - 1], b = stops[j], f = clamp((v - a[0]) / (b[0] - a[0]), 0, 1);
    L[i * 3] = a[1] + (b[1] - a[1]) * f; L[i * 3 + 1] = a[2] + (b[2] - a[2]) * f; L[i * 3 + 2] = a[3] + (b[3] - a[3]) * f;
  }
  return L;
}
function thermalPass(amt, shx, shy) {
  var T = THERM;
  if (!T.lut) T.lut = thermLut();
  if (!T.cv) { T.cv = document.createElement('canvas'); T.x = T.cv.getContext('2d', { willReadFrequently: true }); }
  var sw = cv.width, sh = cv.height, s = Math.min(0.5, Math.sqrt(150000 / Math.max(1, sw * sh)));
  var tw = Math.max(16, Math.round(sw * s)), th = Math.max(16, Math.round(sh * s)), k = tw / VW;
  if (T.cv.width !== tw || T.cv.height !== th) { T.cv.width = tw; T.cv.height = th; }
  var main = ctx; ctx = T.x;
  ctx.setTransform(k, 0, 0, k, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = '#3A5A2A'; ctx.fillRect(0, 0, VW, VH);
  var _t0 = performance.now();
  drawScene(shx, shy, cam.z * k);
  if (T.prof) T.prof.scene = performance.now() - _t0;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = 'rgba(0,0,0,0.66)'; ctx.fillRect(0, 0, VW, VH);
  var x = ctx, z = cam.z;
  function blob(wx, wy, rx, ry, heat, cold) {
    if (heat <= 0.01) return;
    var p = w2s(wx, wy); rx = Math.max(1.5 / k, rx * z); ry = Math.max(1.5 / k, ry * z);
    if (p.x < -rx || p.y < -ry || p.x > VW + rx || p.y > VH + ry) return;
    x.save(); x.translate(p.x, p.y); x.scale(rx, ry);
    var g = x.createRadialGradient(0, 0, 0, 0, 0, 1), c = cold ? '0,0,0,' : '255,255,255,';
    g.addColorStop(0, 'rgba(' + c + heat + ')'); g.addColorStop(0.5, 'rgba(' + c + (heat * 0.55) + ')'); g.addColorStop(1, 'rgba(' + c + '0)');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, Math.PI * 2); x.fill(); x.restore();
  }
  if (G.barrage) G.barrage.beams.forEach(function (b) { if (b.x != null) blob(b.x, b.y, G.barrage.r, G.barrage.r * 0.65, 0.85, true); });
  x.globalCompositeOperation = 'lighter';
  G.structs.forEach(function (st) { if (st.dead) { blob(st.x, st.y - 30, st.r * 1.2, st.r * 0.8, 0.22); return; } blob(st.x, st.y - structTop(st) * 0.6, st.r * 0.8, st.r * 0.6, 0.34); });
  G.units.forEach(function (u) {
    if (u.dead ? (u.deathT || 0) > 1.4 : (!visibleTo(u, MYTEAM) || u._hidden)) return;
    var h = unitH(u), veh = u.type === 'tank' || u.type === 'jeep', heat = u.kind === 'hero' ? 1 : veh ? 0.92 : 0.8;
    if (u.dead) heat *= clamp(1 - (u.deathT || 0) / 1.4, 0, 1) * 0.9;
    if (u.dead || veh) { blob(u.x, u.y - h * 0.45, h * (veh ? 0.7 : 0.34), h * 0.5, heat); return; }
    // white-hot silhouette of the actual sculpt, with a soft bloom around it
    var sp = sprite(u.pose, u.team, h, u.facing < 0, true), p = w2s(u.x, u.y);
    x.save(); x.translate(p.x, p.y); x.scale(z, z); x.globalAlpha = heat * 0.95; x.drawImage(sp.cv, sp.ox, sp.oy, sp.w, sp.h); x.restore(); x.globalAlpha = 1;
    blob(u.x, u.y - h * 0.45, h * 0.42, h * 0.58, heat * 0.4);
  });
  G.rounds.forEach(function (r) { blob(r.x, r.y, 9, 9, 1); });
  G.proj.forEach(function (p) { blob(p.x, p.y, p.kind === 'rocket' ? 22 : 12, p.kind === 'rocket' ? 22 : 12, 1); });
  G.fx.forEach(function (f) {
    var life = clamp(1 - f.t / f.dur, 0, 1);
    if (f.k === 'boom') blob(f.x, f.y - 10, f.r * (0.6 + 0.6 * (1 - life)), f.r * (0.45 + 0.4 * (1 - life)), life);
    else if (f.k === 'muzzle') blob(f.x, f.y, 26, 26, life);
    else if (f.k === 'scorch') blob(f.x, f.y, f.r, f.r * 0.6, 0.35 * life);
    else if (f.k === 'flame' || f.k === 'cone') blob(f.x, f.y, 40, 30, 0.9 * life);
    else if (f.k === 'impact') blob(f.x, f.y, 14, 14, 0.8 * life);
  });
  x.globalCompositeOperation = 'source-over';
  ctx = main;
  if (T.prof) { T.prof.blobs = performance.now() - _t0 - T.prof.scene; _t0 = performance.now(); }
  var img = x.getImageData(0, 0, tw, th), d = img.data, L = T.lut, n = d.length, seed = T.seed | 0;
  for (var i = 0; i < n; i += 4) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    var lum = ((d[i] * 77 + d[i + 1] * 151 + d[i + 2] * 28) >> 8) + ((seed & 15) - 7);
    lum = lum < 0 ? 0 : lum > 255 ? 255 : lum;
    var j = lum * 3; d[i] = L[j]; d[i + 1] = L[j + 1]; d[i + 2] = L[j + 2];
  }
  T.seed = seed || 1;
  x.putImageData(img, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = amt; ctx.imageSmoothingEnabled = true;
  ctx.drawImage(T.cv, 0, 0, sw, sh);
  ctx.globalAlpha = 1; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (T.prof) T.prof.map = performance.now() - _t0;
}
var postCache = {};
function postProcess() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  var therm = (G && G.thermal) || 0;
  if (therm > 0 && opts.grain !== false) {
    // sensor noise on the thermal feed only; the sunny scene is left as painted (full-screen blend modes are slow on some browsers)
    var ox = -Math.floor(Math.random() * 192), oy = -Math.floor(Math.random() * 192);
    ctx.globalAlpha = therm * 0.6; ctx.save(); ctx.translate(ox, oy); ctx.fillStyle = grainPat; ctx.fillRect(-ox, -oy, VW + 192, VH + 192); ctx.restore(); ctx.globalAlpha = 1;
  }
  var cx = viewCX(), cy = VH / 2;
  if (therm > 0) {
    if (!THERM.scan) { THERM.scan = document.createElement('canvas'); THERM.scan.width = 4; THERM.scan.height = 3; var sc = THERM.scan.getContext('2d'); sc.fillStyle = 'rgba(0,0,0,0.5)'; sc.fillRect(0, 2, 4, 1); }
    ctx.globalAlpha = therm * 0.7; ctx.fillStyle = ctx.createPattern(THERM.scan, 'repeat'); ctx.fillRect(0, 0, VW, VH);
    ctx.globalAlpha = therm * (0.02 + Math.random() * 0.03); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, VW, VH);
    ctx.globalAlpha = 1;
    var tg = ctx.createRadialGradient(cx, cy, Math.min(VW, VH) * 0.3, cx, cy, Math.max(VW, VH) * 0.72);
    tg.addColorStop(0, 'rgba(0,0,0,0)'); tg.addColorStop(1, 'rgba(0,0,0,' + (0.55 * therm) + ')');
    ctx.fillStyle = tg; ctx.fillRect(0, 0, VW, VH);
    var m = 18, len = 34; ctx.strokeStyle = 'rgba(255,255,255,' + (0.55 * therm) + ')'; ctx.lineWidth = 2;
    [[m, m, 1, 1], [VW - m, m, -1, 1], [m, VH - m, 1, -1], [VW - m, VH - m, -1, -1]].forEach(function (c) { ctx.beginPath(); ctx.moveTo(c[0], c[1] + c[3] * len); ctx.lineTo(c[0], c[1]); ctx.lineTo(c[0] + c[2] * len, c[1]); ctx.stroke(); });
  }
  if (!postCache.vg || postCache.w !== VW || postCache.h !== VH) { postCache.w = VW; postCache.h = VH; postCache.vg = ctx.createRadialGradient(cx, cy, Math.min(VW, VH) * 0.45, cx, cy, Math.max(VW, VH) * 0.8); postCache.vg.addColorStop(0, 'rgba(10,12,8,0)'); postCache.vg.addColorStop(1, 'rgba(10,12,8,0.3)'); }
  ctx.fillStyle = postCache.vg; ctx.fillRect(0, 0, VW, VH);
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
function drawThicket(b, i) {
  var inside = G.player && !G.player.dead && inBrush(G.player) === i;
  ctx.save(); ctx.translate(b.x, b.y);
  var g = ctx.createRadialGradient(0, 0, 0, 0, 0, b.rx);
  g.addColorStop(0, inside ? 'rgba(120,220,90,0.22)' : 'rgba(90,190,70,0.16)'); g.addColorStop(1, 'rgba(90,190,70,0)');
  ctx.save(); ctx.scale(1, b.ry / b.rx); ctx.fillStyle = g; ell(ctx, 0, 0, b.rx, b.rx); ctx.fill(); ctx.restore();
  ctx.strokeStyle = inside ? 'rgba(200,255,170,0.9)' : 'rgba(150,230,110,0.45)'; ctx.lineWidth = inside ? 3 : 2; ctx.setLineDash([10, 8]); ell(ctx, 0, 0, b.rx, b.ry); ctx.stroke(); ctx.setLineDash([]);
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
  if (s.kind === 'outpost') {
    drawPillbox(s, C, dead, rec);
  } else {
    // the painted fort is the HQ: smoke, scorch and a flag when alive; rubble tint and a toppled flag when it falls
    if (!dead) {
      if (s.flashT > 0) { ctx.globalAlpha = s.flashT / 0.08 * 0.35; ctx.fillStyle = '#fff'; ell(ctx, 0, -40, 130, 90); ctx.fill(); ctx.globalAlpha = 1; }
      var hpf = s.hp / s.maxHp;
      if (hpf < 0.6) { ctx.fillStyle = 'rgba(40,30,20,' + (0.35 * (1 - hpf)) + ')'; ell(ctx, 0, -20, 120, 70); ctx.fill(); }
    } else {
      ctx.fillStyle = 'rgba(30,22,14,0.55)'; ell(ctx, 0, -20, 150, 90); ctx.fill();
      ctx.strokeStyle = '#2A2118'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-90, -70); ctx.lineTo(60, 40); ctx.moveTo(-40, 50); ctx.lineTo(80, -60); ctx.stroke();
      ctx.fillStyle = '#F5F5F5'; ctx.font = '400 18px Russo One, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('FORT FALLEN', 0, -110);
    }
  }
  ctx.restore();
}
/* Turret: a pillbox. Painted towers and nests get only a gun, pennant and damage drawn over the painting; other slots get a drawn sandbag nest. */
function structTop(s) { return s.kind === 'hq' ? 190 : s.painted === 'tower' ? 165 : s.painted === 'nest' ? 95 : 110; }
function drawPillbox(s, C, dead, rec) {
  var top = s.painted === 'tower' ? -118 : s.painted === 'nest' ? -46 : -58, team = s.team;
  if (!s.painted) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ell(ctx, 6, 8, 78, 34); ctx.fill();
    ctx.fillStyle = dead ? '#B9A070' : '#D7BE82'; ell(ctx, 0, 0, 66, 30); ctx.fill();
    for (var i = 0; i < 14; i++) { var a = i / 14 * Math.PI * 2, bx = Math.cos(a) * 62, by = Math.sin(a) * 27 - 6; ctx.fillStyle = dead ? '#A8906A' : (i % 2 ? '#E2CB92' : '#D2B77C'); ell(ctx, bx, by, 15, 9); ctx.fill(); ctx.strokeStyle = '#4A3A22'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.fillStyle = dead ? '#3A3A30' : C.c2; ctx.strokeStyle = '#141A0B'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-30, -14); ctx.lineTo(30, -14); ctx.lineTo(30, -50); ctx.lineTo(-30, -50); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = dead ? '#4A4A40' : C.c1; ell(ctx, 0, -50, 30, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#0B0D10'; ctx.fillRect(-18, -36, 36, 8);
  }
  if (!dead) {
    // gun on top, swung toward the target
    var tg = s.target && !s.target.dead ? s.target : null, ang = tg ? Math.atan2(tg.y - (s.y + top), tg.x - s.x) : (team === 0 ? -0.6 : Math.PI + 0.6);
    ctx.save(); ctx.translate(0, top); ctx.rotate(ang);
    ctx.fillStyle = '#23262B'; ctx.strokeStyle = '#0A0B0D'; ctx.lineWidth = 2;
    rrect(ctx, -16 - rec, -9, 30, 18, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.c2; rrect(ctx, 12 - rec, -5, 44, 10, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#0A0B0D'; ell(ctx, 56 - rec, 0, 4, 5); ctx.fill();
    ctx.restore();
    // pennant
    ctx.strokeStyle = '#2A2118'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(22, top - 6); ctx.lineTo(22, top - 58); ctx.stroke();
    ctx.fillStyle = team === 0 ? '#3FBF55' : '#E8342A'; ctx.beginPath(); ctx.moveTo(23, top - 58); ctx.lineTo(50, top - 48); ctx.lineTo(23, top - 38); ctx.closePath(); ctx.fill();
    if (s.flashT > 0) { ctx.globalAlpha = s.flashT / 0.08 * 0.55; ctx.fillStyle = '#fff'; ell(ctx, 0, top * 0.5, 70, 60); ctx.fill(); ctx.globalAlpha = 1; }
    var hpf = s.hp / s.maxHp; if (hpf < 0.5) { ctx.fillStyle = 'rgba(40,30,20,' + (0.45 * (1 - hpf)) + ')'; ell(ctx, 0, top * 0.4, 60, 40); ctx.fill(); }
  } else {
    ctx.fillStyle = 'rgba(30,22,14,0.55)'; ell(ctx, 0, top * 0.4, 72, 44); ctx.fill();
    ctx.strokeStyle = '#2A2118'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-40, top * 0.3 - 30); ctx.lineTo(30, top * 0.3 + 20); ctx.moveTo(-20, top * 0.3 + 24); ctx.lineTo(36, top * 0.3 - 28); ctx.stroke();
    ctx.fillStyle = '#4A3A22'; [[-30, 8], [10, 16], [34, -2], [-6, -8]].forEach(function (p) { ell(ctx, p[0], p[1] + top * 0.6, 10, 6); ctx.fill(); });
  }
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
    ctx.drawImage(sp.cv, sp.ox, sp.oy, sp.w, sp.h);
    if (u.flashT > 0 && !u.dead) { var fs = sprite(u.pose, u.team, h, u.facing < 0, true); ctx.globalAlpha = alpha * (u.flashT / 0.08) * 0.85; ctx.drawImage(fs.cv, sp.ox, sp.oy, sp.w, sp.h); ctx.globalAlpha = alpha; }
  }
  if (u.shield > 0 && !u.dead) { ctx.strokeStyle = 'rgba(214,203,170,0.7)'; ctx.lineWidth = 3; ell(ctx, 0, -h * 0.45, 40, h * 0.6); ctx.stroke(); }
  if (u.burnT > 0 && !u.dead && Math.random() < 0.4) addFx({ k: 'flame', x: u.x + rnd(-12, 12), y: u.y - rnd(10, 60), t: 0, dur: 0.3 });
  if (u.tagMark && !u.dead) { ctx.fillStyle = '#E0703F'; ell(ctx, 0, -h - 34, 5, 5); ctx.fill(); }
  ctx.restore();
  if (u.slowT > 0 && !u.dead) { ctx.fillStyle = 'rgba(120,170,230,0.45)'; ell(ctx, u.x, u.y + 2, 26, 9); ctx.fill(); }
}
function drawVehicle(u) {
  var C = TEAMC[u.team], f = u.facing;
  var art = heroArt('m_' + u.type, u.team);
  if (art) {
    // illustrated toy vehicle: about as long as a soldier is tall
    var vw = u.type === 'tank' ? 150 : 140, vh = vw * art.height / art.width, sp = sprite('m_' + u.type, u.team, vh, f < 0, false);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ell(ctx, 0, 6, vw * 0.48, vw * 0.16); ctx.fill();
    if (u.dead) ctx.globalAlpha *= 0.85;
    ctx.drawImage(sp.cv, sp.ox, sp.oy + 2, sp.w, sp.h);
    if (u.dead) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(20,16,10,0.55)'; ctx.fillRect(sp.ox, sp.oy, sp.w, sp.h); ctx.globalCompositeOperation = 'source-over'; }
    if (u.flashT > 0 && !u.dead) { var fs = sprite('m_' + u.type, u.team, vh, f < 0, true); ctx.globalAlpha = u.flashT / 0.08 * 0.7; ctx.drawImage(fs.cv, sp.ox, sp.oy + 2, sp.w, sp.h); ctx.globalAlpha = 1; }
    if (u.dead && Math.random() < 0.3) addFx({ k: 'smoke', x: u.x + rnd(-10, 10), y: u.y - 30, t: 0, dur: 1.2, big: 1 });
    ctx.restore(); return;
  }
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
  if (ASSETS.miniCv) { mctx.globalAlpha = 0.9; mctx.drawImage(ASSETS.miniCv, 0, 0, W, H); mctx.globalAlpha = 1; }
  mctx.save(); mctx.scale(sx, sy);
  BRUSH.forEach(function (b) { mctx.fillStyle = 'rgba(120,230,90,0.35)'; ell(mctx, b.x, b.y, b.rx, b.ry); mctx.fill(); });
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
