// worker.mjs — H re-read in the tab: every surviving node of every scenario reads the first 2,000 test digits (src/eval.mjs).
import M from './vendor/mesh-share/vendor/hybrid-gate/src/mnist.mjs';
import E from './src/eval.mjs';
const get = async (p, gz) => { const r = await fetch(new URL(p, import.meta.url)); if (!r.ok) throw new Error(p + ' answered ' + r.status); return gz ? new Uint8Array(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()) : r.text(); };
self.onmessage = async (m) => {
  const q = m.data || {};
  try {
    const [img, lab] = await Promise.all([get('./data/mnist/t10k-images-idx3-ubyte.gz', 1), get('./data/mnist/t10k-labels-idx1-ubyte.gz', 1)]);
    const T = M.parse(img, lab), H = { x: T.x.slice(0, E.DIGITS), y: T.y.slice(0, E.DIGITS) };
    const names = ['iso', 'fab', 'n25', 'n50', 'l30'], results = [];
    for (const name of names) { const [j, s] = await Promise.all([get('./data/fabric-' + name + '.json'), get('./data/shapes-' + name + '.txt')]); results.push({ name, shapes: s.replace(/\n$/, '').split('\n=====\n'), live: JSON.parse(j).live }); }
    const t0 = performance.now(), record = E.evaluate(results, H);
    self.postMessage({ id: q.id, ok: true, record, ms: Math.round(performance.now() - t0) });
  } catch (e) { self.postMessage({ id: q.id, ok: false, why: String((e && e.message) || e).slice(0, 200) }); }
};
