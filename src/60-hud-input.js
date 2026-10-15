/* Browser only: HUD, scoreboard, Field Orders UI, input, Roll Call, game loop. */

/* ---------------- HUD ---------------- */
var abilEl = document.getElementById('abil');
function buildAbilityBar() {
  abilEl.innerHTML = '';
  ['Q', 'W', 'E', 'R', 'D', 'F'].forEach(function (slot) {
    var ab = abilityOf(G.player, slot);
    var b = document.createElement('button'); b.type = 'button'; b.className = 'ab' + (slot === 'R' ? ' ult' : '') + (slot === 'D' || slot === 'F' ? ' util' : '');
    b.dataset.slot = slot; b.setAttribute('aria-label', slot + ': ' + ab.n);
    b.innerHTML = '<span class="k"></span><span class="n"></span><span class="cd" hidden></span>';
    b.querySelector('.k').textContent = slot; b.querySelector('.n').textContent = ab.n;
    b.addEventListener('click', function () { aimSlot = aimSlot === slot ? null : slot; refreshAim(); });
    abilEl.appendChild(b);
  });
  var pc = document.getElementById('portraitCv').getContext('2d');
  pc.setTransform(1, 0, 0, 1, 0, 0); pc.clearRect(0, 0, 128, 152); pc.scale(128 / 200, 152 / 240); paintPose(pc, G.player.pose, 0, false);
}
function refreshAim() { abilEl.querySelectorAll('.ab').forEach(function (b) { b.classList.toggle('aim', b.dataset.slot === aimSlot); }); }
var hudT = 0;
function hud() {
  var u = G.player;
  document.getElementById('kg').textContent = G.kills[0];
  document.getElementById('kt').textContent = G.kills[1];
  document.getElementById('clock').textContent = fmtTime(G.time);
  var fg = G.structs.filter(function (s) { return s.team === 0 && !s.dead; }).length, ft = G.structs.filter(function (s) { return s.team === 1 && !s.dead; }).length;
  document.getElementById('forts').textContent = 'POSITIONS ' + fg + ' · ' + ft + ' · WAVE ' + Math.max(0, Math.ceil(G.nextWave)) + 'S';
  abilEl.querySelectorAll('.ab').forEach(function (b) {
    var s = b.dataset.slot, cd = u.cd[s], el = b.querySelector('.cd');
    if (s === 'D' && u.tagMark) { el.hidden = false; el.textContent = 'GO'; el.style.background = 'rgba(180,67,46,0.7)'; return; }
    if (u.dead) { el.hidden = false; el.textContent = ''; el.style.background = 'rgba(0,0,0,0.6)'; return; }
    var show = cd > 0 && !opts.nocd;
    el.hidden = !show;
    if (show) { var pct = Math.round(100 * cd / Math.max(0.01, u.cdMax[s])); el.textContent = cd >= 1 ? Math.ceil(cd) : cd.toFixed(1); el.style.background = 'linear-gradient(to top, rgba(0,0,0,0.82) ' + pct + '%, rgba(0,0,0,0.25) 0)'; }
  });
  var mh = maxHp(u);
  var hpf = clamp(u.hp / mh, 0, 1), hpm = document.getElementById('hpi').parentNode;
  document.getElementById('hpi').style.width = (100 * hpf) + '%';
  hpm.classList.toggle('crit', !u.dead && hpf < 0.3); hpm.classList.toggle('warn', !u.dead && hpf >= 0.3 && hpf < 0.6);
  document.getElementById('shb').style.width = (100 * clamp((u.hp + u.shield) / mh, 0, 1)) + '%';
  document.getElementById('hpt').textContent = u.dead ? 'REINFORCING · ' + Math.ceil(u.respawn) + 'S' : Math.ceil(u.hp) + ' / ' + mh;
  document.getElementById('xpi').style.width = (100 * (u.lvl >= 18 ? 1 : u.xp / xpNeed(u.lvl))) + '%';
  document.getElementById('lvl').textContent = u.lvl;
  var ob = document.getElementById('ordersBtn'), owed = ordersOwed(u);
  ob.classList.toggle('ready', owed > 0 && atBase(u));
  ob.textContent = owed > 0 ? (atBase(u) ? 'ORDERS READY' : 'ORDERS AT BASE (' + owed + ')') : 'FIELD ORDERS';
  var sq = document.getElementById('squad');
  sq.innerHTML = '';
  G.units.filter(function (h) { return h.kind === 'hero' && h.team === MYTEAM && !h.isPlayer; }).forEach(function (h) {
    var d = document.createElement('div'); d.className = 'mate' + (h.dead ? ' dead' : '');
    d.innerHTML = '<span class="nm"></span><span class="bar"><i></i></span>';
    d.querySelector('.nm').textContent = h.name + ' ' + h.lvl + (h.dead ? ' · ' + Math.ceil(h.respawn) + 's' : '');
    d.querySelector('i').style.width = (100 * clamp(h.hp / maxHp(h), 0, 1)) + '%';
    sq.appendChild(d);
  });
  sbT++; if (!sbEl.hidden && sbT % 3 === 0) renderSB();
  document.getElementById('dStats').textContent = 'Units ' + G.units.length + ' · shots ' + G.proj.length + ' · wave ' + G.wave;
}
function renderFeed() {
  var el = document.getElementById('feed'); el.innerHTML = '';
  G.feed.forEach(function (f) { var d = document.createElement('div'); d.className = f.cls; d.textContent = f.txt; el.appendChild(d); });
}
/* ---------------- Scoreboard ---------------- */
var sbEl = document.getElementById('sb'), sbMode = null, sbT = 0, portraitURL = {};
function portrait(key, team) {
  var id = key + team; if (portraitURL[id]) return portraitURL[id];
  var c = document.createElement('canvas'); c.width = 48; c.height = 58; var x = c.getContext('2d'); x.scale(48 / 200, 58 / 240); paintPose(x, key, team, false);
  return (portraitURL[id] = c.toDataURL());
}
function kfmt(n) { n = Math.round(n); return n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(n); }
function openSB(mode) { if (!G) return; sbMode = mode; sbEl.hidden = false; renderSB(); }
function closeSB() { sbEl.hidden = true; sbMode = null; }
function renderSB() {
  var heroes = G.units.filter(function (u) { return u.kind === 'hero'; });
  var cols = ['k', 'cs', 'dmgH', 'dmgS', 'taken', 'heal'], best = {};
  cols.forEach(function (c) { var m = 0; heroes.forEach(function (h) { m = Math.max(m, h.st[c]); }); best[c] = m; });
  var teams = [0, 1].map(function (team) {
    var hs = heroes.filter(function (h) { return h.team === team; });
    var sum = function (k) { return hs.reduce(function (a, h) { return a + h.st[k]; }, 0); };
    var mine = G.structs.filter(function (s) { return s.team === team; }), theirs = G.structs.filter(function (s) { return s.team !== team; });
    return { team: team, hs: hs, k: G.kills[team], d: sum('d'), a: sum('a'), cs: sum('cs'), dmgH: sum('dmgH'), dmgS: sum('dmgS'), heal: sum('heal'),
      held: mine.filter(function (s) { return !s.dead; }).length, taken: theirs.filter(function (s) { return s.dead; }).length,
      lvl: hs.length ? hs.reduce(function (a, h) { return a + h.lvl; }, 0) / hs.length : 0, orders: hs.reduce(function (a, h) { return a + h.augs.length; }, 0) };
  });
  var tot = teams[0].dmgH + teams[1].dmgH || 1;
  document.getElementById('sbTug').innerHTML = '<i style="width:' + (100 * teams[0].dmgH / tot).toFixed(1) + '%;background:var(--green)"></i><i style="flex:1;background:var(--tan)"></i>';
  document.getElementById('sbMeta').innerHTML = '<span>Time <b>' + fmtTime(G.time) + '</b></span><span>Wave <b>' + G.wave + '</b></span><span>Next wave <b>' + Math.max(0, Math.ceil(G.nextWave)) + 's</b></span>' + (G.barrage ? '<span><b>Sprinkler on</b></span>' : '<span>Sprinkler at <b>18:00</b></span>');
  var html = '';
  teams.forEach(function (T) {
    var cls = T.team === 0 ? 'g' : 't', name = T.team === 0 ? 'Green Army' : 'Tan Army';
    html += '<section class="sbteam ' + cls + '"><header><h3>' + name + '</h3><div class="sbstats">' +
      '<span>Kills <b>' + T.k + '</b></span><span>Deaths <b>' + T.d + '</b></span><span>Assists <b>' + T.a + '</b></span>' +
      '<span>Positions held <b>' + T.held + '/7</b></span><span>Positions taken <b>' + T.taken + '</b></span>' +
      '<span>Hero dmg <b>' + kfmt(T.dmgH) + '</b></span><span>Structure dmg <b>' + kfmt(T.dmgS) + '</b></span><span>CS <b>' + T.cs + '</b></span><span>Avg level <b>' + T.lvl.toFixed(1) + '</b></span><span>Orders <b>' + T.orders + '</b></span>' +
      '</div></header><div class="sbwrap"><table class="sbt"><thead><tr><th scope="col">Soldier</th><th scope="col">Lvl</th><th scope="col">K / D / A</th><th scope="col">CS</th><th scope="col">Hero dmg</th><th scope="col">Struct dmg</th><th scope="col">Dmg taken</th><th scope="col">Heal/Shield</th><th scope="col">Best streak</th><th scope="col">Orders</th><th scope="col">Status</th></tr></thead><tbody>';
    T.hs.forEach(function (h) {
      var b = function (c, v) { return '<td' + (best[c] > 0 && h.st[c] === best[c] ? ' class="best"' : '') + '>' + v + '</td>'; };
      var hpPct = Math.round(100 * clamp(h.hp / maxHp(h), 0, 1));
      var status = h._hidden && h.team !== MYTEAM && !h.dead ? '<span class="st">Unseen</span>' : h.dead ? '<span class="st">Reinforcing ' + Math.ceil(h.respawn) + 's</span>' : '<span class="st">' + (atBase(h) ? 'At base' : 'In the field') + '</span><span class="hp"><i style="width:' + hpPct + '%;background:' + TEAMC[h.team].bar + '"></i></span>';
      html += '<tr class="' + (h.isPlayer ? 'me' : '') + (h.dead ? ' down' : '') + '"><td><span class="who"><img alt="" src="' + portrait(h.pose, h.team) + '"><span class="nm">' + h.name + '</span>' + (h.isPlayer ? '<span class="you">YOU</span>' : '') + '</span></td>' +
        '<td><span class="lv">' + h.lvl + '</span></td>' +
        '<td' + (best.k > 0 && h.st.k === best.k ? ' class="best"' : '') + '>' + h.st.k + ' / ' + h.st.d + ' / ' + h.st.a + '</td>' +
        b('cs', h.st.cs) + b('dmgH', kfmt(h.st.dmgH)) + b('dmgS', kfmt(h.st.dmgS)) + b('taken', kfmt(h.st.taken)) + b('heal', kfmt(h.st.heal)) +
        '<td>' + h.st.best + '</td><td title="' + h.augs.map(function (a) { return typeof a === 'string' ? a : a.n; }).join(', ') + '">' + h.augs.length + '</td><td>' + status + '</td></tr>';
    });
    html += '</tbody></table></div></section>';
  });
  document.getElementById('sbTeams').innerHTML = html;
}
document.getElementById('sbBtn').addEventListener('click', function () { if (sbEl.hidden) openSB('toggle'); else closeSB(); });
document.getElementById('sbClose').addEventListener('click', closeSB);
document.getElementById('endSb').addEventListener('click', function () { openSB('toggle'); });
window.addEventListener('keyup', function (e) { if (e.key === 'Tab' && sbMode === 'hold') closeSB(); });
window.addEventListener('blur', function () { if (sbMode === 'hold') closeSB(); });
function fmtTime(t) { var m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + (s < 10 ? '0' : '') + s; }

