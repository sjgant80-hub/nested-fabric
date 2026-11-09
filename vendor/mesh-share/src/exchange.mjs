// src/exchange.mjs — Rung 4: two nodes and one signed exchange. A share is the canonical cell text as bytes, signed with
// Ed25519. B checks it in the sealed order: the key on its roster and the signature over the raw bytes BEFORE anything is
// parsed; then the bytes must build a cell; then the shape must win on B's own fresh exam. Any failure leaves B
// unchanged, with its reason. Sealed first: CLAIMS.md (seal 1, 0a9f4b6).
import L from '../vendor/code-rsi/src/loop.mjs';
import * as K from '../vendor/living-seed/vendor/keys/keys.mjs';
import { sha256Bytes, sha256Hex, utf8 } from '../vendor/code-rsi/vendor/settling-cell/vendor/seed-library/sha256.mjs';

export const CFG = Object.freeze({ cyclesA: 600, cyclesB: 60, exam: 200, gate: 2, examSeed: 901, noiseBase: 900000 });
export const REASONS = Object.freeze(['adopted', 'unknown-key', 'bad-signature', 'not-a-cell', 'did-not-win']);

/** keyOf(name) → the node's seeded Ed25519 identity: SHA-256("mesh-share/" + name). */
export const keyOf = (name) => K.fromSeed(sha256Bytes(utf8('mesh-share/' + name)));
/** share(key, text) → { bytes, sig, pub }: the text's UTF-8 bytes and the key's signature over exactly those bytes. */
export async function share(key, text) {
  const bytes = utf8(text);
  return { bytes, sig: await K.sign(key, bytes), pub: key.pub };
}
/** examOf(pool, k, cfg) → the k-th fresh exam drawn from B's own pool (noise seed noiseBase + k·exam + position). */
export function examOf(pool, k, b, cfg = CFG) {
  const rows = L.examRows(pool.x.length, (k + 1) * cfg.exam, cfg.examSeed), batch = { ...L.CFG, batch: cfg.exam, noiseBase: cfg.noiseBase };
  return L.batchOf(pool, rows, k, b, batch);
}
/** receive(bText, msg, roster, pool, k) → B's verdict on one share: { adopted, reason, wins, losses, text } where text is
 *  B's shape afterwards. The signature is checked on the raw bytes before they are decoded or parsed. */
export async function receive(bText, msg, roster, pool, k, cfg = CFG) {
  const stay = (reason, wins = 0, losses = 0) => ({ adopted: false, reason, wins, losses, text: bText });
  if (!roster.includes(msg.pub)) return stay('unknown-key');
  if (!(await K.verify(msg.pub, msg.sig, msg.bytes))) return stay('bad-signature');
  const text = new TextDecoder().decode(msg.bytes), sh = L.levelsShape(text), cand = sh && L.cellOf(sh), mine = L.cellOf(L.levelsShape(bText));
  if (!cand) return stay('not-a-cell');
  const items = examOf(pool, k, sh.b, cfg);
  const { wins, losses } = L.judge(L.settleAll(mine, items).right, L.settleAll(cand, items).right);
  return wins - losses >= cfg.gate ? { adopted: true, reason: 'adopted', wins, losses, text } : stay('did-not-win', wins, losses);
}
/** forge(honest, kind, others) → the five forgeries the seal names, built from A's honest share. */
export function forge(honest, kind, { cSigned, otherSig, junk, s0 }) {
  const b = honest.bytes;
  if (kind === 'F1') { const x = b.slice(); x[100] ^= 1; return { bytes: x, sig: honest.sig, pub: honest.pub }; }
  if (kind === 'F2') return cSigned;
  if (kind === 'F3') return { bytes: b, sig: otherSig, pub: honest.pub };
  if (kind === 'F4') return { bytes: b.slice(0, b.length - 50), sig: honest.sig, pub: honest.pub };
  return kind === 'F5' ? junk : s0;
}
export const KINDS = Object.freeze(['F1', 'F2', 'F3', 'F4', 'F5', 'F6']);

/** trade({ aText, bText, s0Text, poolB }) → the exchange itself, given both nodes' shapes: A signs and shares, B receives
 *  the honest share, then each forgery is tested against the B that results. */
export async function trade({ aText, bText, s0Text, poolB }, cfg = CFG) {
  const A = await keyOf('node-A'), Cn = await keyOf('node-C'), roster = [A.pub];
  const honest = await share(A, aText);
  const others = { cSigned: await share(Cn, aText), otherSig: (await share(A, bText)).sig, junk: await share(A, 'this is not a cell'), s0: await share(A, s0Text) };
  const first = await receive(bText, honest, roster, poolB, 0, cfg);
  const forgeries = [];
  for (let i = 0; i !== KINDS.length; i++) { const v = await receive(first.text, forge(honest, KINDS[i], others), roster, poolB, i + 1, cfg); forgeries.push({ kind: KINDS[i], adopted: v.adopted, reason: v.reason, wins: v.wins, losses: v.losses, unchanged: v.text === first.text }); }
  return { after: first.text, pubA: A.pub, pubC: Cn.pub, honest: { adopted: first.adopted, reason: first.reason, wins: first.wins, losses: first.losses, sig: honest.sig }, forgeries };
}
/** exchange({ poolA, poolB, s0Text }) → both runs (Rung 2's loop on each node's own pool), then the trade. */
export async function exchange({ poolA, poolB, s0Text }, cfg = CFG) {
  const runA = L.runLoop(poolA, s0Text, { cycles: cfg.cyclesA }), runB = L.runLoop(poolB, s0Text, { cycles: cfg.cyclesB });
  const t = await trade({ aText: runA.text, bText: runB.text, s0Text, poolB }, cfg);
  return { runA: { hash: runA.hash, accepted: runA.log.filter((e) => e[2]).length, cycles: runA.log.length }, runB: { hash: runB.hash, accepted: runB.log.filter((e) => e[2]).length, cycles: runB.log.length },
    aText: runA.text, bText: runB.text, after: t.after, pubA: t.pubA, pubC: t.pubC, honest: t.honest, forgeries: t.forgeries,
    hash: sha256Hex([runA.hash, runB.hash, t.honest.reason, t.honest.wins, t.honest.losses, t.honest.sig, ...t.forgeries.map((f) => f.kind + ':' + f.reason + ':' + f.wins + ':' + f.losses + ':' + f.unchanged)].join('\n')) };
}

export default { CFG, REASONS, KINDS, keyOf, share, examOf, receive, forge, trade, exchange };
