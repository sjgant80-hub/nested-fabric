// The page and the files, held to their sealed claims: N6 (no measured number typed into the page), N7 (the data and every
// vendored file are the pinned bytes), seal 2 naming every scenario the test digits were read with, the credits, the failures told.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const sha = (p) => createHash('sha256').update(readFileSync(new URL(p, ROOT))).digest('hex');
const html = read('index.html'), app = read('app.mjs'), claims = read('CLAIMS.md');
const NAMES = ['iso', 'fab', 'n25', 'n50', 'l30'];

test('N7: the data and every vendored file are the pinned bytes', () => {
  assert.ok(claims.includes(sha('vendor/mesh-share/src/exchange.mjs')), 'the exchange seal 1 names');
  const pinned = new Map();
  for (const s of JSON.parse(read('vendor/SOURCES.json')).sources) for (const f of s.files) pinned.set(f.path, f.sha256);
  const files = [];
  (function walk(d) { for (const n of readdirSync(new URL(d, ROOT))) { const p = d + '/' + n; if (statSync(new URL(p, ROOT)).isDirectory()) walk(p); else files.push(p); } })('vendor');
  for (const f of files.filter((x) => x !== 'vendor/SOURCES.json')) { assert.ok(pinned.has(f), f + ' is not pinned'); assert.equal(sha(f), pinned.get(f), f + ' changed'); }
  assert.equal(sha('data/mnist/t10k-images-idx3-ubyte.gz'), '8d422c7b0a1c1c79245a5bcf07fe86e33eeafee792b84584aec276f5a2dbc4e6');
  assert.equal(sha('data/mnist/t10k-labels-idx1-ubyte.gz'), 'f7ae60f92e00ec6debd23a6088c31dbd2371eca3ffa0defaefb259924204aec6');
  assert.equal(sha('data/mnist/train-images-idx3-ubyte.gz'), '440fcabf73cc546fa21475e81ea370265605f56be210a4024d2ca8f203523609');
  assert.equal(sha('data/mnist/train-labels-idx1-ubyte.gz'), '3552534a0a558bbed6aed32b30c495cca23d567ec52cac8be1a0730e8010255c');
});
test('seal 2 names every scenario\'s shapes and log', () => {
  const seal = read('SEAL2.md');
  for (const n of NAMES) for (const f of ['data/shapes-' + n + '.txt', 'data/fabric-' + n + '.json']) assert.ok(seal.includes(sha(f)), f);
});
test('seal 2\'s code hashes: the committed code is the sealed code (src/fabric.mjs sealed with CRLF line endings, SEAL2-NOTE.md)', () => {
  const seal = read('SEAL2.md'), note = read('SEAL2-NOTE.md'), h = (s) => createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');
  const lf = (p) => read(p).replace(/\r\n/g, '\n');
  assert.ok(seal.includes(h(lf('src/fabric.mjs').replace(/\n/g, '\r\n'))), 'src/fabric.mjs with CRLF endings is exactly the sealed hash');
  assert.ok(note.includes(h(lf('src/fabric.mjs'))), 'and the note names its LF hash');
  assert.ok(seal.includes(h(lf('src/eval.mjs'))), 'src/eval.mjs is the sealed hash as stored');
});
test('N6: no measured number is typed into the page', () => {
  const r = JSON.parse(read('data/record.json')).record, forms = new Set();
  for (const k of NAMES) { const a = r.scenarios[k].accuracy; forms.add((a * 100).toFixed(1) + '%'); forms.add((a * 100).toFixed(2) + '%'); }
  forms.add(r.hash.slice(0, 12));
  const visible = html.replace(/<style>[\s\S]*?<\/style>/, '');
  for (const s of forms) assert.equal(visible.includes(s), false, 'the page has "' + s + '" typed in; it must come from the record');
  assert.match(app, /pct\(s\.fab\.accuracy\)/);
});
test('the failures are told, the page explains itself, talks only to itself, and carries its credits', () => {
  assert.match(app, /pass \? 'HELD' : 'FAILED'/);
  assert.match(app, /Failed and kept: /);
  assert.match(app, /Each failure is kept on the record and on this page\./);
  assert.match(html, /A claim that misses its bar is kept and shown as failed\./);
  for (const id of ['result', 'scenarios', 'rerun', 'what', 'start', 'how', 'blueprint', 'adoption', 'paper', 'business']) assert.match(html, new RegExp('<section id="' + id + '"'), id);
  assert.match(html, /connect-src 'self'/);
  assert.match(html, /Powered by the Konomi architecture, created by Thomas Frumkin/);
  assert.match(html, /Y\. LeCun, C\. Cortes and C\. J\. C\. Burges, CC BY-SA 3\.0/);
  assert.equal(/£\s?\d|\$\s?\d|per seat|\/mo\b/i.test(html), false, 'no price of ours on the page');
});
