#!/usr/bin/env node
// tools/fabric.mjs — all five scenarios, on the training shards only (H is never touched here). Writes
// data/fabric-<scenario>.json (live, lost, log, hash) and data/shapes-<scenario>.txt (every node's final shape).
// `--check` re-derives every file byte for byte (CI). `--only <name>` runs one scenario.
import { readFileSync, writeFileSync } from 'node:fs';
import { train } from './data.mjs';
import F from '../src/fabric.mjs';
const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const check = process.argv.includes('--check'), only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const tr = train(), s0Text = read('vendor/mesh-share/vendor/code-rsi/vendor/settling-cell/data/cell.txt');
let same = true;
for (const name of Object.keys(F.SCENARIOS)) {
  if (only && name !== only) continue;
  const t0 = Date.now(), r = await F.run(name, { train: tr, s0Text });
  const j = JSON.stringify({ name, live: r.live, lost: r.lost, hash: r.hash, audit: F.audit(r), log: r.log }) + '\n', s = r.shapes.join('\n=====\n') + '\n';
  if (check) { const ok = read('data/fabric-' + name + '.json') === j && read('data/shapes-' + name + '.txt') === s; same = same && ok; console.log(name + ': ' + (ok ? 'REPRODUCED · ' + r.hash.slice(0, 16) : 'DIFFERS')); continue; }
  writeFileSync(new URL('data/fabric-' + name + '.json', ROOT), j); writeFileSync(new URL('data/shapes-' + name + '.txt', ROOT), s);
  const a = F.audit(r);
  console.log(name + ': ' + Math.round((Date.now() - t0) / 1000) + ' s · lost ' + JSON.stringify(r.lost) + ' · adoptions ' + a.adoptions + ' (earned ' + a.earned + ') · rogues ' + a.rogues + ' (refused ' + a.rogueRefused + ') · silent ' + a.silent + ' · ' + r.hash.slice(0, 16));
}
if (check) process.exit(same ? 0 : 1);
