---
id: nodes-f419da
title: Serve Corpus.all() from the index and manifest instead of rescanning disk
status: todo
priority: 2
size: m
created: 2026-09-05T13:14:28Z
updated: 2026-09-05T13:14:28Z
depends: []
tags: [perf, core]
---

Store.allNodes() (ts/src/store.ts) walks the corpus directory and reads and sha256-hashes every file on every call; the sha256 memo only skips the YAML parse for unchanged files, and each node is structuredClone'd. Corpus.all() delegates to it and ignores the in-memory structural index, which is updated incrementally on every write and already knows every uid, kind, id, and edge. Downstream this makes tag resolution in mindful v6 (buildThoughtResolverIndex over corpus.all() in Mindful.capture, edit, and tag) a full read of ~8.5k files per tagged write; the mindful-side mitigation (mind6-8e2816) only skips the build for untagged captures. Fix in the core: make all() answer from cached nodes when the manifest's recorded size and mtime are unchanged, or expose a cheaper index-backed query (id, kind, alias, title per node) that never touches disk, and give allByKind the same treatment. Measure with a warm corpus of ~10k files before and after and record the numbers in a note.
