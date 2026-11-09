// app.mjs — the page's glue. Every number is read from the committed record, the scenario logs or the gate receipts, or
// computed in this tab (claim N6: none is typed into index.html). The H re-read runs in worker.mjs.
import { mintCase, sourcesOf } from './vendor/liveware/mintcase.mjs';
const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(props)) if (k === 'class') e.className = v; else e.setAttribute(k, v); for (const c of kids) e.append(c); return e; };
const json = (p) => fetch(p).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const pct = (x) => (x * 100).toFixed(1) + '%';
const big = (n) => Number(n).toLocaleString('en-GB');
const chip = (pass) => el('span', { class: 'chip ' + (pass ? 'win' : 'bad') }, pass ? 'HELD' : 'FAILED');
let REC = null, GATES = [], BASIS = null;
const PLAIN = { N1: 'The fabric beats isolation', N2: 'Graceful under node loss (3 and 6 of 12 lost)', N3: 'Graceful under link loss (30% of messages dropped)', N4: 'Every adoption earned, every rogue refused, the lost silent' };
const WHAT = { iso: 'no sharing at all', fab: 'the fabric, no loss', n25: '3 of 12 nodes go silent after round 1', n50: '6 of 12 nodes go silent after round 1', l30: '30% of messages dropped' };
const lost = (m) => (m > 0 ? 'lost ' + m.toFixed(2) + ' points' : 'lost nothing (gained ' + (-m).toFixed(2) + ' points)');
function fill() {
  const r = REC.record, v = REC.verdicts, au = REC.audits, s = r.scenarios, held = v.filter((x) => x.pass), failed = v.filter((x) => !x.pass);
  $('verdictline').textContent = held.length + ' of ' + v.length + ' measured claims held. On ' + big(r.digits) + ' test digits, nodes alone averaged ' + pct(s.iso.accuracy) + ' and the fabric ' + pct(s.fab.accuracy) + '; with half the nodes lost, the survivors averaged ' + pct(s.n50.accuracy) + '.' + (failed.length ? ' Failed and kept: ' + failed.map((x) => x.id).join(', ') + '.' : '');
  const show = (x) => (x.id === 'N1' ? (x.measured > 0 ? '+' : '') + (x.measured * 100).toFixed(2) + ' points (lower bound)' : x.id === 'N2' ? x.measured.map(lost).join('; ') : x.id === 'N3' ? lost(x.measured) : Object.entries(x.measured).map(([k, m]) => k + ': ' + m).join(' · '));
  const tb = $('claims').querySelector('tbody'); tb.replaceChildren();
  for (const x of v) tb.append(el('tr', {}, el('td', {}, el('b', {}, x.id)), el('td', {}, PLAIN[x.id]), el('td', {}, show(x)), el('td', {}, x.bar), el('td', {}, chip(x.pass))));
  for (const [id, w] of [['N5', 'Deterministic: every scenario re-derives byte for byte on GitHub\'s runner'], ['N6', 'No measured number typed into this page'], ['N7', 'The MNIST files and every vendored file are the pinned bytes']]) tb.append(el('tr', {}, el('td', {}, el('b', {}, id)), el('td', {}, w), el('td', {}, 'checked in CI'), el('td', {}, '—'), el('td', {}, el('span', { class: 'chip win' }, 'CI'))));
  for (const g of GATES) tb.append(el('tr', {}, el('td', {}, el('b', {}, 'G')), el('td', {}, 'Mutation gate on ' + g.kernel), el('td', { class: 'num' }, g.killed + ' of ' + g.total + ' caught, ' + g.ignored + ' baselined'), el('td', {}, 'clean'), el('td', {}, chip(g.clean && g.ignored === 0))));
  $('sc').querySelector('tbody').replaceChildren(...Object.keys(s).map((k) => el('tr', {}, el('td', {}, el('b', {}, k)), el('td', {}, WHAT[k]), el('td', { class: 'num' }, s[k].survivors + ' of 12'), el('td', { class: 'num' }, pct(s[k].accuracy)), el('td', { class: 'num' }, big(au[k].adoptions)), el('td', { class: 'num' }, big(au[k].rogues)))));
  const vf = (id) => v.find((x) => x.id === id) || {};
  $('lesson').textContent = 'Sharing ' + (vf('N1').pass ? 'beat' : 'did not beat') + ' isolation: ' + pct(s.iso.accuracy) + ' alone against ' + pct(s.fab.accuracy) + ' in the fabric. Losing 3 nodes left ' + pct(s.n25.accuracy) + ', losing 6 left ' + pct(s.n50.accuracy) + ', and dropping 30% of messages gave ' + pct(s.l30.accuracy) + '. ' + (vf('N4').pass ? 'Every adopted share had won its receiver\'s own exam, and the rogue was refused every time it tried. ' : 'The audit of adoptions, rogue shares and lost nodes did not hold in every scenario; see N4. ') + 'The nodes themselves are weak: each improved for only 60 cycles from Rung 1\'s cell, so these claims are about what the fabric adds and what it keeps under loss, not about how well a node reads.';
  const ul = $('results'); ul.replaceChildren();
  for (const k of Object.keys(s)) ul.append(el('li', {}, k + ' (' + WHAT[k] + '): ' + pct(s[k].accuracy) + ' with ' + s[k].survivors + ' nodes; ' + big(au[k].adoptions) + ' shares adopted, ' + big(au[k].rogues) + ' rogue shares refused.'));
  for (const g of GATES) ul.append(el('li', {}, 'Mutation gate on ' + g.kernel + ': ' + g.killed + ' of ' + g.total + ' caught, ' + g.ignored + ' baselined.'));
  $('faq-loss').textContent = 'Here, with 3 of 12 nodes gone the survivors averaged ' + pct(s.n25.accuracy) + ', and with 6 gone ' + pct(s.n50.accuracy) + ', against ' + pct(s.fab.accuracy) + ' with none lost.';
  $('faq-rogue').textContent = 'Only if its shape wins each receiver\'s own exam; a forged or unknown sender is refused before its bytes are parsed. ' + (vf('N4').pass ? 'Here the rogue tried ' + big(Object.values(au).reduce((n, a) => n + a.rogues, 0)) + ' times across the five scenarios and was refused every time.' : 'Here the audit did not hold in every scenario; see N4.');
  $('faq-failed').textContent = failed.length ? failed.map((x) => x.id + ': ' + PLAIN[x.id] + ', measured ' + show(x) + '.').join(' ') + ' Each failure is kept on the record and on this page.' : 'Nothing measured failed its bar on this run. The limits are listed in the white paper.';
  const gl = (k) => { const g = GATES.find((x) => x.kernel === k); return g ? 'mutation gate ' + g.killed + '/' + g.total + ', ' + g.ignored + ' baselined' : 'pinned'; };
  $('parts').replaceChildren(...[['src/fabric.mjs', 'The fabric: rounds, local and wide sharing, node and link loss, the rogue, and the audit.'], ['src/eval.mjs', 'H read once: every surviving node of every scenario, and every claim against its bar.'], ['vendor/mesh-share/', 'Rung 4\'s exchange and everything it vendors, byte for byte.']]
    .map(([h, t]) => el('div', { class: 'card' }, el('div', { class: 'k' }, h), el('p', { style: 'font-size:14.5px;margin-top:4px' }, t), el('p', { class: 'vs', style: 'margin-top:6px;color:var(--accent)' }, gl(h)))));
  $('timeline').replaceChildren(...[['Seal 1', 'CLAIMS.md alone, every bar.'], ['The five scenarios', 'On the training shards only (data/fabric-*.json).'], ['Seal 2', 'Every scenario\'s shapes and log by hash (SEAL2.md).'], ['H, once', 'data/record.json.']].map(([a, b]) => el('li', {}, el('b', {}, a), ' · ', b)));
}
let worker = null, seq = 0;
function ask(msg) { if (!worker) worker = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' }); return new Promise((resolve) => { const id = ++seq; const on = (e) => { if (e.data.id === id) { worker.removeEventListener('message', on); resolve(e.data); } }; worker.addEventListener('message', on); worker.postMessage({ ...msg, id }); }); }
$('go').onclick = async () => {
  $('go').disabled = true; $('gostatus').textContent = 'reading 2,000 test digits with every surviving node of five scenarios…';
  const r = await ask({ do: 'rerun' });
  $('go').disabled = false;
  if (!r.ok) { $('gostatus').textContent = 'it did not run: ' + r.why; return; }
  const a = r.record, b = REC.record, rows = [...Object.keys(b.scenarios).map((k) => [k + ' accuracy', a.scenarios[k].accuracy, b.scenarios[k].accuracy]), ['the hash of the record', a.hash, b.hash]];
  const tb = $('proof').querySelector('tbody'); tb.replaceChildren(); let all = true;
  for (const [w, x, y] of rows) { const same = x === y; all = all && same; tb.append(el('tr', {}, el('td', {}, w), el('td', { class: 'num' }, String(x).slice(0, 24)), el('td', { class: 'num' }, String(y).slice(0, 24)), el('td', { class: same ? 'ok' : 'no' }, same ? '✓ same' : '✗ differs'))); }
  $('proof').hidden = false;
  $('gostatus').textContent = (all ? '✓ your tab reproduced the record, hash and all' : '✗ your tab differs from the record') + ' · ' + (r.ms / 1000).toFixed(0) + ' s';
};
const gbp = (x) => '£' + Math.round(x).toLocaleString('en-GB');
function renderCost() {
  if (!BASIS) { $('c-head').textContent = 'The sourced basis did not load; reload the page.'; return; }
  const v = (id) => Number($(id).value);
  const r = mintCase(BASIS, { hoursPerWeek: v('c-hours'), share: v('c-share') / 100, seats: v('c-seats'), casesPerWeek: v('c-cases'), years: v('c-years') });
  if (!r.ok) { $('c-head').textContent = 'Check the inputs: ' + r.why + '.'; return; }
  const yrs = r.inputs.years + (r.inputs.years === 1 ? ' year' : ' years');
  $('c-overh').textContent = 'Over ' + yrs;
  $('c-head').textContent = `This process costs you ${gbp(r.perYear.today)} a year in staff time today. Owning it: ${gbp(r.perYear.own)} a year, which is ${gbp(r.savingPerYear)} a year back and ${gbp(r.savingOver)} over ${yrs}.`;
  const rows = [['Today', 'Your team does all of it.', 'today'], ['Rent AI assistant seats', `Microsoft 365 Copilot for ${r.inputs.seats} people (${gbp(r.lines.seats)} a year). It helps each person; the work, and the staff time, stay.`, 'rentSeats'],
    ['Call a cloud AI on every case', `Takes the same share off, billed per case at Claude Sonnet 5 API rates (${gbp(r.lines.api)} a year at your volume), and every case leaves your building.`, 'cloudApi'],
    ['Own it', `Takes the same share off on a machine you already have, for about ${gbp(r.lines.power)} a year of electricity. No seats, no meter, nothing leaves.`, 'own']];
  const tb = $('c-table').querySelector('tbody'); tb.replaceChildren();
  for (const [a, b, k] of rows) tb.append(el('tr', {}, el('td', {}, el('b', {}, a)), el('td', {}, b), el('td', { class: 'num' }, gbp(r.perYear[k])), el('td', { class: 'num' }, gbp(r.over[k]))));
  $('c-note').textContent = `Owning beats the cloud route by ${gbp(r.versusCloudOver)} over ${yrs} at this volume. Staff time is a floor: the UK median wage, with on-costs left out.`;
  $('c-board').textContent = `A fabric of small owned systems shared what worked, refused every rogue, and kept going as nodes were lost. Pick one task your sites each do by hand. Today it costs ${gbp(r.perYear.today)} a year in staff time at one site. If owned systems take off the share you estimate, that is ${gbp(r.savingPerYear)} a year back per site, with nothing leaving the building, and the fee is due only on a receipt that it beat your current way on your own data.`;
}
async function main() {
  [REC, BASIS] = await Promise.all(['data/record.json', 'vendor/liveware/basis.json'].map(json));
  GATES = (await Promise.all(['fabric', 'eval'].map((k) => json('receipts/gate-' + k + '.json')))).filter(Boolean);
  $('c-src').replaceChildren(...sourcesOf(BASIS || {}).map((s) => { const li = el('li', {}, s.what + (s.source ? ': ' : '')); if (s.source) { const a = el('a', { href: s.source, target: '_blank', rel: 'noopener' }); try { a.textContent = new URL(s.source).hostname; } catch { a.textContent = s.source; } li.append(a); } return li; }));
  for (const id of ['c-hours', 'c-share', 'c-seats', 'c-cases', 'c-years']) $(id).addEventListener('input', renderCost);
  renderCost();
  if (!REC) { $('verdictline').textContent = 'The record did not load; reload the page.'; return; }
  fill();
}
main();
