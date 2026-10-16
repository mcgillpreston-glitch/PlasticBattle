// Economy checks against the shared sim: payouts, HQ stash, 80% take-out, buzzer tally.
const assert = require('assert');
const { createSim } = require('../server/sim.js');

const roster = () => { const r = []; for (let t = 0; t < 2; t++) for (let i = 0; i < 5; i++) r.push({ team: t, hero: i % 8, human: false }); return r; };
let fails = 0;
function check(name, fn) { try { fn(); console.log('PASS ' + name); } catch (e) { fails++; console.log('FAIL ' + name + '  ' + e.message); } }

function fresh() { const S = createSim(); S.simNewGame(roster()); return S; }
const heroOf = (S, team, i) => S.G.units.filter(u => u.kind === 'hero' && u.team === team)[i];
const hqOf = (S, team) => S.G.structs.find(s => s.kind === 'hq' && s.team === team);
function standAtHq(S, u) { const hq = hqOf(S, u.team); u.x = hq.x + 40; u.y = hq.y + 40; }

check('a minion kill pays cs to the hero who landed it', () => {
  const S = fresh();
  const hero = heroOf(S, 0, 0);
  for (let i = 0; i < 30 * 5; i++) S.update(1 / 30);
  const m = S.G.units.find(u => u.kind === 'minion' && u.team === 1);
  assert.ok(m, 'a wave has spawned');
  hero.cash = 0;
  S.kill(hero, m);
  assert.strictEqual(hero.cash, S.CASH.cs);
});

check('a hero kill pays the base bounty plus a level bonus', () => {
  const S = fresh();
  const killer = heroOf(S, 0, 0), victim = heroOf(S, 1, 0);
  killer.cash = 0; victim.lvl = 4;
  S.kill(killer, victim);
  assert.strictEqual(killer.cash, S.CASH.hero + S.CASH.perLvl * 4);
});

check('a turret pays more for inner turrets than outer', () => {
  const S = fresh();
  const hero = heroOf(S, 0, 0);
  const outer = S.G.structs.find(s => s.team === 1 && s.kind === 'outpost' && s.order === 1);
  const inner = S.G.structs.find(s => s.team === 1 && s.kind === 'outpost' && s.order === 2);
  hero.cash = 0; S.kill(hero, outer); const outerPay = hero.cash;
  hero.cash = 0; S.kill(hero, inner); const innerPay = hero.cash;
  assert.ok(innerPay > outerPay, 'inner ' + innerPay + ' outer ' + outerPay);
});

check('deposit needs the hero at its own HQ and enough cash', () => {
  const S = fresh();
  const hero = heroOf(S, 0, 0);
  hero.cash = 500; hero.x = 3000; hero.y = 3000;
  assert.strictEqual(S.depositCash(hero, 200), false, 'far from HQ');
  standAtHq(S, hero);
  assert.strictEqual(S.depositCash(hero, 9999), false, 'more than held');
  assert.strictEqual(S.depositCash(hero, 200), true);
  assert.strictEqual(hero.cash, 300);
  assert.strictEqual(S.G.stash.length, 1);
});

check('a teammate takes out someone else\'s stash and gets 80%', () => {
  const S = fresh();
  const owner = heroOf(S, 0, 0), taker = heroOf(S, 0, 1);
  owner.cash = 1000; standAtHq(S, owner); S.depositCash(owner, 1000);
  standAtHq(S, taker); taker.cash = 0;
  assert.strictEqual(S.withdrawCash(taker, S.G.stash[0].sid), true);
  assert.strictEqual(taker.cash, 800, 'taker gets 80%');
  assert.strictEqual(owner.cash, 0, 'owner gets nothing back');
  assert.strictEqual(S.G.stash.length, 0);
});

check('an enemy cannot take a stash out', () => {
  const S = fresh();
  const owner = heroOf(S, 0, 0), enemy = heroOf(S, 1, 0);
  owner.cash = 500; standAtHq(S, owner); S.depositCash(owner, 500);
  standAtHq(S, enemy); enemy.cash = 0;
  assert.strictEqual(S.withdrawCash(enemy, S.G.stash[0].sid), false);
  assert.strictEqual(enemy.cash, 0);
});

check('at the buzzer cash in hand and stashed cash count at face value into stats', () => {
  const S = fresh();
  const hero = heroOf(S, 0, 0);
  hero.cash = 300; standAtHq(S, hero); S.depositCash(hero, 200);
  S.G.time = S.MATCH_LEN - 0.05;
  S.update(0.1);
  assert.strictEqual(hero.st.cash, 300, 'held 100 + stashed 200 at face value');
  assert.strictEqual(S.G.over, true);
});

check('shop: buy needs HQ, cash, a free slot and no duplicate', () => {
  const S = fresh();
  const hero = heroOf(S, 0, 0);
  hero.cash = 1000; hero.x = 3000; hero.y = 3000;
  assert.strictEqual(S.buyItem(hero, 'ration'), false, 'not at HQ');
  standAtHq(S, hero);
  assert.strictEqual(S.buyItem(hero, 'ration'), true);
  assert.strictEqual(hero.cash, 880);
  assert.strictEqual(S.buyItem(hero, 'ration'), false, 'no duplicates');
  assert.ok(Math.abs(hero.aug.hpMul - 0.10) < 1e-9, 'mod applied');
  hero.cash = 9999; S.buyItem(hero, 'manual'); S.buyItem(hero, 'hands'); S.buyItem(hero, 'scope');
  assert.strictEqual(hero.items.length, 4);
  hero.cash = 9999; S.buyItem(hero, 'manual');
  assert.strictEqual(hero.items.length, 4, 'no second copy');
});

check('shop: a sixth item is refused', () => {
  const S = fresh();
  const hero = heroOf(S, 0, 0);
  hero.cash = 99999; standAtHq(S, hero);
  ['ration', 'manual', 'hands', 'scope'].forEach(id => S.buyItem(hero, id));
  S.SHOP_ITEMS.push({ id: 'x1', cat: 'MREs', name: 'x', price: 1, mods: {}, blurb: '' });
  S.SHOP_ITEMS.push({ id: 'x2', cat: 'MREs', name: 'x', price: 1, mods: {}, blurb: '' });
  assert.strictEqual(hero.items.length, 4);
  assert.strictEqual(S.buyItem(hero, 'x1'), true);
  assert.strictEqual(S.buyItem(hero, 'x2'), false, 'slot cap is 5 items, so the 6th is refused');
});

console.log(fails ? fails + ' failed' : 'all economy checks passed');
process.exit(fails ? 1 : 0);
