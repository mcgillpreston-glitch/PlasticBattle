/* Browser only: plastic soldier sculpts and sprite cache. */
/* ---------------- Plastic soldier sculpts (weathered) ---------------- */
var POSES = {
  pointman: { h:[100,38], n:[100,58], p:[98,118], legs:[[[88,160],[84,206],[98,210]],[[110,160],[116,206],[130,210]]], arms:[[[120,82],[130,72]],[[132,90],[150,80]]], ex:[[84,74,178,62,3.5],[178,62,194,59,1.6]] },
  kneeler: { h:[96,78], n:[96,96], p:[92,148], legs:[[[122,150],[124,206],[138,210]],[[90,204],[58,204],[50,198]]], arms:[[[116,112],[122,100]],[[130,118],[148,106]]], ex:[[80,108,176,96,3.5],[176,96,192,93,1.6]] },
  sniper: { h:[150,180], n:[138,186], p:[80,196], tr:13, hr:12, legs:[[[52,200],[24,204],[16,198]],[[52,207],[26,211],[18,206]]], arms:[[[150,206],[164,192]],[[160,208],[176,196]]], ex:[[140,190,196,186,3],[150,181,168,181,3.2]] },
  bazooka: { h:[96,42], n:[96,62], p:[96,120], legs:[[[84,162],[80,206],[94,210]],[[108,162],[114,206],[128,210]]], arms:[[[116,92],[112,74]],[[80,88],[86,72]]], ex:[[34,60,172,60,10],[172,60,180,60,12]] },
  grenadier: { h:[98,42], n:[98,62], p:[100,120], legs:[[[76,160],[64,206],[78,210]],[[122,158],[132,206],[146,210]]], arms:[[[74,58],[66,36]],[[122,82],[142,86]]], ci:[[64,28,7.5]] },
  radioman: { h:[100,40], n:[100,60], p:[100,118], legs:[[[92,162],[90,206],[104,210]],[[108,162],[112,206],[126,210]]], arms:[[[116,84],[110,48]],[[110,92],[118,118]]], ex:[[78,64,78,104,14],[74,58,62,8,1.6],[108,46,112,54,4]] },
  flamer: { h:[98,42], n:[98,62], p:[98,120], legs:[[[84,162],[74,206],[88,210]],[[116,160],[122,206],[136,210]]], arms:[[[114,96],[126,104]],[[124,90],[138,92]]], ex:[[76,64,76,112,9],[86,66,86,112,9],[110,104,178,90,4],[178,90,186,88,5.5]] },
  sweeper: { h:[96,42], n:[96,62], p:[96,120], legs:[[[86,162],[76,206],[90,210]],[[112,160],[118,204],[132,206]]], arms:[[[112,90],[124,104]],[[106,96],[120,110]]], ex:[[120,106,170,196,2.5],[160,201,192,201,5.5]] },
  mortar: { h:[80,88], n:[84,106], p:[80,154], legs:[[[108,150],[100,206],[114,210]],[[64,178],[56,206],[68,210]]], arms:[[[104,128],[124,120]],[[98,134],[116,140]]], ex:[[128,206,158,128,8],[148,160,172,206,2],[116,208,146,208,4]], ci:[[131,116,6.5]] },
  officer: { h:[98,40], n:[98,60], p:[98,118], legs:[[[88,162],[84,206],[98,210]],[[110,162],[118,206],[132,210]]], arms:[[[130,64],[160,58]],[[80,48],[74,24]]], ex:[[156,53,178,53,3.5],[162,55,160,66,2.6],[98,78,112,78,5]] },
  gunner: { h:[142,178], n:[130,186], p:[76,196], tr:13, hr:12, legs:[[[50,200],[22,204],[14,198]],[[50,207],[24,211],[16,206]]], arms:[[[144,204],[158,190]],[[152,206],[166,194]]], ex:[[126,188,184,184,5.5],[184,184,198,183,2],[174,187,166,209,1.6],[174,187,184,209,1.6]] },
  charger: { h:[112,46], n:[106,66], p:[92,120], legs:[[[118,150],[112,186],[126,194]],[[76,160],[58,202],[72,210]]], arms:[[[120,96],[134,104]],[[114,102],[148,94]]], ex:[[100,112,176,86,3.5],[176,86,194,79,1.6]] },
  para: { h:[100,62], n:[100,82], p:[100,140], legs:[[[94,178],[92,206],[100,211]],[[106,178],[110,206],[118,211]]], arms:[[[84,60],[80,32]],[[116,60],[120,32]]], ex:[[80,32,58,4,2],[120,32,142,4,2],[92,96,108,96,6]] },
  scout: { h:[100,40], n:[100,60], p:[100,118], legs:[[[90,162],[86,206],[100,210]],[[110,162],[116,206],[130,210]]], arms:[[[120,74],[114,46]],[[86,74],[106,48]]], ex:[[104,41,122,41,5.5],[78,70,108,126,2.6]] },
  shotgun: { h:[94,46], n:[94,66], p:[96,122], legs:[[[74,160],[66,206],[80,210]],[[120,160],[128,206],[142,210]]], arms:[[[102,100],[118,106]],[[118,94],[140,96]]], ex:[[94,111,174,94,3.8],[138,99,154,96,4.5]] },
  commando: { h:[92,72], n:[94,92], p:[92,144], legs:[[[120,142],[116,206],[130,210]],[[70,172],[62,206],[76,210]]], arms:[[[112,116],[128,110]],[[76,80],[72,54]]], ex:[[106,115,152,108,4.2],[128,112,126,128,3],[72,54,74,30,2.2]] }
};

