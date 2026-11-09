# Nested fabric

Live: **https://sjgant80-hub.github.io/nested-fabric/**

Rung 6 of the geometric ladder: **twelve settling-cell nodes in three clusters, sharing locally and widely, degrading
gracefully under node and link loss.** Every share goes through Rung 4's receive: roster and signature on the raw bytes,
then the parse, then the receiver's own fresh exam. A rogue on no roster tries every round.

## The result (the first 2,000 MNIST test digits, read once): all 4 measured claims held

| | claim | measured |
|---|---|---|
| ✓ | N1 the fabric beats isolation | 95% lower bound +1.32 points (56.8% alone, 58.5% in the fabric) |
| ✓ | N2 graceful under node loss (≤ 2.0 and ≤ 5.0 points) | 3 of 12 lost: lost nothing (58.9%); 6 of 12 lost: 0.34 points (58.2%) |
| ✓ | N3 graceful under link loss (≤ 2.0 points) | 30% of messages dropped: lost nothing (59.1%) |
| ✓ | N4 every adoption earned, every rogue refused, the lost silent | 137 adoptions, all earned; 155 rogue shares, all refused |

The nodes themselves are weak: each improved for only 60 cycles from Rung 1's cell. The claims are about what the fabric
adds and what survives loss, not about how well a node reads. Mutation gate: `src/fabric.mjs` 40/40, `src/eval.mjs` 7/7,
nothing baselined.

## Re-derive it

```bash
node --test test/fabric.test.mjs test/page.test.mjs
node tools/fabric.mjs --check
node tools/eval.mjs --check
```

[`CLAIMS.md`](CLAIMS.md) (seal 1) · [`SEAL2.md`](SEAL2.md) · `data/record.json`. MNIST, CC BY-SA 3.0. Powered by the
Konomi architecture, created by Thomas Frumkin. MIT licence; credits in [`NOTICE`](NOTICE).
