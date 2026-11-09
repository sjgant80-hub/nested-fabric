// src/loop.mjs — Rung 2: the model-free improvement loop. Code proposes a change to the settling cell's shape, the change
// is judged on a fresh exam batch it has never seen, and it is kept only if it clears the sealed gate. The loop also
// rewrites its own proposal mix from what it measured (the recursive turn). No model, no gradient, no network: the only
// imports are the vendored Rung 1 kernel, the vendored rng and SHA-256. Pure and deterministic; whole numbers in the
// cell. Sealed first: CLAIMS.md (seal 1, 3a4f0a1).
import C from '../vendor/settling-cell/src/cell.mjs';
import { rng } from '../vendor/settling-cell/vendor/seed-library/seedlib.mjs';
import { sha256Hex } from '../vendor/settling-cell/vendor/seed-library/sha256.mjs';

export const OPS = Object.freeze(['nudge', 'reseed', 'blend', 'push', 'reach', 'power']);
export const CFG = Object.freeze({ batch: 100, gate: 2, cycles: 1500, loopSeed: 4242, examSeed: 777, noiseBase: 50000, noisePixels: 6,
  w0: 100, up: 10, down: 1, wMax: 1000, wMin: 1, moves: 8, reachStep: 4, nMin: 2, nMax: 8 });

/** levelsShape(cellText) → the shape as 8×8 levels per pattern (0..b), with its classes, reach and power; or null. */
export function levelsShape(text) {
  const f = C.parseCell(text);
  if (!f) return null;
  const b = f.shape.b;
  return { b, k: f.shape.k, N: f.shape.N, R: f.R, n: f.n, cls: f.shape.cls.slice(), lv: f.shape.mem.map((m) => C.inkOf(m, b)) };
}
/** bitsOf(levels, b) → the thermometer bits for a pattern's levels (bit j of a pixel is on when its level exceeds j). */
export function bitsOf(levels, b) {
  const out = new Uint8Array(levels.length * b);
  for (let p = 0; p !== levels.length; p++) for (let j = 0; j !== b; j++) out[p * b + j] = levels[p] > j ? 1 : 0;
  return out;
}
const shapeOf = (sh) => ({ b: sh.b, k: sh.k, N: sh.N, mem: sh.lv.map((l) => bitsOf(l, sh.b)), cls: sh.cls });
/** cellOf(sh) → the Rung 1 cell for a levels shape, or null when its energy would leave the exact range. */
export const cellOf = (sh) => C.cell(shapeOf(sh), { R: sh.R, n: sh.n });
/** textOf(sh) → the shape's canonical cell text (what seal 2 hashes). */
export const textOf = (sh) => C.cellText(shapeOf(sh), sh.R, sh.n);
const copy = (sh) => ({ ...sh, cls: sh.cls.slice(), lv: sh.lv.map((l) => l.slice()) });

/** examRows(count, items, seed) → the rows of the exam stream: each epoch is a fresh Fisher–Yates order of the count rows,
 *  seeded seed + epoch. Item i of the stream is that row with fresh noise seeded noiseBase + i, so no item repeats. */
export function examRows(count, items, seed) {
  const out = new Int32Array(items);
  if (!(count > 0)) return new Int32Array(0);
  let i = 0;
  for (let e = 0; i !== items; e++) {
    const r = rng(seed + e), p = Array.from({ length: count }, (_, j) => j);
    for (let j = count - 1; j !== 0; j--) { const q = Math.floor(r() * (j + 1)); const t = p[j]; p[j] = p[q]; p[q] = t; }
    for (let j = 0; j !== count && i !== items; j++) out[i++] = p[j];
  }
  return out;
}

/** pick(w, r) → an operator index drawn in proportion to the integer weights. */
export function pick(w, r) {
  let x = Math.floor(r() * w.reduce((s, v) => s + v, 0)), i = 0;
  while (x >= w[i]) { x -= w[i]; i++; }
  return i;
}

/** l1(a, b) → the sum of level differences: the Hamming distance between the two thermometer codes. */
export function l1(a, b) {
  let d = 0;
  for (let p = 0; p !== a.length; p++) d += Math.abs(a[p] - b[p]);
  return d;
}
/** nearestOf(sh, cls, lv) → the index of the class's pattern nearest to lv (the lowest index on a tie). */
export function nearestOf(sh, cls, lv) {
  let best = -1, bd = Infinity;
  for (let m = 0; m !== sh.lv.length; m++) if (sh.cls[m] === cls) { const d = l1(sh.lv[m], lv); if (d < bd) { bd = d; best = m; } }
  return best;
}
/** shuffled(n, r) → 0..n−1 in a seeded order. */
export function shuffled(n, r) {
  const p = Array.from({ length: n }, (_, j) => j);
  for (let j = n - 1; j > 0; j--) { const q = Math.floor(r() * (j + 1)); const t = p[j]; p[j] = p[q]; p[q] = t; }
  return p;
}

/** propose(sh, op, r, errs, cfg) → a changed copy of the shape, or null when the operator has nothing to work on or would
 *  leave its range. errs: the digits the current shape got wrong in the previous batch ({ lv, y, answer }). */