function r1(x) { return Math.round(x * 10) / 10; }
function circP(c, r) { return 'M' + r1(c[0] - r) + ',' + r1(c[1]) + 'a' + r + ',' + r + ' 0 1 0 ' + r1(2 * r) + ',0a' + r + ',' + r + ' 0 1 0 ' + r1(-2 * r) + ',0Z'; }
function capP(a, b, r) {
  var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.sqrt(dx * dx + dy * dy);
  if (L < 0.5) return circP(a, r);
  var nx = -dy / L * r, ny = dx / L * r;
  return 'M' + r1(a[0] + nx) + ',' + r1(a[1] + ny) + 'L' + r1(b[0] + nx) + ',' + r1(b[1] + ny) +
    'A' + r + ',' + r + ' 0 0 0 ' + r1(b[0] - nx) + ',' + r1(b[1] - ny) + 'L' + r1(a[0] - nx) + ',' + r1(a[1] - ny) +
    'A' + r + ',' + r + ' 0 0 0 ' + r1(a[0] + nx) + ',' + r1(a[1] + ny) + 'Z';
}
var poseCache = {};
var POSE_ALIAS = { m_melee: 'charger', m_rifle: 'pointman', m_mortar: 'mortar' };
function posePaths(key) {
  key = POSE_ALIAS[key] || key;
  if (poseCache[key]) return poseCache[key];
  var P = POSES[key] || POSES.pointman, tr = P.tr || 16, hr = P.hr || 13, d = '', low = [];
  function note(pt) { if (pt[1] > 192) low.push(pt[0]); }
  d += capP(P.n, P.p, tr);
  P.legs.forEach(function (L) { d += capP(P.p, L[0], 9.5) + capP(L[0], L[1], 8) + capP(L[1], L[2], 5.5); note(L[0]); note(L[1]); note(L[2]); });
  var sh = [P.n[0], P.n[1] + 6];
  P.arms.forEach(function (A) { d += capP(sh, A[0], 6.5) + capP(A[0], A[1], 5.5) + circP(A[1], 5); note(A[0]); });
  (P.ex || []).forEach(function (e) { d += capP([e[0], e[1]], [e[2], e[3]], e[4]); note([e[0], e[1]]); note([e[2], e[3]]); });
  (P.ci || []).forEach(function (c) { d += circP([c[0], c[1]], c[2]); });
  var hx = P.h[0], hy = P.h[1];
  d += circP(P.h, hr);
  d += 'M' + r1(hx + hr + 2) + ',' + r1(hy + 1) + 'A' + (hr + 2) + ',' + (hr + 2) + ' 0 0 0 ' + r1(hx - hr - 2) + ',' + r1(hy + 1) + 'Z';
  d += capP([hx - hr - 4, hy + 2], [hx + hr + 4, hy + 2], 2.5);
  if (!low.length) low = [80, 120];
  var x0 = Math.max(4, Math.min.apply(null, low) - 16), x1 = Math.min(196, Math.max.apply(null, low) + 16), mid = (x0 + x1) / 2;
  var out = {
    body: new Path2D(d),
    base: new Path2D('M' + r1(x0) + ',212Q' + r1(mid) + ',207 ' + r1(x1) + ',212L' + r1(x1 + 4) + ',223Q' + r1(mid) + ',226 ' + r1(x0 - 4) + ',223Z'),
    baseTop: new Path2D('M' + r1(x0 + 2) + ',212.5Q' + r1(mid) + ',208.5 ' + r1(x1 - 2) + ',212.5L' + r1(x1 - 4) + ',215Q' + r1(mid) + ',212 ' + r1(x0 + 4) + ',215Z'),
    shine: new Path2D('M' + r1(hx - hr + 2) + ',' + r1(hy - 2) + 'A' + (hr - 2) + ',' + (hr - 2) + ' 0 0 1 ' + r1(hx - 1) + ',' + r1(hy - hr) + 'L' + r1(hx - 2) + ',' + r1(hy - hr + 4) + 'A' + (hr - 6) + ',' + (hr - 6) + ' 0 0 0 ' + r1(hx - hr + 6) + ',' + r1(hy - 1) + 'Z'),
    mid: mid, half: (x1 - x0) / 2
  };
  poseCache[key] = out;
  return out;
}
function paintPose(ctx, key, team, flip, flash) {
  var art = heroArt(key, team);
  if (art) {
    // fit the illustration into the 200x240 figure box, standing on its bottom edge
    var fw = 200, fh = 240, k = Math.min(fw / art.width, fh / art.height), dw = art.width * k, dh2 = art.height * k;
    ctx.save(); if (flip) { ctx.translate(200, 0); ctx.scale(-1, 1); }
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(art, (fw - dw) / 2, fh - dh2, dw, dh2);
    if (flash) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, fw, fh); }
    ctx.restore(); return;
  }
  var p = posePaths(key), C = TEAMC[team];
  ctx.save();
  if (flip) { ctx.translate(200, 0); ctx.scale(-1, 1); }
  if (flash) { ctx.fillStyle = '#FFFFFF'; ctx.fill(p.base); ctx.fill(p.body); ctx.restore(); return; }
  var g = ctx.createLinearGradient(0, 0, 200, 240);
  g.addColorStop(0, C.c1); g.addColorStop(0.45, C.c2); g.addColorStop(1, C.c3);
  ctx.fillStyle = C.c3; ctx.strokeStyle = C.ol; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  ctx.fill(p.base); ctx.stroke(p.base);
  ctx.fillStyle = C.c2; ctx.fill(p.baseTop);
  ctx.fillStyle = C.ol; ctx.strokeStyle = C.ol; ctx.lineWidth = 5; ctx.fill(p.body); ctx.stroke(p.body);
  ctx.fillStyle = g; ctx.fill(p.body);
  ctx.fillStyle = 'rgba(110,95,70,0.14)'; ctx.fill(p.body);
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1; ctx.stroke(p.body);
  ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill(p.shine);
  paintGear(ctx, key, C);
  ctx.restore();
}

