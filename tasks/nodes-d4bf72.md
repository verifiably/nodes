---
id: nodes-d4bf72
title: Memoize node parsing in Corpus.all() by content hash
status: done
priority: 2
size: s
owner: perf/memoize-all-parse
created: 2026-09-05T02:40:07Z
updated: 2026-09-05T02:42:28Z
depends: []
tags: [perf]
---

Corpus.all() reads and YAML-parses every node file on each call; callers that build per-write indexes over all() (mindful's resolver index) go quadratic when seeding, and every resident-shell command that tags or aliases re-parses the corpus. Files stay the source of truth: all() keeps reading and hashing every file, and only skips the parse for content whose sha256 was parsed before. Returned nodes are independent copies. Tier 3 (TS-only performance); no standard change.

## Notes

- 2026-09-05T02:41:55Z (perf/memoize-all-parse): Found from the mindful v6 test audit: Corpus.all() parse dominated (1000 small nodes: iterCorpusFiles read+hash 19ms, all() 87-126ms). Memo lives in Store.allNodes keyed by file sha256, rebuilt each call so deleted or changed files drop out; results are structuredClone copies. After: first call 146ms (parse + clone), warm calls 19-20ms. Mindful v6 suite and typecheck pass against the rebuilt dist.
- 2026-09-05T02:42:28Z (perf/memoize-all-parse): Store.allNodes memoizes parsing by file sha256 with copied results; warm all() 5x faster at 1000 nodes, files remain the source of truth
