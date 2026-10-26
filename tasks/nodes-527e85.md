---
id: nodes-527e85
title: search-browser test needs a built dist/ that neither CI nor a fresh worktree has
status: doing
priority: 2
size: xs
complexity: low
process: direct
owner: fix/ts-ci-build
created: 2026-10-15T12:24:21Z
updated: 2026-10-26T14:49:09Z
started: 2026-10-26T14:48:29Z
depends: []
tags: [testing]
agent: claude-code/claude-opus-5-5
---

ts/tests/search-browser.test.ts resolves @verifiably/nodes/search through package.json exports, which point at dist/; dist/ exists only after npm run build. A fresh worktree fails it (seen 2026-10-15), the main checkout passes on a stale local build, and the CI workflow runs npm ci then just ci-typescript with no build step. Fix: build before the test (in the test recipe or a vitest globalSetup), or test the source graph.

## Notes

- 2026-10-26T14:48:29Z (main): started
  provenance: {"harness_session":"codex:01a178ae-16e6-74c2-af0b-be455e361123","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-26T14:49:09Z (fix/ts-ci-build): resumed
  provenance: {"harness_session":"codex:01a178ae-16e6-74c2-af0b-be455e361123","harness_session_source":"CODEX_THREAD_ID"}
