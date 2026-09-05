---
id: nodes-f419da
title: Serve Corpus.all() from the index and manifest instead of rescanning disk
status: done
priority: 2
size: m
owner: perf/store-stat-cache
created: 2026-09-05T13:14:28Z
updated: 2026-09-05T13:29:26Z
depends: []
tags: [perf, core]
---

Store.allNodes() (ts/src/store.ts) walks the corpus directory and reads and sha256-hashes every file on every call; the sha256 memo only skips the YAML parse for unchanged files, and each node is structuredClone'd. Corpus.all() delegates to it and ignores the in-memory structural index, which is updated incrementally on every write and already knows every uid, kind, id, and edge. Downstream this makes tag resolution in mindful v6 (buildThoughtResolverIndex over corpus.all() in Mindful.capture, edit, and tag) a full read of ~8.5k files per tagged write; the mindful-side mitigation (mind6-8e2816) only skips the build for untagged captures. Fix in the core: make all() answer from cached nodes when the manifest's recorded size and mtime are unchanged, or expose a cheaper index-backed query (id, kind, alias, title per node) that never touches disk, and give allByKind the same treatment. Measure with a warm corpus of ~10k files before and after and record the numbers in a note.

## Notes

- 2026-09-05T13:29:08Z (perf/store-stat-cache): Before (10k generated nodes, warm): allNodes 328-397ms, readFile x1000 135-162ms, cold allNodes 2368ms. After: allNodes 145-188ms, readFile x1000 13-14ms, cold 1760ms. Remaining warm allNodes cost is the stat walk (~80ms) plus structuredClone of 10k nodes (~55ms); the read+hash of every file is gone.
- 2026-09-05T13:29:08Z (perf/store-stat-cache): Design: Store keeps a per-path cache {mtimeMs,size,sha256,node}; allNodes stats every file (listCorpusFileStats) and reads only stat mismatches, re-parsing only if the sha256 changed; readFile stats once and serves from the same cache; writeFile/deleteFile update it. Trusts the stat fingerprint at the same fidelity as readCorpusFingerprint (a same-size same-mtime rewrite is served stale until the next stat change; pinned by test). Tier 3, TS only.
- 2026-09-05T13:29:26Z (perf/store-stat-cache): Store serves allNodes/readFile from a per-path stat-fingerprint cache; warm all() 2x and readFile 10x faster at 10k nodes
