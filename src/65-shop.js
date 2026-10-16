/* Supply shop: P (or clicking your own HQ) opens and closes it at any time. Buying and HQ stash
   take-outs only work while your hero is at the team's fort; the server decides online, the sim offline. */
var shopModal = document.getElementById('shopModal');
var shopTimer = null;
function shopState() {
  if (NET.mode === 'online') return NET.shop || { cash: 0, items: [], stash: [], atHq: false };
  var p = G && G.player; if (!p) return { cash: 0, items: [], stash: [], atHq: false };
  var st = G.stash.filter(function (e) { return e.team === p.team; }).map(function (e) { var o = G.units.find(function (x) { return x.id === e.owner; }); return { sid: e.sid, amt: e.amt, owner: o ? (o.pname || o.name) : 'Someone', mine: e.owner === p.id }; });
  return { cash: p.cash, items: p.items, stash: st, atHq: !!atHq(p) };
}
function shopAct(msg, local) { if (NET.mode === 'online') netSend(msg); else local(); renderShop(); }
function shopBuy(id) { shopAct({ t: 'buy', id: id }, function () { buyItem(G.player, id); }); }
function shopDeposit() { var v = parseInt(document.getElementById('shopAmt').value, 10); if (!(v > 0)) return; shopAct({ t: 'dep', amt: v }, function () { depositCash(G.player, v); }); }
function shopWithdraw(sid) { shopAct({ t: 'wd', sid: sid }, function () { withdrawCash(G.player, sid); }); }
function renderShop() {
  if (shopModal.hidden) return;
  var s = shopState();
  document.getElementById('shopCash').textContent = 'Cash ' + s.cash;
  document.getElementById('shopHq').textContent = s.atHq ? 'At your fort: you can buy and stash.' : 'Go to your fort to buy or stash cash.';
  var slots = document.getElementById('shopSlots'); slots.innerHTML = '';
  for (var i = 0; i < SHOP_SLOTS; i++) {
    var id = s.items[i], it = id ? SHOP_ITEMS.find(function (x) { return x.id === id; }) : null;
    var d = document.createElement('div'); d.className = 'slot' + (it ? ' full' : ''); d.textContent = it ? it.name : 'Empty'; slots.appendChild(d);
  }
  var cats = document.getElementById('shopCats'); cats.innerHTML = '';
  SHOP_CATS.forEach(function (cat) {
    var h = document.createElement('div'); h.className = 'eyebrow'; h.textContent = cat; cats.appendChild(h);
    SHOP_ITEMS.filter(function (x) { return x.cat === cat; }).forEach(function (item) {
      var owned = s.items.indexOf(item.id) >= 0;
      var can = s.atHq && !owned && s.cash >= item.price && s.items.length < SHOP_SLOTS;
      var row = document.createElement('div'); row.className = 'shopRow';
      var label = document.createElement('span'); label.textContent = item.name + ' \u00b7 ' + item.blurb + ' \u00b7 ' + item.price;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = owned ? 'Owned' : 'Buy'; b.disabled = !can;
      b.addEventListener('click', function () { shopBuy(item.id); });
      row.appendChild(label); row.appendChild(b); cats.appendChild(row);
    });
  });
  var st = document.getElementById('shopStash'); st.innerHTML = '';
  if (!s.stash.length) { st.textContent = 'No cash stashed.'; }
  s.stash.forEach(function (e) {
    var row = document.createElement('div'); row.className = 'shopRow';
    var label = document.createElement('span'); label.textContent = e.owner + ' stashed ' + e.amt + (e.mine ? ' (yours)' : '');
    var b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = 'Take out for ' + Math.floor(e.amt * STASH_CUT); b.disabled = !s.atHq;
    b.addEventListener('click', function () { shopWithdraw(e.sid); });
    row.appendChild(label); row.appendChild(b); st.appendChild(row);
  });
  document.getElementById('shopDep').disabled = !s.atHq;
}
function openShop() { if (!G) return; shopModal.hidden = false; renderShop(); if (!shopTimer) shopTimer = setInterval(renderShop, 250); }
function closeShop() { shopModal.hidden = true; if (shopTimer) { clearInterval(shopTimer); shopTimer = null; } }
function toggleShop() { if (shopModal.hidden) openShop(); else closeShop(); }
function ownHqAt(w) {
  if (!G) return false;
  var hq = G.structs.find(function (s) { return s.kind === 'hq' && s.team === MYTEAM && !s.dead; });
  return !!hq && Math.abs(w.x - hq.x) < 110 && w.y > hq.y - 230 && w.y < hq.y + 40;
}
document.getElementById('shopDep').addEventListener('click', shopDeposit);
document.getElementById('shopClose').addEventListener('click', closeShop);
