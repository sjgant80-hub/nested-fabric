# Seal 2 · the five scenarios frozen, before the test digits are read

Committed after seal 1 (`CLAIMS.md`, 79da532), with no amendment. Everything below came from the MNIST training shards
only. **No code in this repository has read the MNIST test file.** The next commit runs `tools/eval.mjs` once, which
refuses to run unless this file names every scenario's shapes and log by the hashes below.

## What is frozen

| scenario | what happens | lost nodes | shapes (`data/shapes-<name>.txt`) sha256 | log (`data/fabric-<name>.json`) sha256 |
|---|---|---|---|---|
| iso | no sharing | none | bd8531b81824f6687cb6832c500afd0d492cf8c1a4c07c9b9b71960bf6dc1d94 | 19ab0d1a176dd21998822acf2e2ec867bf9e075f8af66c39d0f565138747b769 |
| fab | the fabric, no loss | none | 82365542055704b756207ec1b859d2ff7eec2fb1e7671c7c9a884fcff81fc353 | 98466dbd7da2975afc401138c0eb67e57bcbac490894037f7caecbd2c8455589 |
| n25 | 3 of 12 nodes lost after round 1 | 5, 8, 10 | c10332fc1ec478a4095a796b5a8cb3c7a4deaf114cae5691a6248d0227574733 | 89ed8cc2a4e866337f0ca2881241feedc14bb6d88c1e2198c0c1142362832941 |
| n50 | 6 of 12 nodes lost after round 1 | 1, 2, 5, 8, 10, 11 | e316e9be1c23dda4227b30f491c060a76756243f7ff597e4cac4c413d310b2e4 | 6456aa0dac34d2c47c335183edd3aceab77c7db7fb18760a6d83dd5229a39709 |
| l30 | 30% of messages dropped | none | 142e09ca70780c4edffb66ed01cd5814c4e9918ebcfcd28cf77915f7beb02b3f | 1a282ee5a5ff8e1e8ba8c4188de0db3ec60e2719f48dc74514c061a0f1ab2361 |

The audit (claim N4), on the training side, from each log:

| scenario | shares adopted | every adoption cleared its exam | rogue shares | every rogue refused as unknown-key | the lost stayed silent |
|---|---|---|---|---|---|
| iso | 0 | yes | 0 | yes | yes |
| fab | 54 | yes | 48 | yes | yes |
| n25 | 29 | yes | 39 | yes | yes |
| n50 | 20 | yes | 30 | yes | yes |
| l30 | 34 | yes | 38 | yes | yes |

## The code, frozen here

| file | sha256 | mutation gate (witness v0.6) |
|---|---|---|
| `src/fabric.mjs` | e9b320e00b7448d51ecbcb377a9456a9f167a9fc107cff0ccc8804926acfcdba | 40 of 40 caught, 0 baselined |
| `src/eval.mjs` | 4ff0a97dfa42fb8ee49c082760dc88d5904d3e4a0d89858e562ae9fc2009fbc5 | 7 of 7 caught, 0 baselined |

**Disclosed:** the five scenarios were run with `src/fabric.mjs` as it stood before the mutation gate. The gate's first
pass left 5 survivors; they were closed by restructuring, not by baselining: the shard slice became `shardOf()`, the
link-loss draw is now read in whole percent (`Math.floor(draw · 100) < pct`, which is exactly `draw · 100 < pct` for a whole
pct and never true at 0, so the redundant `pct > 0` guard went), and tests were added for the shuffle and the
evaluator. Only l30 drops messages; it was re-run on the frozen code and **reproduced byte for byte** (log hash
1eedb5841207c469…). CI re-runs all five scenarios on the frozen code (`node tools/fabric.mjs --check`).
