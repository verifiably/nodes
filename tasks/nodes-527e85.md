---
id: nodes-527e85
title: search-browser test needs a built dist/ that neither CI nor a fresh worktree has
status: todo
priority: 2
size: xs
complexity: low
process: direct
created: 2026-10-15T12:24:21Z
updated: 2026-10-15T12:24:21Z
depends: []
tags: [testing]
agent: claude-code/claude-opus-5-5
---

ts/tests/search-browser.test.ts resolves @verifiably/nodes/search through package.json exports, which point at dist/; dist/ exists only after npm run build. A fresh worktree fails it (seen 2026-10-15), the main checkout passes on a stale local build, and the CI workflow runs npm ci then just ci-typescript with no build step. Fix: build before the test (in the test recipe or a vitest globalSetup), or test the source graph.
