// src/eval.mjs — H, read once after seal 2: every surviving node of every scenario reads the first 2,000 MNIST test
// digits (clean), and every claim is judged against the bar CLAIMS.md fixed first, on whole counts where it can be.
import C from '../vendor/mesh-share/vendor/code-rsi/vendor/settling-cell/src/cell.mjs';
import L from '../vendor/mesh-share/vendor/code-rsi/src/loop.mjs';
import { sha256Hex } from '../vendor/mesh-share/vendor/code-rsi/vendor/settling-cell/vendor/seed-library/sha256.mjs';
import { round6 } from '../vendor/mesh-share/vendor/code-rsi/vendor/settling-cell/vendor/seed-library/seedlib.mjs';

export const DIGITS = 2000;

/** judgeScenario(shapes, live, H) → every surviving node's per-digit right (1/0), its total, and the per-digit mean. */
export function judgeScenario(shapes, live, H) {
  const nodes = [];
  for (let i = 0; i !== shapes.length; i++) if (live[i]) {
    const c = L.cellOf(L.levelsShape(shapes[i]));
    nodes.push(H.x.map((x, d) => (C.settle(c, C.encode(x, 4)).answer === H.y[d] ? 1 : 0)));
  }
  const right = nodes.reduce((s, v) => s + v.reduce((a, b) => a + b, 0), 0);
  return { survivors: nodes.length, right, cells: nodes.length * H.x.length, perDigit: H.x.map((_, d) => nodes.reduce((s, v) => s + v[d], 0) / nodes.length), perNode: nodes.map((v) => v.reduce((a, b) => a + b, 0)) };
}
/** within(a, b, pts) → scenario b is within pts points of scenario a, on whole counts: 100·(a − b) ≤ pts, cross-multiplied. */
export const within = (a, b, pts) => 100 * (a.right * b.cells - b.right * a.cells) <= pts * a.cells * b.cells;

/** evaluate(results, H) → the record: each scenario's accuracy, the N1 bootstrap, and the hash of every per-digit read. */
export function evaluate(results, H) {
  const S = {};
  for (const r of results) S[r.name] = judgeScenario(r.shapes, r.live, H);
  const lines = Object.entries(S).map(([k, s]) => k + ' ' + s.perNode.join(',') + ' ' + s.perDigit.join(''));
  return {
    digits: H.x.length, scenarios: Object.fromEntries(Object.entries(S).map(([k, s]) => [k, { survivors: s.survivors, right: s.right, cells: s.cells, accuracy: round6(s.right / s.cells), perNode: s.perNode }])),
    lowN1: round6(C.pairedLow(S.fab.perDigit, S.iso.perDigit, 2000, 99)), hash: sha256Hex(lines.join('\n') + '\n'),
  };
}
/** verdicts(r, audits) → each sealed claim beside its bar. */
export function verdicts(r, audits) {
  const s = r.scenarios, pts = (a, b) => round6(100 * (s[a].accuracy - s[b].accuracy));
  return [
    { id: 'N1', what: 'the fabric beats isolation: 95% lower bound of the per-digit mean correctness', measured: r.lowN1, bar: 'above 0', pass: r.lowN1 > 0 },
    { id: 'N2', what: 'points lost by the survivors when 3 and when 6 of 12 nodes are lost', measured: [pts('fab', 'n25'), pts('fab', 'n50')], bar: 'at most 2.0 and at most 5.0', pass: within(s.fab, s.n25, 2) && within(s.fab, s.n50, 5) },
    { id: 'N3', what: 'points lost when 30% of messages are dropped', measured: pts('fab', 'l30'), bar: 'at most 2.0', pass: within(s.fab, s.l30, 2) },
    { id: 'N4', what: 'every adoption earned, every rogue refused, the lost silent: in every scenario', measured: Object.fromEntries(Object.entries(audits).map(([k, a]) => [k, a.adoptions + ' adopted, ' + a.rogues + ' rogue'])), bar: 'all true', pass: Object.values(audits).every((a) => a.earned && a.rogueRefused && a.silent) },
  ];
}
export default { DIGITS, judgeScenario, within, evaluate, verdicts };
