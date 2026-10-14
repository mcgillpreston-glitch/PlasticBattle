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
function posePaths(key) {
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
  ctx.restore();
}
var spriteCache = {};
function sprite(key, team, h, flip, flash) {
  var id = key + '|' + team + '|' + h + '|' + (flip ? 1 : 0) + (flash ? 'f' : '');
  if (spriteCache[id]) return spriteCache[id];
  var S = 2, w = Math.ceil(h * 200 / 240), cv = document.createElement('canvas');
  cv.width = w * S; cv.height = h * S;
  var c = cv.getContext('2d');
  c.scale(S * h / 240, S * h / 240);
  paintPose(c, key, team, flip, flash);
  spriteCache[id] = { cv: cv, w: w, h: h };
  return spriteCache[id];
}