/* ---------------- Input ---------------- */
function pickAt(w) {
  var best = null, bd = 1e9;
  G.units.forEach(function (u) { if (u.team === MYTEAM || u.dead || !visibleTo(u, MYTEAM)) return; var h = unitH(u); var d = vlen(u.x - w.x, (u.y - h * 0.4) - w.y); if (d < Math.max(36, h * 0.5) && d < bd) { bd = d; best = u; } });
  if (!best) G.structs.forEach(function (s) { if (s.team === MYTEAM || s.dead) return; if (vlen(s.x - w.x, s.y - 60 - w.y) < s.r + 50) best = s; });
  return best;
}
/* Player commands: applied directly offline, sent to the server online. */
function cmdMove(pt, amove) {
  if (NET.mode === 'online') { netSend({ t: 'move', x: Math.round(pt.x), y: Math.round(pt.y), a: amove ? 1 : 0 }); G.player.target = null; return; }
  var u = G.player; u.target = null; u.move = pt; u.amove = amove ? pt : null;
}
function cmdTarget(t) {
  if (NET.mode === 'online') { netSend({ t: 'atk', id: t.id }); G.player.target = t; return; }
  var u = G.player; u.target = t; u.move = null; u.amove = null;
}
function cmdCast(slot, w) {
  if (NET.mode === 'online') { netSend({ t: 'cast', s: slot, x: Math.round(w.x), y: Math.round(w.y) }); return; }
  cast(G.player, slot, w);
}
function cmdHalt() {
  if (NET.mode === 'online') { netSend({ t: 'halt' }); G.player.target = null; return; }
  var u = G.player; u.move = null; u.target = null; u.amove = null;
}
function order(sx, sy) {
  var u = G.player; if (!u || u.dead || G.over) return;
  var w = s2w(sx, sy);
  if (aimSlot) { cmdCast(aimSlot, w); aimSlot = null; refreshAim(); return; }
  var t = pickAt(w);
  if (t && !aMovePending) { cmdTarget(t); G.moveMark = null; addFx({ k: 'ring', x: t.x, y: t.y, r: 40, t: 0, dur: 0.3, c: '#D9532F' }); }
  else {
    var pt = freePoint(w, u.r);
    cmdMove(pt, aMovePending);
    G.moveMark = { x: pt.x, y: pt.y, t: 1.2 };
  }
  aMovePending = false;
}
cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
var drag = null;
function unlockAudio() { audioInit(); }
document.addEventListener('pointerdown', unlockAudio, { once: true });
document.addEventListener('keydown', unlockAudio, { once: true });
cv.addEventListener('pointerdown', function (e) {
  if (!G) return;
  var r = cv.getBoundingClientRect();
  if (e.pointerType === 'mouse') { order(e.clientX - r.left, e.clientY - r.top); return; }
  drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false };
});
cv.addEventListener('pointermove', function (e) {
  var r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.inside = true;
  if (drag) { var dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 12) { drag.moved = true; cam.lock = false; cam.x = drag.cx - dx / cam.z; cam.y = drag.cy - dy / cam.z; } }
  if (G && e.pointerType === 'mouse') { hoverT = pickAt(s2w(mouse.x, mouse.y)); cv.style.cursor = hoverT ? 'crosshair' : 'default'; }
});
cv.addEventListener('pointerleave', function () { mouse.inside = false; hoverT = null; });
cv.addEventListener('pointerup', function (e) {
  if (drag && !drag.moved) { var r = cv.getBoundingClientRect(); order(e.clientX - r.left, e.clientY - r.top); }
  drag = null;
});
cv.addEventListener('wheel', function (e) { e.preventDefault(); cam.zSet = true; cam.z = clamp(cam.z * (e.deltaY > 0 ? 0.9 : 1.1), 0.35, 1.6); }, { passive: false });
mini.addEventListener('pointerdown', function (e) {
  var r = mini.getBoundingClientRect(); cam.lock = false;
  cam.x = (e.clientX - r.left) / r.width * MAP.W; cam.y = (e.clientY - r.top) / r.height * MAP.H;
});
window.addEventListener('keydown', function (e) {
  if (!G || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (!document.getElementById('draft').hidden) return;
  if (e.key === 'Tab') { e.preventDefault(); if (sbEl.hidden) openSB('hold'); return; }
  var k = e.key.toUpperCase();
  if (k === 'ESCAPE' && !sbEl.hidden) { closeSB(); return; }
  if (['Q', 'W', 'E', 'R', 'D', 'F'].indexOf(k) >= 0) {
    if (!ordersModal.hidden) return;
    var w = mouse.inside ? s2w(mouse.x, mouse.y) : { x: G.player.x + G.player.facing * 200, y: G.player.y };
    cmdCast(k, w); e.preventDefault();
  } else if (k === 'A') { aMovePending = true; }
  else if (k === 'S') { cmdHalt(); aMovePending = false; }
  else if (k === ' ') { cam.lock = true; e.preventDefault(); }
  else if (k === 'Y') { cam.lock = !cam.lock; showToast(cam.lock ? 'Camera locked' : 'Camera free', 1); }
  else if (k === 'O') { if (ordersModal.hidden) openOrders(); else ordersModal.hidden = true; }
  else if (k === 'ESCAPE') { aimSlot = null; aMovePending = false; refreshAim(); ordersModal.hidden = true; }
  else if (k === '`') { var d = document.getElementById('dev'); d.open = !d.open; }
});
document.getElementById('ordersBtn').addEventListener('click', openOrders);
document.getElementById('helpX').addEventListener('click', function () { document.getElementById('help').hidden = true; });

function bindCheck(id, key) { document.getElementById(id).addEventListener('change', function (e) { opts[key] = e.target.checked; }); }
bindCheck('dRanges', 'ranges'); bindCheck('dCol', 'col'); bindCheck('dGod', 'god'); bindCheck('dNoCd', 'nocd'); bindCheck('dPassive', 'passive'); bindCheck('dPause', 'pause'); bindCheck('dSound', 'sound');
document.getElementById('dSpeed').addEventListener('change', function (e) { opts.speed = Number(e.target.value); });
document.getElementById('bWave').addEventListener('click', function () { if (G) spawnWave(); });
document.getElementById('bLvl').addEventListener('click', function () { if (G && G.player.lvl < 18) giveXp(G.player, xpNeed(G.player.lvl) - G.player.xp); });
document.getElementById('bKill').addEventListener('click', function () { if (G) G.units.forEach(function (u) { if (u.team === 1 && u.kind === 'hero' && !u.dead) kill(G.player, u); }); });
document.getElementById('bFort').addEventListener('click', function () { if (!G) return; var s = G.structs.filter(function (s) { return s.team === 1 && targetable(s); })[0]; if (s) kill(G.player, s); });
document.getElementById('bSun').addEventListener('click', function () { if (G) startBarrage(); });
document.getElementById('bReset').addEventListener('click', showDraft);


/* ---------------- Field Orders UI ---------------- */
var ordersModal = document.getElementById('ordersModal');
function offerView(u) {
  var off = u.offer; if (!off) return null;
  if (NET.mode === 'online') return off;
  return { tier: off.tier, cards: off.cards.map(function (c) { return { n: c.o.n, d: c.o.d, r: c.rerolled }; }), spare: off.spare.length };
}
function openOrders() {
  var u = G && G.player; if (!u || G.over) return;
  if (ordersOwed(u) <= 0) { showToast('No Field Orders waiting. Next at level ' + (ORDER_LEVELS.find(function (l) { return l > u.lvl; }) || '-'), 1.8); return; }
  if (!atBase(u)) { showToast('Field Orders are issued at your base or while reinforcing', 1.8); return; }
  if (NET.mode === 'local') { if (!u.offer) rollOffer(u); }
  else if (!u.offer) { netSend({ t: 'orders' }); NET.wantOrders = true; showToast('Requisitioning orders\u2026', 1); return; }
  renderOrders();
  ordersModal.hidden = false;
}
function renderOrders() {
  var u = G.player, off = offerView(u);
  if (!off) { ordersModal.hidden = true; return; }
  document.getElementById('oLevel').textContent = 'Level ' + ORDER_LEVELS[u.ordersDone] + ' order \u00b7 ' + TIERS[off.tier] + ' tier';
  [0, 1, 2].forEach(function (i) { document.getElementById('tier' + i).classList.toggle('on', i === off.tier); });
  var wrap = document.getElementById('orderCards'); wrap.innerHTML = '';
  off.cards.forEach(function (c, i) {
    var d = document.createElement('div'); d.className = 'order';
    var pick = document.createElement('button'); pick.type = 'button';
    pick.innerHTML = '<span class="tg"></span><span class="on"></span><span class="od"></span>';
    pick.querySelector('.tg').textContent = TIERS[off.tier] + ' order';
    pick.querySelector('.on').textContent = c.n;
    pick.querySelector('.od').textContent = c.d;
    pick.addEventListener('click', function () {
      ordersModal.hidden = true; showToast(c.n + ' issued', 1.6); playSfx('ui');
      if (NET.mode === 'online') { netSend({ t: 'pick', i: i }); u.offer = null; NET.wantOrders = ordersOwed(u) > 1; return; }
      applyOrder(u, u.offer.cards[i].o);
      if (ordersOwed(u) > 0) { rollOffer(u); openOrders(); }
    });
    var rr = document.createElement('button'); rr.type = 'button'; rr.className = 'btn';
    rr.textContent = c.r ? 'Redrawn' : 'Redraw this order';
    rr.disabled = c.r || !off.spare;
    rr.addEventListener('click', function () {
      if (NET.mode === 'online') { netSend({ t: 'redraw', i: i }); rr.disabled = true; return; }
      var lo = u.offer; if (!lo.spare.length) return; lo.cards[i].o = lo.spare.shift(); lo.cards[i].rerolled = true; renderOrders();
    });
    d.appendChild(pick); d.appendChild(rr); wrap.appendChild(d);
  });
  document.getElementById('oHeld').textContent = 'Orders held: ' + (u.augs.length ? u.augs.map(function (a) { return typeof a === 'string' ? a : a.n; }).join(', ') : 'none');
}
document.getElementById('oClose').addEventListener('click', function () { ordersModal.hidden = true; });

/* ---------------- Roll call ---------------- */
var draft = { idx: 3, shakes: 1 };
var draftEl = document.getElementById('draft');
function showDraft() {
  draft.idx = Math.floor(Math.random() * HEROES.length); draft.shakes = 1;
  document.getElementById('endModal').hidden = true; ordersModal.hidden = true; closeSB();
  draftEl.hidden = false; setTab(false); renderDraft();
}
function renderDraft() {
  var h = HEROES[draft.idx];
  document.getElementById('dName').textContent = h.name;
  document.getElementById('dRole').textContent = h.role;
  document.getElementById('dRange').textContent = h.range + ' range · ' + h.hp + ' HP';
  var kit = document.getElementById('dKit'); kit.innerHTML = '';
  ['Q', 'W', 'E', 'R'].forEach(function (s) { var d = document.createElement('div'); d.className = 'row'; d.innerHTML = '<span><b></b> <span></span></span><span class="muted"></span>'; d.querySelector('b').textContent = s; d.querySelector('span span').textContent = h[s].n; d.querySelector('.muted').textContent = h[s].cd + 's'; kit.appendChild(d); });
  var sh = document.getElementById('shake'); sh.textContent = 'Request reassignment (' + draft.shakes + ')'; sh.disabled = draft.shakes < 1;
  var fc = document.getElementById('draftFig').getContext('2d');
  fc.setTransform(1, 0, 0, 1, 0, 0); fc.clearRect(0, 0, 400, 480); fc.scale(2, 2); paintPose(fc, h.key, 0, false);
  document.querySelectorAll('#pickGrid button').forEach(function (b, i) { b.classList.toggle('on', i === draft.idx); });
}
var grid = document.getElementById('pickGrid');
HEROES.forEach(function (h, i) { var b = document.createElement('button'); b.type = 'button'; b.textContent = h.name; b.addEventListener('click', function () { draft.idx = i; renderDraft(); }); grid.appendChild(b); });
document.getElementById('shake').addEventListener('click', function () { if (draft.shakes < 1) return; draft.shakes--; var n; do { n = Math.floor(Math.random() * HEROES.length); } while (n === draft.idx); draft.idx = n; renderDraft(); });
document.getElementById('deploy').addEventListener('click', function () {
  audioInit();
  newGame(draft.idx, Number(document.getElementById('squadSize').value));
  draftEl.hidden = true;
  document.getElementById('help').hidden = false;
});
document.getElementById('again').addEventListener('click', function () { if (NET.mode === 'online') backToLobby(); else showDraft(); });

/* ---------------- Loop ---------------- */
var last = performance.now(), fpsAcc = 0, fpsN = 0;
function frame(now) {
  var raw = Math.min(0.05, (now - last) / 1000); last = now;
  fpsAcc += raw; fpsN++;
  if (fpsAcc > 0.5) { document.getElementById('fps').textContent = Math.round(fpsN / fpsAcc) + ' fps'; fpsAcc = 0; fpsN = 0; }
  if (NET.mode === 'local' && G && !opts.pause && draftEl.hidden && ordersModal.hidden) {
    if (G.player && mouse.inside) G.player.aimPt = { x: mouse.wx, y: mouse.wy };
    var dt = raw * opts.speed, steps = Math.ceil(dt / 0.034);
    for (var i = 0; i < steps; i++) update(dt / steps);
    presentLocal();
  } else if (NET.mode === 'online') netFrame(raw);
  updateVisuals(raw);
  if (G && G.player) {
    if (cam.lock) {
      var dead = G.player.dead, tgt = dead ? (G.death && G.player.respawn > 1.6 ? G.death : fountain(MYTEAM)) : G.player, k = Math.min(1, raw * (dead ? 3.5 : 14));
      cam.x += (tgt.x - cam.x) * k; cam.y += (tgt.y - cam.y) * k;
    }
    var mw = s2w(mouse.x, mouse.y); mouse.wx = mw.x; mouse.wy = mw.y;
    hudT -= raw; if (hudT <= 0) { hudT = 0.1; hud(); }
  }
  draw();
  requestAnimationFrame(frame);
}
/* Art lives next to the page (assets/): the painted map and the soldier illustrations. The page runs even if a file fails, with flat sand and sculpted figures. */
var ASSET_BASE = (function () { var sc = document.currentScript && document.currentScript.src; return sc ? sc.replace(/[^\/]*$/, '') : ''; })();
function loadAssets(done) {
  var pending = 0, finish = function () { if (--pending === 0) done(); };
  function img(url, cb) { pending++; var im = new Image(); im.onload = function () { cb(im); finish(); }; im.onerror = function () { cb(null); finish(); }; im.src = ASSET_BASE + url; }
  img('assets/map.webp', function (im) { ASSETS.map = im; });
  loadHeroArt(img);
  if (!pending) done();
}
function start() {
  var dep = document.getElementById('deploy'); dep.disabled = true; dep.textContent = 'Loading the sandbox\u2026';
  loadAssets(function () {
    dep.disabled = false; dep.textContent = 'Deploy';
    resize(); checkBlend(); makeGrain(); terrain = buildTerrain();
    newGame(3, 3);
    showDraft();
    if (NETC.inviteCode) setTab(true);
    requestAnimationFrame(frame);
  });
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(start, start); else start();

window.__PF = { get G() { return G; }, get NET() { return NET; }, netSend: function (o) { netSend(o); }, update: update, newGame: newGame, presentLocal: presentLocal, draw: draw, THERM: THERM, cam: cam, opts: opts, HEROES: HEROES, lanePt: lanePt, laneProj: laneProj, clampLane: clampLane, fountain: fountain, addMinion: addMinion, aaRange: aaRange, moveSpeed: moveSpeed, MAP: MAP, LANES: LANES, FIELD_CAPS: FIELD_CAPS, BRUSH: BRUSH, fieldSD: fieldSD, clampField: clampField, nearestLane: nearestLane, PROPS: PROPS, unitH: unitH, findPath: findPath, segClear: segClear, pointClear: pointClear, STUCK_LOG: STUCK_LOG, ASSETS: ASSETS };
