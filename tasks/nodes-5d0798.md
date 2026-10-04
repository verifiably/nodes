---
id: nodes-5d0798
title: Expose browser-safe TypeScript search subpath
status: done
priority: 2
size: xs
complexity: low
process: direct
owner: feat/sp64b-search
created: 2026-10-04T08:59:33Z
updated: 2026-10-04T09:01:34Z
started: 2026-10-04T09:00:35Z
completed: 2026-10-04T09:01:33Z
depends: []
tags: []
source: mind6-305e03
agent: codex
---

Expose SearchIndex, tokenize, and STOP_WORDS through @verifiably/nodes/search; walk the built runtime imports to enforce no node: dependencies. Tier 3 packaging convenience; no standard or parity change.

## Notes

- 2026-10-04T09:00:35Z (feat/sp64b-search): started
- 2026-10-04T09:00:35Z (feat/sp64b-search): Tier 3 package export; pure search implementation reused, no format or behavior changes. Worktree .worktrees/sp64b-search has no just setup recipe; npm ci hydrated TypeScript dependencies.
- 2026-10-04T09:01:33Z (feat/sp64b-search): RED: recorded focused test-fast failed ERR_PACKAGE_PATH_NOT_EXPORTED. GREEN: same command passed 1 browser-graph test; just gate passed Python 743 and TypeScript 570 tests; checks zero errors/warnings.
- 2026-10-04T09:01:33Z (feat/sp64b-search): done
- 2026-10-04T09:01:33Z (feat/sp64b-search): Expose browser-safe @verifiably/nodes/search subpath with transitive built-import boundary check.
