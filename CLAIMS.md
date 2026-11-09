# nested-fabric · sealed claims (seal 1, before any code of this repository)

Rung 6 of the geometric substrate ladder: **local fast clusters plus wide sharing, degrading gracefully under node
and link loss.** Every bar is fixed here. A claim that misses its bar is kept and published as failed.

## Built on the rungs below, byte for byte

Rung 4's exchange (sjgant80-hub/mesh-share `src/exchange.mjs`, sha256
7918bd858c727a9817e7154893e9d668eff71f8bef95b9b2bd21f24454dc42fd), with everything it vendors: Rung 1's cell kernel and
S0, Rung 2's loop, Rung 3's MNIST conversion, and the estate's Ed25519 keys. A share is received exactly as in Rung 4:
roster and signature on the raw bytes first, then the parse, then the receiver's own fresh exam (wins − losses ≥ 2).

## The fabric

- **12 nodes in 3 clusters:** {0–3}, {4–7}, {8–11}. Node i holds its own shard, MNIST training rows 2,500·i to
  2,500·i + 2,499. Keys are seeded SHA-256("nested-fabric/node-i"); every roster lists the 12 nodes. A **rogue**
  (SHA-256("nested-fabric/rogue")) is on no roster.
- **Every node starts from S0** (Rung 1's cell).
- **4 rounds.** In each round, every live node:
  1. **improves locally:** Rung 2's loop for 15 cycles on its own shard, from its current shape. Its loop seed is
     4242 + 100·i + round, its exam order seed 777 + 100·i + round, and its exam noise base 50,000 + 1,000,000·i +
     10,000·round. Every other loop setting is Rung 2's, sealed;
  2. **shares locally:** sends its shape to every live peer in its cluster;
  3. **shares widely, in rounds 2 and 4 only:** each cluster's gateway (its lowest-numbered live node) sends its shape
     to the other clusters' gateways;
  4. **is probed:** the rogue sends every node a validly signed shape.
- A receiver works through its incoming shares in a fixed order: local by sender number, then wide by sender number, then
  the rogue. Exam k of node i in round t uses Rung 4's exam stream with index 1,000·t + k, from node i's own shard.
- **Node loss:** lost nodes go silent for good after round 1: they neither compute, send nor receive. **Link loss:**
  each message is dropped independently with probability p (the estate rng, seed 6001 + the message's position).
- **The five scenarios:** **iso** (no sharing at all), **fab** (the fabric, no loss), **n25** (3 of 12 nodes lost),
  **n50** (6 of 12 lost), **l30** (30% of messages dropped). Lost nodes are drawn by a seeded shuffle (seed 6002).

## The claims (on the first 2,000 MNIST test digits, clean; read once, after seal 2)

The MNIST test digits were read before, by Rungs 3–5, for other claims. Nothing in this repository has read them.
A scenario's accuracy is the mean, over its surviving nodes, of each node's accuracy on the 2,000 digits.

- **N1 · the fabric beats isolation.** fab against iso: paired 95% lower bound of the per-digit mean correctness > 0.
- **N2 · graceful under node loss.** n25's survivors are within 2.0 points of fab; n50's are within 5.0 points.
- **N3 · graceful under link loss.** l30 is within 2.0 points of fab.
- **N4 · every adoption earned, every rogue refused.** Every adopted share cleared its receiver's own exam; every rogue
  share was refused as unknown-key; no lost node sent or received anything after its loss.
- **N5 · deterministic.** Every scenario's log hashes the same twice and on GitHub's runner.
- **N6 · the page.** No measured number is typed into `index.html`.
- **N7 · the data.** The MNIST files and every vendored file are byte-identical to the pins.
- **G · the gate on the code.** witness v0.6 on this repository's kernels: CLEAN, nothing baselined. CI green.

Bootstrap: 2,000 paired resamples, seed 99; a lower bound is the 2.5th percentile.

## What Rung 6 is not

A simulation of 12 nodes in one process, not a deployment over real networks; not on a chip (Rung 7).
