// The fabric and its evaluator, held to the sealed text. The protocol is checked with fast stand-ins for the loop and the
// receive; one small run uses the real ones. Fixtures come from the MNIST TRAINING file only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import F from '../src/fabric.mjs';
import E from '../src/eval.mjs';
import X from '../vendor/mesh-share/src/exchange.mjs';
import L from '../vendor/mesh-share/vendor/code-rsi/src/loop.mjs';
import M from '../vendor/mesh-share/vendor/hybrid-gate/src/mnist.mjs';
import { rng } from '../vendor/mesh-share/vendor/code-rsi/vendor/settling-cell/vendor/seed-library/seedlib.mjs';
import C from '../vendor/mesh-share/vendor/code-rsi/vendor/settling-cell/src/cell.mjs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const claims = read('CLAIMS.md').replace(/\s+/g, ' ');
const raw = (f) => new Uint8Array(gunzipSync(readFileSync(new URL('../data/mnist/' + f, import.meta.url))));
const IMG = raw('train-images-idx3-ubyte.gz'), LAB = raw('train-labels-idx1-ubyte.gz');
const sub = (from, n) => {
  const i = new Uint8Array(16 + n * 784); i.set(IMG.subarray(0, 16)); new DataView(i.buffer).setUint32(4, n); i.set(IMG.subarray(16 + from * 784, 16 + (from + n) * 784), 16);
  const l = new Uint8Array(8 + n); l.set(LAB.subarray(0, 8)); new DataView(l.buffer).setUint32(4, n); l.set(LAB.subarray(8 + from, 8 + from + n), 8);
  return M.parse(i, l);
};
const s0 = read('vendor/mesh-share/vendor/code-rsi/vendor/settling-cell/data/cell.txt');
const train = sub(0, 960);

test('the sealed numbers in the code are the ones CLAIMS.md states', () => {
  for (const s of ['12 nodes in 3 clusters', 'MNIST training rows 2,500·i to 2,500·i + 2,499', 'SHA-256("nested-fabric/node-i")', 'SHA-256("nested-fabric/rogue")', '**4 rounds.**', 'for 15 cycles', '4242 + 100·i + round', '777 + 100·i + round', '50,000 + 1,000,000·i + 10,000·round', 'in rounds 2 and 4 only', 'index 1,000·t + k', 'after round 1', 'seed 6001 + the message', 'seed 6002', '(3 of 12 nodes lost)', '(6 of 12 lost)', '(30% of messages dropped)', 'first 2,000 MNIST test digits', 'within 2.0 points of fab; n50\'s are within 5.0 points'])
    assert.ok(claims.includes(s), 'CLAIMS.md says: ' + s);
  assert.deepEqual(F.CFG, { nodes: 12, size: 4, rounds: 4, cycles: 15, shard: 2500, wide: [2, 4], dropSeed: 6001, lossSeed: 6002 });
  assert.deepEqual(F.SCENARIOS, { iso: { share: false, lost: 0, drop: 0 }, fab: { share: true, lost: 0, drop: 0 }, n25: { share: true, lost: 3, drop: 0 }, n50: { share: true, lost: 6, drop: 0 }, l30: { share: true, lost: 0, drop: 30 } });
  assert.equal(E.DIGITS, 2000);
  assert.ok(Object.isFrozen(F.CFG) && Object.isFrozen(F.CFG.wide) && Object.isFrozen(F.SCENARIOS));
});

