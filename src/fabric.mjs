// src/fabric.mjs — Rung 6: 12 settling-cell nodes in 3 clusters. Each round every live node improves on its own shard
// with Rung 2's loop, shares with its cluster, and (in wide rounds) cluster gateways share with each other. Every share
// goes through Rung 4's receive unchanged: roster and signature on the raw bytes, the parse, the receiver's own exam.
// Node loss and link loss are seeded. Pure and deterministic. Sealed first: CLAIMS.md (seal 1, 79da532).
import X from '../vendor/mesh-share/src/exchange.mjs';
import L from '../vendor/mesh-share/vendor/code-rsi/src/loop.mjs';
import * as K from '../vendor/mesh-share/vendor/living-seed/vendor/keys/keys.mjs';
import { rng } from '../vendor/mesh-share/vendor/code-rsi/vendor/settling-cell/vendor/seed-library/seedlib.mjs';
import { sha256Bytes, sha256Hex, utf8 } from '../vendor/mesh-share/vendor/code-rsi/vendor/settling-cell/vendor/seed-library/sha256.mjs';

export const CFG = Object.freeze({ nodes: 12, size: 4, rounds: 4, cycles: 15, shard: 2500, wide: Object.freeze([2, 4]), dropSeed: 6001, lossSeed: 6002 });
export const SCENARIOS = Object.freeze({ iso: { share: false, lost: 0, drop: 0 }, fab: { share: true, lost: 0, drop: 0 }, n25: { share: true, lost: 3, drop: 0 }, n50: { share: true, lost: 6, drop: 0 }, l30: { share: true, lost: 0, drop: 30 } });

/** keyOf(name) → a seeded Ed25519 identity: SHA-256("nested-fabric/" + name). */
export const keyOf = (name) => K.fromSeed(sha256Bytes(utf8('nested-fabric/' + name)));
/** lostSet(n, k, seed) → the k lost nodes: the first k of a seeded Fisher–Yates order of 0..n−1. */
export function lostSet(n, k, seed) {
  const r = rng(seed), p = Array.from({ length: n }, (_, j) => j);
  for (let j = n - 1; j >= 1; j--) { const q = Math.floor(r() * (j + 1)); const t = p[j]; p[j] = p[q]; p[q] = t; }
  return p.slice(0, k).sort((a, b) => a - b);
}
/** loopCfg(i, round) → node i's loop settings in a round: Rung 2's, with fresh seeds so no exam repeats across rounds. */
export const loopCfg = (i, round) => ({ ...L.CFG, loopSeed: 4242 + 100 * i + round, examSeed: 777 + 100 * i + round, noiseBase: 50000 + 1000000 * i + 10000 * round });
/** clusterOf(i, size) → the nodes in node i's cluster. */
export const clusterOf = (i, size) => Array.from({ length: size }, (_, j) => Math.floor(i / size) * size + j);
/** gateway(c, size, live) → the cluster's lowest-numbered live node, or −1 if none is live. */
export function gateway(c, size, live) {
  for (let j = c * size; j !== (c + 1) * size; j++) if (live[j]) return j;
  return -1;
}
/** dropped(seq, pct, seed) → whether message number seq is lost to the link: its seeded draw, in whole percent, is under
 *  pct. For a whole pct this is exactly "draw · 100 < pct", and it is never true at pct 0. */
export const dropped = (seq, pct, seed) => Math.floor(rng(seed + seq)() * 100) < pct;
/** shardOf(train, i, size) → node i's own shard: training rows size·i to size·i + size − 1. */
export const shardOf = (train, i, size) => ({ x: train.x.slice(size * i, size * (i + 1)), y: train.y.slice(size * i, size * (i + 1)) });

/** run(name, { train, s0Text }, cfg, deps) → one scenario: every node's final shape, who survived, and the full event log.
 *  deps defaults to Rung 4's receive and Rung 2's loop; tests may pass fast stand-ins to check the protocol itself. */
export async function run(name, { train, s0Text }, cfg = CFG, deps = { receive: X.receive, runLoop: L.runLoop }) {
  const sc = SCENARIOS[name];
  if (!sc) return null;
  const keys = [];
  for (let i = 0; i !== cfg.nodes; i++) keys.push(await keyOf('node-' + i));
  const rogue = await keyOf('rogue'), roster = keys.map((k) => k.pub), lost = lostSet(cfg.nodes, sc.lost, cfg.lossSeed);
  const shards = keys.map((_, i) => shardOf(train, i, cfg.shard)), shapes = keys.map(() => s0Text), live = keys.map(() => true), log = [];
  let seq = 0;
  for (let t = 1; t !== cfg.rounds + 1; t++) {
    if (t === 2) for (const i of lost) live[i] = false;
    for (let i = 0; i !== cfg.nodes; i++) if (live[i]) { const r = deps.runLoop(shards[i], shapes[i], { cycles: cfg.cycles, cfg: loopCfg(i, t) }); shapes[i] = r.text; log.push(['improve', t, i, r.log.filter((e) => e[2]).length]); }
    if (!sc.share) continue;
    const inbox = keys.map(() => []);
    for (let i = 0; i !== cfg.nodes; i++) if (live[i]) for (const j of clusterOf(i, cfg.size)) if (j !== i && live[j]) inbox[j].push(['local', i, await X.share(keys[i], shapes[i])]);
    if (cfg.wide.includes(t)) {
      const gw = Array.from({ length: cfg.nodes / cfg.size }, (_, c) => gateway(c, cfg.size, live)).filter((g) => g >= 0);
      for (const a of gw) for (const b of gw) if (a !== b) inbox[b].push(['wide', a, await X.share(keys[a], shapes[a])]);
    }
    for (let j = 0; j !== cfg.nodes; j++) if (live[j]) inbox[j].push(['rogue', -1, await X.share(rogue, s0Text)]);
    for (let j = 0; j !== cfg.nodes; j++) {
      for (let k = 0; k !== inbox[j].length; k++) {
        const [kind, from, msg] = inbox[j][k];
        if (dropped(seq++, sc.drop, cfg.dropSeed)) { log.push(['drop', t, from, j, kind]); continue; }
        const v = await deps.receive(shapes[j], msg, roster, shards[j], 1000 * t + k);
        if (v.adopted) shapes[j] = v.text;
        log.push(['share', t, from, j, kind, v.reason, v.wins, v.losses]);
      }
    }
  }
  const lines = log.map((e) => e.join(' ')).concat(shapes.map((s, i) => 'shape ' + i + ' ' + sha256Hex(s)));
  return { name, shapes, live, lost, log, hash: sha256Hex(lines.join('\n') + '\n') };
}

/** audit(res, cfg) → claim N4 on one scenario's log: adoptions cleared the exam, rogues refused, the lost stayed silent. */
export function audit(res, cfg = CFG) {
  const adopted = res.log.filter((e) => e[0] === 'share' && e[5] === 'adopted'), rogue = res.log.filter((e) => e[0] === 'share' && e[4] === 'rogue');
  const silent = res.log.every((e) => e[1] < 2 || !(res.lost.includes(e[2]) || ((e[0] === 'share' || e[0] === 'drop') && res.lost.includes(e[3]))));
  return { adoptions: adopted.length, earned: adopted.every((e) => e[6] - e[7] >= 2), rogues: rogue.length, rogueRefused: rogue.every((e) => e[5] === 'unknown-key'), silent, nodes: cfg.nodes };
}

export default { CFG, SCENARIOS, keyOf, lostSet, loopCfg, clusterOf, gateway, dropped, shardOf, run, audit };
