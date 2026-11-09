#!/usr/bin/env node
// tools/eval.mjs — H, read once. It refuses to run unless SEAL2.md names every scenario's final shapes by their SHA-256
// and the MNIST test files are the pinned ones. Writes data/record.json; `--check` re-derives it (CI).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from './data.mjs';
import F from '../src/fabric.mjs';
import E from '../src/eval.mjs';

const PINS = { 't10k-images-idx3-ubyte.gz': '8d422c7b0a1c1c79245a5bcf07fe86e33eeafee792b84584aec276f5a2dbc4e6', 't10k-labels-idx1-ubyte.gz': 'f7ae60f92e00ec6debd23a6088c31dbd2371eca3ffa0defaefb259924204aec6' };
const ROOT = new URL('../', import.meta.url);
const raw = (p) => readFileSync(new URL(p, ROOT));
const read = (p) => raw(p).toString('utf8');
const sha = (p) => createHash('sha256').update(raw(p)).digest('hex');
const stop = (why) => { console.error('eval: ' + why); process.exit(1); };
if (!existsSync(new URL('SEAL2.md', ROOT))) stop('no SEAL2.md: the scenarios are not frozen, so H may not be read');
const seal = read('SEAL2.md'), names = Object.keys(F.SCENARIOS);
for (const n of names) for (const f of ['data/shapes-' + n + '.txt', 'data/fabric-' + n + '.json']) if (!seal.includes(sha(f))) stop(f + ' is not what seal 2 names');
for (const [f, h] of Object.entries(PINS)) if (sha('data/mnist/' + f) !== h) stop(f + ' is not the file seal 1 pinned');
const t0 = Date.now(), T = test(), H = { x: T.x.slice(0, E.DIGITS), y: T.y.slice(0, E.DIGITS) };
const results = names.map((name) => { const j = JSON.parse(read('data/fabric-' + name + '.json')); return { name, shapes: read('data/shapes-' + name + '.txt').replace(/\n$/, '').split('\n=====\n'), live: j.live, audit: j.audit }; });
const record = E.evaluate(results, H), audits = Object.fromEntries(results.map((r) => [r.name, r.audit]));
const out = JSON.stringify({ record, verdicts: E.verdicts(record, audits), audits }, null, 1) + '\n';
if (process.argv.includes('--check')) { const same = read('data/record.json') === out; console.log(same ? 'RECORD REPRODUCED · ' + record.hash.slice(0, 16) : 'RECORD DIFFERS'); process.exit(same ? 0 : 1); }
writeFileSync(new URL('data/record.json', ROOT), out);
console.log('H: ' + E.DIGITS + ' test digits × every surviving node, ' + Math.round((Date.now() - t0) / 1000) + ' s · ' + names.map((n) => n + ' ' + record.scenarios[n].accuracy + ' (' + record.scenarios[n].survivors + ' nodes)').join(' · '));
for (const v of E.verdicts(record, audits)) console.log((v.pass ? '  held   ' : '  FAILED ') + v.id + ' · ' + v.what + ' · ' + JSON.stringify(v.measured) + ' (bar ' + v.bar + ')');