/* Modern operator gear and weapons, drawn over the one-piece plastic body. */
var WPN = { pointman: 'carbine', kneeler: 'dmr', sniper: 'sniper', bazooka: 'launcher', grenadier: 'gl', radioman: 'radio', flamer: 'flame', sweeper: 'detector',
  mortar: 'mortar', officer: 'pistol', gunner: 'lmg', charger: 'breacher', para: 'carbine', scout: 'carbine', shotgun: 'shotgun', commando: 'smg' };
var GUN = { fill: '#23262B', edge: '#0A0B0D', hi: 'rgba(255,255,255,0.22)' };
function gearRect(ctx, cx, cy, ang, w, h, r, fill, edge) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(-w / 2 + r, -h / 2); ctx.lineTo(w / 2 - r, -h / 2); ctx.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); ctx.lineTo(w / 2, h / 2 - r); ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); ctx.lineTo(-w / 2 + r, h / 2); ctx.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); ctx.lineTo(-w / 2, -h / 2 + r); ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.stroke(); }
  ctx.restore();
}
function drawGun(ctx, a, b, kind) {
  var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.sqrt(dx * dx + dy * dy); if (L < 4) return;
  var ang = Math.atan2(dy, dx), ux = dx / L, uy = dy / L, px = -uy, py = ux;
  if (py < 0) { px = -px; py = -py; }
  function at(t, off) { return [a[0] + ux * L * t + px * off, a[1] + uy * L * t + py * off]; }
  function seg(t0, t1, off, w, fill) { var m = at((t0 + t1) / 2, off); gearRect(ctx, m[0], m[1], ang, L * (t1 - t0), w, Math.min(3, w / 2), fill, GUN.edge); }
  var big = kind === 'lmg' || kind === 'sniper' || kind === 'dmr';
  if (kind === 'pistol') { seg(0, 1, 0, 7, GUN.fill); var g = at(0.3, 5); gearRect(ctx, g[0], g[1], ang + 1.2, 10, 5, 2, GUN.fill, GUN.edge); return; }
  if (kind === 'launcher') { seg(0, 1, 0, 13, GUN.fill); seg(0.86, 1.02, 0, 17, GUN.fill); seg(-0.02, 0.12, 0, 16, GUN.fill); var s = at(0.55, -10); gearRect(ctx, s[0], s[1], ang, 10, 7, 2, GUN.fill, GUN.edge); seg(0.3, 0.5, 0, 14, '#2E3238'); return; }
  if (kind === 'mortar') { seg(0, 1, 0, 11, GUN.fill); seg(0.92, 1.04, 0, 14, GUN.fill); return; }
  if (kind === 'detector') { seg(0, 1, 0, 3.5, GUN.fill); return; }
  if (kind === 'flame') { seg(0, 1, 0, 6, GUN.fill); seg(0.85, 1.05, 0, 9, '#3A2C1E'); return; }
  // rifles, carbines, SMGs, shotguns, LMG
  var bw = big ? 4.2 : 3.4;
  seg(0.55, 1.0, 0, bw, GUN.fill);                       // barrel
  seg(0.0, 0.3, 0, big ? 8 : 7, GUN.fill);               // stock
  seg(0.28, 0.6, 0, big ? 12 : 10, GUN.fill);            // receiver
  if (kind !== 'shotgun') { var m = at(0.46, kind === 'lmg' ? 9 : 10); gearRect(ctx, m[0], m[1], ang + (kind === 'lmg' ? 0 : 0.25), kind === 'lmg' ? 16 : 7, kind === 'lmg' ? 11 : kind === 'smg' ? 16 : 13, 2, GUN.fill, GUN.edge); }
  else seg(0.5, 0.95, 4, 4, GUN.fill);                   // tube magazine
  if (kind === 'sniper' || kind === 'dmr') { var sc = at(0.45, -8); gearRect(ctx, sc[0], sc[1], ang, kind === 'sniper' ? 22 : 15, 6, 3, GUN.fill, GUN.edge); }
  else { var o = at(0.44, -7); gearRect(ctx, o[0], o[1], ang, 8, 5, 1.5, GUN.fill, GUN.edge); }
  if (kind === 'carbine' || kind === 'smg' || kind === 'dmr') seg(0.88, 1.04, 0, bw + 2.6, GUN.fill);   // suppressor
  if (kind === 'gl') { seg(0.5, 0.86, 5.5, 6, '#2E3238'); }
  if (kind === 'breacher') { seg(0.92, 1.12, 0, 4, '#B9BCC2'); }
  var h = at(0.62, -1.5); ctx.strokeStyle = GUN.hi; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(h[0] - ux * L * 0.18, h[1] - uy * L * 0.18); ctx.lineTo(h[0] + ux * L * 0.3, h[1] + uy * L * 0.3); ctx.stroke();
}
function paintGear(ctx, key, C) {
  var P = POSES[key] || POSES.pointman, hr = P.hr || 13, tr = P.tr || 16, kind = WPN[key] || 'carbine';
  var gear = C.c3, edge = C.ol;
  // plate carrier along the torso
  var nx = P.n[0], ny = P.n[1], qx = P.p[0], qy = P.p[1], tl = Math.sqrt((qx - nx) * (qx - nx) + (qy - ny) * (qy - ny)), ta = Math.atan2(qy - ny, qx - nx) - Math.PI / 2;
  var cx = (nx + qx) / 2, cy = (ny + qy) / 2;
  gearRect(ctx, cx, cy, ta, tr * 1.9, tl * 0.78, 5, gear, edge);
  var sx = Math.cos(ta + Math.PI / 2), sy = Math.sin(ta + Math.PI / 2);
  for (var i = -1; i <= 1; i++) gearRect(ctx, cx + Math.cos(ta) * i * tr * 0.55 + sx * tl * 0.22, cy + Math.sin(ta) * i * tr * 0.55 + sy * tl * 0.22, ta, tr * 0.42, tl * 0.2, 2, C.c2, edge);
  gearRect(ctx, cx - sx * tl * 0.3, cy - sy * tl * 0.3, ta, tr * 1.6, 4, 2, edge, null);
  // knee pads and boots
  P.legs.forEach(function (Lg) { ctx.fillStyle = gear; ctx.beginPath(); ctx.arc(Lg[1][0], Lg[1][1], 7, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.stroke(); });
  // helmet: high-cut dome with brim rail and NVG mount
  var hx = P.h[0], hy = P.h[1];
  ctx.fillStyle = gear; ctx.strokeStyle = edge; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(hx, hy + 1, hr + 2.5, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  gearRect(ctx, hx, hy + 2, 0, hr * 2 + 7, 4, 2, gear, edge);
  gearRect(ctx, hx + hr * 0.5, hy - hr - 1, 0, 8, 6, 1.5, GUN.fill, GUN.edge);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(hx - 3, hy - 4, hr * 0.55, Math.PI * 1.1, Math.PI * 1.7); ctx.lineTo(hx - 3, hy - 4); ctx.closePath(); ctx.fill();
  // weapon overlay
  var ex = P.ex || [], w = null;
  if (kind === 'gl') { var A = P.arms[1]; w = [[A[0][0] - 20, A[0][1] - 2], [A[1][0] + 14, A[1][1] - 4]]; }
  else if (kind === 'radio') { var R = P.arms[1]; w = [[R[0][0] - 24, R[0][1] + 10], [R[1][0] + 16, R[1][1] + 2]]; kind = 'carbine'; }
  else if (key === 'scout' && ex[1]) w = [[ex[1][0], ex[1][1]], [ex[1][2], ex[1][3]]];
  else if (key === 'para') w = [[P.p[0] - 22, P.p[1] - 6], [P.p[0] + 26, P.p[1] - 14]];
  else if (ex[0]) w = [[ex[0][0], ex[0][1]], [ex[0][2], ex[0][3]]];
  if (w) drawGun(ctx, w[0], w[1], kind);
  if (key === 'flamer' && ex[2]) drawGun(ctx, [ex[2][0], ex[2][1]], [ex[2][2], ex[2][3]], 'flame');
  if (key === 'sweeper' && ex[1]) { ctx.fillStyle = GUN.fill; ctx.strokeStyle = GUN.edge; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(ex[1][2] - 6, ex[1][3], 15, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
}
/* Illustrated soldiers: assets/heroes/<key>.png (green plastic) and assets/heroes/tan/<key>.png (tan plastic), likewise assets/minions/.
   If a tan illustration is missing, the green one is recoloured to tan plastic at load. A sprite is drawn with its base plate at the
   unit's feet; HSCALE sets how tall each figure stands relative to a standing soldier. */
var HERO_ART = {}, HERO_ANIM = {}, HSCALE = { sniper: 0.5, para: 1.3, mortar: 0.95, kneeler: 0.9, m_mortar: 0.9, m_tank: 1, m_jeep: 1 };
function loadHeroArt(img) {
  function pair(key, base) {
    img(base + '.png', function (im) { if (im) { var a = HERO_ART[key] || (HERO_ART[key] = { img: null, tan: null }); a.img = im; } });
    img(base.replace(/\/([^\/]*)$/, '/tan/$1') + '.png', function (im) { if (im) { var a = HERO_ART[key] || (HERO_ART[key] = { img: null, tan: null }); a.tan = im; } });
  }
  HEROES.forEach(function (hs) { pair(hs.key, 'assets/heroes/' + hs.key); });
  var AF = typeof ANIM_FRAMES === 'object' ? ANIM_FRAMES : {};
  Object.keys(AF).forEach(function (key) { Object.keys(AF[key]).forEach(function (slot) { for (var n = 1; n <= AF[key][slot]; n++) (function (n) {
    var nm = key + '_' + slot + '_' + n, h = HERO_ANIM[key] || (HERO_ANIM[key] = {}), f = h[slot] || (h[slot] = []), fr = f[n - 1] || (f[n - 1] = { img: null, tan: null });
    img('assets/heroes/anim/' + nm + '.webp', function (im) { if (im) fr.img = im; });
    // tan frames are colour-matched to the hand-made tan figure offline (tools/prep-anim.py); without one, the runtime recolour is used
    if (typeof ANIM_TAN === 'object' && ANIM_TAN[nm]) img('assets/heroes/tan/anim/' + nm + '.webp', function (im) { if (im) fr.tan = im; });
  })(n); }); });
  ['melee', 'rifle', 'mortar', 'tank', 'jeep'].forEach(function (k) { pair('m_' + k, 'assets/minions/' + k); });
}
function tanify(im) {
  var cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
  var c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(im, 0, 0);
  var d;
  try { d = c.getImageData(0, 0, cv.width, cv.height); }
  catch (e) { c.clearRect(0, 0, cv.width, cv.height); c.filter = 'sepia(1) saturate(1.3) brightness(1.08)'; c.drawImage(im, 0, 0); return cv; }
  var px = d.data;
  // dark olive outlines stay dark; plastic greens become tan: shadows #6B5330, mid #B99A62, highlights #EADCB0
  for (var i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 8) continue;
    var l = (px[i] * 77 + px[i + 1] * 151 + px[i + 2] * 28) >> 8, t = l / 255;
    var r, g, b;
    if (t < 0.5) { var k = t / 0.5; r = 36 + (185 - 36) * k; g = 28 + (154 - 28) * k; b = 16 + (98 - 16) * k; }
    else { var k2 = (t - 0.5) / 0.5; r = 185 + (240 - 185) * k2; g = 154 + (224 - 154) * k2; b = 98 + (178 - 98) * k2; }
    px[i] = r; px[i + 1] = g; px[i + 2] = b;
  }
  c.putImageData(d, 0, 0);
  return cv;
}
function heroArt(key, team) {
  var a = HERO_ART[key]; if (!a) return null;
  if (team === 1) { if (!a.tan && a.img) a.tan = tanify(a.img); return a.tan; }
  return a.img || a.tan;
}
var spriteCache = {};
/* Ability cast frames: frame 1 (wind-up) for CAST_WIND seconds, then frame 2 (release) until CAST_HOLD, or for as long as a
   channel or dash lasts; then back to the idle figure. Frames are cut at the idle image's pixel scale (tools/prep-anim.py),
   so they are drawn at that scale, bottom-centred on the feet, which keeps the base plate still. */
var CAST_WIND = 0.09, CAST_HOLD = 0.42;
function castFrame(u) {
  var c = u.castA; if (!c || u.dead) return null;
  var fr = HERO_ANIM[u.pose] && HERO_ANIM[u.pose][c.slot]; if (!fr) return null;
  var n = c.t < CAST_WIND && fr[0] ? 0 : (fr[1] ? 1 : 0);
  return fr[n] && fr[n].img ? { key: u.pose, slot: c.slot, n: n, f: fr[n] } : null;
}
function animSprite(cf, team, h, flip, flash) {
  var id = 'A|' + cf.key + cf.slot + cf.n + '|' + team + '|' + h + '|' + (flip ? 1 : 0) + (flash ? 'f' : '');
  if (spriteCache[id]) return spriteCache[id];
  var idle = heroArt(cf.key, team); if (!idle) return null;
  if (!cf.f.img) return null;
  var art = cf.f.img; if (team === 1) { if (!cf.f.tan) cf.f.tan = tanify(cf.f.img); art = cf.f.tan; }
  var S = 2.5, k = h * (HSCALE[cf.key] || 1) / idle.height, w = art.width * k, dh = art.height * k, cv = document.createElement('canvas');
  cv.width = Math.ceil(w * S); cv.height = Math.ceil(dh * S);
  var c = cv.getContext('2d'); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  if (flip) { c.translate(cv.width, 0); c.scale(-1, 1); }
  c.drawImage(art, 0, 0, cv.width, cv.height);
  if (flash) { c.globalCompositeOperation = 'source-in'; c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, cv.width, cv.height); }
  return (spriteCache[id] = { cv: cv, w: w, h: dh, ox: -w / 2, oy: -dh + 6 });
}
function sprite(key, team, h, flip, flash) {
  var id = key + '|' + team + '|' + h + '|' + (flip ? 1 : 0) + (flash ? 'f' : '');
  if (spriteCache[id]) return spriteCache[id];
  var S = 2.5, art = heroArt(key, team), cv = document.createElement('canvas'), c, w, dh;
  if (art) {
    dh = h * (HSCALE[key] || 1); w = Math.ceil(dh * art.width / art.height);
    cv.width = Math.ceil(w * S); cv.height = Math.ceil(dh * S);
    c = cv.getContext('2d'); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    if (flip) { c.translate(cv.width, 0); c.scale(-1, 1); }
    c.drawImage(art, 0, 0, cv.width, cv.height);
    if (flash) { c.globalCompositeOperation = 'source-in'; c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, cv.width, cv.height); }
    spriteCache[id] = { cv: cv, w: w, h: dh, ox: -w / 2, oy: -dh + 6 };
  } else {
    w = Math.ceil(h * 200 / 240); cv.width = Math.ceil(w * S); cv.height = Math.ceil(h * S);
    c = cv.getContext('2d'); c.scale(S * h / 240, S * h / 240);
    paintPose(c, key, team, flip, flash);
    spriteCache[id] = { cv: cv, w: w, h: h, ox: -w / 2, oy: -h * 226 / 240 };
  }
  return spriteCache[id];
}