test('the small parts: lost nodes, loop seeds, clusters, gateways, dropped links', () => {
  assert.deepEqual(F.lostSet(12, 3, 6002), F.lostSet(12, 3, 6002));
  assert.equal(F.lostSet(12, 6, 6002).length, 6);
  assert.deepEqual(F.lostSet(12, 0, 6002), []);
  assert.deepEqual(F.lostSet(12, 12, 6002), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.deepEqual(F.lostSet(12, 3, 6002), [...F.lostSet(12, 3, 6002)].sort((a, b) => a - b), 'sorted');
  assert.ok([1, 2, 3, 4, 5, 6, 7, 8].some((s) => F.lostSet(2, 1, s)[0] === 1), 'the last swap happens for some seed');
  assert.ok([1, 2, 3, 4, 5, 6, 7, 8].some((s) => F.lostSet(2, 1, s)[0] === 0), 'and for some seed it does not');
  for (let v = 0; v !== 3; v++) assert.ok(Array.from({ length: 40 }, (_, s) => s).some((s) => F.lostSet(3, 1, s)[0] === v), 'every node can be lost first: ' + v);
  const c = F.loopCfg(3, 2);
  assert.deepEqual([c.loopSeed, c.examSeed, c.noiseBase, c.batch, c.gate], [4242 + 302, 777 + 302, 50000 + 3000000 + 20000, L.CFG.batch, L.CFG.gate]);
  assert.deepEqual(F.clusterOf(5, 4), [4, 5, 6, 7]);
  assert.deepEqual(F.clusterOf(0, 4), [0, 1, 2, 3]);
  const live = Array(12).fill(true);
  assert.equal(F.gateway(1, 4, live), 4);
  live[4] = false; live[5] = false;
  assert.equal(F.gateway(1, 4, live), 6);
  live[6] = false; live[7] = false;
  assert.equal(F.gateway(1, 4, live), -1);
  assert.equal(F.gateway(2, 4, live), 8);
  assert.equal(F.dropped(5, 0, 6001), false);
  assert.equal(F.dropped(5, 100, 6001), true);
  assert.equal(F.dropped(5, 30, 6001), rng(6006)() * 100 < 30);
  for (let q = 0; q !== 300; q++) { const w = Math.floor(rng(6001 + q)() * 100); assert.equal(F.dropped(q, w, 6001), false, 'a draw of exactly pct is kept'); assert.equal(F.dropped(q, w + 1, 6001), true, 'a draw under pct is dropped'); }
  const tr = { x: Array.from({ length: 30 }, (_, j) => 'x' + j), y: Array.from({ length: 30 }, (_, j) => j) };
  assert.deepEqual(F.shardOf(tr, 1, 10), { x: tr.x.slice(10, 20), y: tr.y.slice(10, 20) });
  assert.deepEqual(F.shardOf(tr, 0, 10).y, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(F.shardOf(tr, 2, 10).x, ['x20', 'x21', 'x22', 'x23', 'x24', 'x25', 'x26', 'x27', 'x28', 'x29']);
  let n = 0; for (let q = 0; q !== 1000; q++) n += F.dropped(q, 30, 6001) ? 1 : 0;
  assert.ok(n > 230 && n < 370, 'about 30% dropped: ' + n);
});

const fakeLoop = (shard, text, o) => ({ text: text + '+' + o.cfg.loopSeed, log: [[0, 1, 1, 0, 0], [0, 1, 0, 0, 0]] });
const fakeReceive = async (b, msg, roster) => {
  if (!roster.includes(msg.pub)) return { adopted: false, reason: 'unknown-key', wins: 0, losses: 0, text: b };
  const t = new TextDecoder().decode(msg.bytes);
  return t.length > b.length ? { adopted: true, reason: 'adopted', wins: 3, losses: 0, text: t } : { adopted: false, reason: 'did-not-win', wins: 0, losses: 2, text: b };
};
const deps = { receive: fakeReceive, runLoop: fakeLoop };
const cfg8 = { ...F.CFG, nodes: 8, rounds: 2, shard: 10 };
test('run: the protocol, message by message, with stand-ins for the loop and the receive', async () => {
  const iso = await F.run('iso', { train, s0Text: 'S' }, cfg8, deps);
  assert.equal(iso.log.filter((e) => e[0] === 'share').length, 0, 'iso never shares');
  assert.deepEqual(iso.log.filter((e) => e[0] === 'improve').length, 16);
  assert.deepEqual(iso.log[0], ['improve', 1, 0, 1]);
  assert.equal(iso.shapes[3], 'S+' + (4242 + 301) + '+' + (4242 + 302));
  const fab = await F.run('fab', { train, s0Text: 'S' }, cfg8, deps);
  const r1 = fab.log.filter((e) => e[1] === 1 && e[0] === 'share'), r2 = fab.log.filter((e) => e[1] === 2 && e[0] === 'share');
  assert.equal(r1.filter((e) => e[4] === 'local').length, 24, 'each of 8 nodes hears its 3 cluster peers');
  assert.equal(r1.filter((e) => e[4] === 'wide').length, 0, 'no wide sharing in round 1');
  assert.deepEqual(r2.filter((e) => e[4] === 'wide').map((e) => [e[2], e[3]]), [[4, 0], [0, 4]], 'round 2: the two gateways swap');
  assert.equal(r1.filter((e) => e[4] === 'rogue').length, 8);
  assert.ok(fab.log.filter((e) => e[4] === 'rogue').every((e) => e[5] === 'unknown-key' && e[2] === -1));
  assert.deepEqual(r1.filter((e) => e[3] === 1).map((e) => [e[4], e[2]]), [['local', 0], ['local', 2], ['local', 3], ['rogue', -1]], 'a receiver hears local by sender, then the rogue');
  const ws = r2.filter((e) => e[3] === 0).map((e) => e[4]);
  assert.deepEqual(ws, ['local', 'local', 'local', 'wide', 'rogue'], 'then wide, then the rogue');
  assert.equal(F.run('nope', { train, s0Text: 'S' }, cfg8, deps) instanceof Promise, true);
  assert.equal(await F.run('nope', { train, s0Text: 'S' }, cfg8, deps), null);
  const n25 = await F.run('n25', { train, s0Text: 'S' }, cfg8, deps);
  assert.deepEqual(n25.lost, F.lostSet(8, 3, 6002));
  assert.deepEqual(n25.live.map((v, i) => v === !n25.lost.includes(i)), Array(8).fill(true));
  assert.ok(n25.log.filter((e) => e[1] === 2).every((e) => !n25.lost.includes(e[2]) && !((e[0] === 'share' || e[0] === 'drop') && n25.lost.includes(e[3]))), 'the lost are silent from round 2');
  assert.ok(n25.log.filter((e) => e[1] === 1).some((e) => n25.lost.includes(e[2])), 'but they worked in round 1');
  const l30 = await F.run('l30', { train, s0Text: 'S' }, cfg8, deps);
  const drops = l30.log.filter((e) => e[0] === 'drop');
  assert.ok(drops.length > 0 && drops.length < 40);
  const seqs = []; let q = 0;
  for (const e of l30.log) if (e[0] === 'drop' || e[0] === 'share') { if (e[0] === 'drop') seqs.push(q); q++; }
  assert.deepEqual(seqs.map((s) => F.dropped(s, 30, 6001)), seqs.map(() => true), 'exactly the seeded drops');
  assert.equal(fab.hash, (await F.run('fab', { train, s0Text: 'S' }, cfg8, deps)).hash, 'deterministic');
  const live2 = Array(8).fill(true);
  assert.equal(F.gateway(0, 4, live2), 0);
});

test('audit: N4 on forged logs', () => {
  const base = { lost: [5], log: [['improve', 1, 5, 2], ['share', 1, 4, 5, 'local', 'adopted', 3, 1], ['share', 2, -1, 0, 'rogue', 'unknown-key', 0, 0], ['share', 2, 1, 0, 'local', 'adopted', 2, 0]] };
  assert.deepEqual(F.audit(base, { nodes: 12 }), { adoptions: 2, earned: true, rogues: 1, rogueRefused: true, silent: true, nodes: 12 });
  assert.equal(F.audit({ ...base, log: [...base.log, ['share', 2, 1, 0, 'local', 'adopted', 2, 1]] }).earned, false, '2 − 1 = 1 is under 2');
  assert.equal(F.audit({ ...base, log: [...base.log, ['share', 2, -1, 3, 'rogue', 'adopted', 5, 0]] }).rogueRefused, false);
  assert.equal(F.audit({ ...base, log: [...base.log, ['improve', 2, 5, 1]] }).silent, false, 'a lost node worked after round 1');
  assert.equal(F.audit({ ...base, log: [...base.log, ['share', 3, 2, 5, 'local', 'did-not-win', 0, 1]] }).silent, false, 'a lost node received');
  assert.equal(F.audit({ ...base, log: [...base.log, ['drop', 2, 5, 1, 'local']] }).silent, false, 'a lost node sent');
  assert.equal(F.audit({ ...base, log: [...base.log, ['drop', 2, 1, 5, 'local']] }).silent, false);
  assert.equal(F.audit({ ...base, log: [...base.log, ['share', 1, 5, 2, 'local', 'did-not-win', 0, 0]] }).silent, true, 'round 1 is before the loss');
});

test('a small real run: Rung 4\'s receive and Rung 2\'s loop, end to end', async () => {
  const realDeps = { receive: (b, m, r, p, k) => X.receive(b, m, r, p, k, { ...X.CFG, exam: 20 }), runLoop: (s, t, o) => L.runLoop(s, t, { cycles: 1, cfg: { ...o.cfg, batch: 10 } }) };
  const r = await F.run('fab', { train, s0Text: s0 }, { ...F.CFG, nodes: 8, rounds: 2, shard: 120 }, realDeps);
  const a = F.audit(r, { nodes: 8 });
  assert.deepEqual([a.earned, a.rogueRefused, a.silent], [true, true, true]);
  assert.equal(r.log.filter((e) => e[0] === 'share').length, 24 + 8 + 24 + 2 + 8);
  assert.match(r.hash, /^[0-9a-f]{64}$/);
  assert.ok(r.shapes.every((t) => L.levelsShape(t)));
});

test('the evaluator: per-node and per-digit reads, the bootstrap, and every verdict', () => {
  const H = sub(5000, 60);
  const j = E.judgeScenario([s0, s0, s0], [true, false, true], H);
  assert.equal(j.survivors, 2);
  assert.equal(j.cells, 120);
  assert.equal(j.perNode[0], j.perNode[1]);
  assert.equal(j.right, 2 * j.perNode[0]);
  assert.ok(j.perDigit.every((v) => v === 0 || v === 1));
  const c0 = L.cellOf(L.levelsShape(s0)), said = H.x.map((x) => C.settle(c0, C.encode(x, 4)).answer);
  assert.equal(E.judgeScenario([s0], [true], { x: H.x, y: said }).right, 60, 'labels equal to its answers: every digit right');
  assert.equal(E.judgeScenario([s0], [true], { x: H.x, y: said.map((a) => (a + 1) % 10) }).right, 0, 'labels never its answers: none right');
  const a = { right: 98, cells: 100 }, b = { right: 96, cells: 100 }, c2 = { right: 95, cells: 100 };
  assert.equal(E.within(a, b, 2), true, 'exactly 2 points');
  assert.equal(E.within(a, c2, 2), false);
  assert.equal(E.within(a, { right: 192, cells: 200 }, 2), true, 'cross-multiplied');
  assert.equal(E.within(a, { right: 191, cells: 200 }, 2), false);
  const res = ['iso', 'fab', 'n25', 'n50', 'l30'].map((name) => ({ name, shapes: [s0, s0], live: [true, name !== 'n25'] }));
  const rec = E.evaluate(res, H);
  assert.deepEqual(Object.keys(rec.scenarios), ['iso', 'fab', 'n25', 'n50', 'l30']);
  assert.equal(rec.scenarios.n25.survivors, 1);
  assert.equal(rec.lowN1, 0, 'identical scenarios: no lead');
  assert.match(rec.hash, /^[0-9a-f]{64}$/);
  const sc = (acc) => ({ survivors: 12, right: acc, cells: 1000, accuracy: acc / 1000 });
  const R0 = { lowN1: 0.0001, scenarios: { iso: sc(700), fab: sc(800), n25: sc(780), n50: sc(750), l30: sc(780) } };
  const au = { fab: { adoptions: 3, rogues: 2, earned: true, rogueRefused: true, silent: true } };
  const pass = (r, x = au) => Object.fromEntries(E.verdicts(r, x).map((v) => [v.id, v.pass]));
  assert.deepEqual(pass(R0), { N1: true, N2: true, N3: true, N4: true }, 'every bar met exactly at its edge');
  assert.equal(pass({ ...R0, lowN1: 0 }).N1, false);
  assert.equal(pass({ ...R0, scenarios: { ...R0.scenarios, n25: sc(779) } }).N2, false);
  assert.equal(pass({ ...R0, scenarios: { ...R0.scenarios, n50: sc(749) } }).N2, false);
  assert.equal(pass({ ...R0, scenarios: { ...R0.scenarios, l30: sc(779) } }).N3, false);
  for (const k of ['earned', 'rogueRefused', 'silent']) assert.equal(pass(R0, { fab: { ...au.fab, [k]: false } }).N4, false, k);
  const v = E.verdicts(R0, au);
  assert.deepEqual(v.map((x) => x.bar), ['above 0', 'at most 2.0 and at most 5.0', 'at most 2.0', 'all true']);
  assert.deepEqual(v[1].measured, [2, 5]);
  assert.equal(v[2].measured, 2);
  assert.deepEqual(v[3].measured, { fab: '3 adopted, 2 rogue' });
});
