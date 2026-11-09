# A note on seal 2 (added after it, disclosed; `SEAL2.md` itself is not edited)

`SEAL2.md` names `src/fabric.mjs` by sha256 **e9b320e00b7448d51ecbcb377a9456a9f167a9fc107cff0ccc8804926acfcdba**. That is
the hash of the file as it stood on the Windows build machine, with **CRLF line endings** (a Python patch wrote it in
text mode). Git stores the file with LF line endings, so the committed `src/fabric.mjs` hashes to
**49dd8e73d854d8f34188e5b71a25b4a5a0dfd0d4dfccee147563bca5c201964a** instead.

The two are the same code: adding a carriage return to the end of every line of the committed file gives exactly the
sealed hash. `test/page.test.mjs` checks this on every CI run:

```bash
sed 's/$/\r/' src/fabric.mjs | sha256sum   # e9b320e00b7448d51ecbcb377a9456a9f167a9fc107cff0ccc8804926acfcdba
```

Nothing else in seal 2 is affected. The scenario shapes and logs (the files `tools/eval.mjs` checks before reading the
test digits) are stored byte for byte (`data/** -text`) and match `SEAL2.md` exactly, and `src/eval.mjs` was already LF.
