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
updated: 2026-10-26T14:54:03Z
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
- 2026-10-26T14:49:58Z (fix/ts-ci-build): Direct CI fix for run 40337715453: baseline just test in hydrated .worktrees/fix-ts-ci passed 755 Python tests; TypeScript had 591 passed and 1 failed (search-browser resolves missing dist/search.js), matching Node 20/24 CI. Scope: npm test builds before Vitest, test-fast calls npm test with changed-selection flags, and the package guide describes the build. Existing browser graph test is the RED regression; no runtime, export, fixture, standard or Python changes (tier 3 tooling). Prefer the shared package test entry over a CI-only build or source-graph test so all documented test routes inspect fresh published output.
- 2026-10-26T14:53:21Z (fix/ts-ci-build): review: impl round 1 — verdict: accept; findings: none; reviewer: codex/gpt-6.1-sol
- 2026-10-26T14:54:03Z (fix/ts-ci-build): attached: ts-ci-review-report.md (2360 bytes): Final branch review of 8dd401b by codex/gpt-6.1-sol: accept, no findings