export function propose(sh, op, r, errs, cfg = CFG) {
  const c = copy(sh), b = sh.b;
  if (op === 'nudge') {
    const m = Math.floor(r() * c.lv.length), p = Math.floor(r() * c.lv[m].length), d = r() < 0.5 ? -1 : 1;
    const v = c.lv[m][p] + d;
    c.lv[m][p] = v < 0 || v > b ? c.lv[m][p] - d : v;
    return c;
  }
  if (op === 'reach') { const R = sh.R + (r() < 0.5 ? -cfg.reachStep : cfg.reachStep); if (R < 1 || R > sh.N) return null; c.R = R; return c; }
  if (op === 'power') { const n = sh.n + (r() < 0.5 ? -1 : 1); if (n < cfg.nMin || n > cfg.nMax) return null; c.n = n; return c; }
  const pool = op === 'push' ? errs.filter((e) => e.answer >= 0) : errs;
  if (pool.length === 0) return null;
  const e = pool[Math.floor(r() * pool.length)];
  if (op === 'reseed') {
    const own = [];
    for (let m = 0; m !== c.cls.length; m++) if (c.cls[m] === e.y) own.push(m);
    c.lv[own[Math.floor(r() * own.length)]] = e.lv.slice();
    return c;
  }
  const m = nearestOf(c, op === 'blend' ? e.y : e.answer, e.lv);
  const order = shuffled(e.lv.length, r), target = c.lv[m];
  let moved = 0;
  for (const p of order) {
    if (moved === cfg.moves) break;
    if (op === 'blend' && target[p] !== e.lv[p]) { target[p] = e.lv[p]; moved++; }
    if (op === 'push' && target[p] === e.lv[p]) { target[p] = e.lv[p] === 0 ? 1 : e.lv[p] === b ? b - 1 : e.lv[p] + (r() < 0.5 ? -1 : 1); moved++; }
  }
  return c;
}

/** settleAll(c, items) → for each exam item, whether the cell's settled answer is right, and the answer itself. */
export function settleAll(c, items) {
  const right = new Uint8Array(items.length), answer = new Int8Array(items.length);
  for (let q = 0; q !== items.length; q++) { const a = C.settle(c, items[q].bits).answer; answer[q] = a; right[q] = a === items[q].y ? 1 : 0; }
  return { right, answer };
}
/** judge(s, p) → wins (the candidate right where the current shape was wrong) and losses (the reverse). */
export function judge(s, p) {
  let wins = 0, losses = 0;
  for (let q = 0; q !== s.length; q++) { wins += p[q] & (s[q] ^ 1); losses += s[q] & (p[q] ^ 1); }
  return { wins, losses };
}

/** batchOf(T, rows, t, b, cfg) → cycle t's fresh exam: batch items, each a T digit with fresh noise (seed noiseBase + i). */
export function batchOf(T, rows, t, b, cfg = CFG) {
  const items = [];
  for (let q = 0; q !== cfg.batch; q++) {
    const i = t * cfg.batch + q, row = rows[i];
    items.push({ i, row, y: T.y[row], bits: C.encode(C.noisy(T.x[row], cfg.noisePixels, cfg.noiseBase + i), b) });
  }
  return items;
}

/** runLoop(T, s0Text, { adaptive, cycles, cfg }) → the whole run: every cycle's [operator, proposal built, accepted, wins,
 *  losses], the final weights, the final shape's text and the run's hash. adaptive: false is the twin with frozen weights. */
export function runLoop(T, s0Text, { adaptive = true, cycles = CFG.cycles, cfg = CFG } = {}) {
  let sh = levelsShape(s0Text), c = sh && cellOf(sh);
  if (!c) return null;
  const r = rng(cfg.loopSeed), w = OPS.map(() => cfg.w0), rows = examRows(T.x.length, cycles * cfg.batch, cfg.examSeed), log = [];
  let errs = [];
  for (let t = 0; t !== cycles; t++) {
    const o = pick(w, r), cand = propose(sh, OPS[o], r, errs, cfg), cc = cand && cellOf(cand);
    const items = batchOf(T, rows, t, sh.b, cfg), s = settleAll(c, items);
    const { wins, losses } = cc ? judge(s.right, settleAll(cc, items).right) : { wins: 0, losses: 0 };
    const acc = cc && wins - losses >= cfg.gate ? 1 : 0;
    errs = items.map((it, q) => ({ lv: C.inkOf(it.bits, sh.b), y: it.y, answer: s.answer[q] })).filter((_, q) => s.right[q] === 0);
    if (acc) { sh = cand; c = cc; }
    if (adaptive) w[o] = acc ? Math.min(cfg.wMax, w[o] + cfg.up) : Math.max(cfg.wMin, w[o] - cfg.down);
    log.push([o, cc ? 1 : 0, acc, wins, losses]);
  }
  const text = textOf(sh);
  return { log, weights: w, text, hash: sha256Hex(log.map((e, t) => t + ' ' + e.join(' ')).join('\n') + '\n' + text) };
}

export default { OPS, CFG, levelsShape, bitsOf, cellOf, textOf, examRows, pick, l1, nearestOf, shuffled, propose, settleAll, judge, batchOf, runLoop };
