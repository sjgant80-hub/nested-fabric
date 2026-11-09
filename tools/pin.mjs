#!/usr/bin/env node
// tools/pin.mjs — writes vendor/SOURCES.json: the SHA-256 of every vendored file and where it came from.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const ROOT = new URL('../', import.meta.url);
const sha = (p) => createHash('sha256').update(readFileSync(new URL(p, ROOT))).digest('hex');
const M = 'vendor/mesh-share/';
const sources = [
  { from: 'sjgant80-hub/mesh-share', commit: '9088b98', files: ['src/exchange.mjs', 'vendor/code-rsi/src/loop.mjs', 'vendor/code-rsi/vendor/settling-cell/data/cell.txt', 'vendor/code-rsi/vendor/settling-cell/src/cell.mjs',
    'vendor/code-rsi/vendor/settling-cell/vendor/seed-library/seedlib.mjs', 'vendor/code-rsi/vendor/settling-cell/vendor/seed-library/sha256.mjs', 'vendor/hybrid-gate/src/mnist.mjs',
    'vendor/living-seed/vendor/keys/canon.mjs', 'vendor/living-seed/vendor/keys/keys.mjs'].map((f) => [M + f, f]) },
  { from: 'sjgant80-hub/liveware', commit: '48205c7', files: [['vendor/liveware/mintcase.mjs', 'src/mintcase.mjs'], ['vendor/liveware/basis.json', 'vendor/ai-first-company/vendor/sovereign-enterprise/data/basis.json']] },
];
const out = { note: 'Vendored byte for byte; test/page.test.mjs checks every sha256, and nothing under vendor/ may be unpinned.',
  sources: sources.map((s) => ({ from: s.from, commit: s.commit, files: s.files.map(([path, src]) => ({ path, src, sha256: sha(path) })) })) };
writeFileSync(new URL('vendor/SOURCES.json', ROOT), JSON.stringify(out, null, 1) + '\n');
console.log(out.sources.reduce((n, s) => n + s.files.length, 0) + ' files pinned');
