---
id: nodes-32d86e
title: Test + CI iteration cost audit
status: todo
priority: 2
size: m
created: 2026-09-04T21:44:54Z
updated: 2026-09-07T12:34:38Z
depends: [ops-31f038]
tags: [testing]
---

Piece of ops-65837b (the cross-project audit in the ops hub). 1. Measure: full-suite wall time, and roughly how often agent full-suite runs fail here. 2. Add a fast or affected-only test target for the inner loop and point AGENTS.md at it; keep the full suite for commit and CI. 3. Use a quiet reporter so test output does not flood agent context. 4. Fix suite hygiene: sleeps, real network, unshared fixtures. Record the before and after numbers in a note on this task.

## Notes

- 2026-09-05T02:38:40Z (main): design: ops docs/specs/2026-09-04-test-ci-audit-design.md; follow §5: (1) justfile + vendored tools/tt, route existing hooks, CI, and documented test commands through it, verify a line lands under each agent; (2) after a week of runs, add a note reading 'baseline <date>: <tt-report --project numbers>'; (3) gates to §4.6, AGENTS.md line, hygiene; (4) close with before/after numbers
- 2026-09-05T11:19:57Z (test-ci-audit): step 1 baseline before wiring (2026-09-05, warm caches): python 531 tests in 1.9s wall (3.1s cold), ruff 0.04s, pyright 5.3s; ts 44 files/363 tests in 2.9-3.2s wall, tsc 4.6s, biome 0.3s. The six commands AGENTS.md asked for before every commit are about 15s over six process starts. All green on 3 repeat runs; no sleeps, no real network, slowest single test 0.05s, so hygiene needs nothing. Setup from cold: uv sync 1.2s, npm ci 6.4s.
- 2026-09-05T11:19:57Z (test-ci-audit): step 1 affected-only measured before adopting: pytest-testmon selects 38 of 531 for a ranking.py edit (1.1s vs 1.9s) and 0 on a repeat; vitest --changed selects 34 of 44 files (265 of 363 tests) for a ranking.ts edit and runs in 3.1s, no faster than the whole suite, because ~1s of vitest startup plus broad import fan-in from src/ dominate. The ts fast target is a placeholder to revisit in step 3.
- 2026-09-05T11:20:05Z (test-ci-audit): step 1 wired 2026-09-05: justfile (per-package commands composed into fast/test/check, plus ci-python and ci-typescript so CI keeps its two-job matrix), vendored tools/tt version 2, .githooks installed with core.hooksPath, .tt/ and .testmondata* gitignored, CI routed through the recipes behind extractions/setup-just, AGENTS.md and both READMEs pointing at just instead of the raw commands. Verified three test-fast lines in the shared log, agent claude / null (by hand) / codex (env simulated), none in a fallback log. pytest is bare in the recipe on purpose: pyproject addopts already has -q and the documented 'pytest -q' was -qq, which drops the summary line tt counts tests from.
- 2026-09-05T11:21:27Z (main): step 1 merged to main at 6f678f6; branch and worktree removed after tt-report showed no fallback log. Step 2 is calendar time: let a week of runs accumulate, then add a note reading 'baseline 2026-09-12: <tt-report --project nodes numbers>' before moving to step 3.
- 2026-09-07T12:34:38Z (main): Correction: step 1's merge commit is 85bb065, not the 6f678f6 cited above. origin/main had never received the local trailer-stripping rewrite, so it still carried Claude-Session URLs on two commits; local main already held the clean equivalents (same trees, same parent) and was force-pushed on 2026-09-07. The old shas are gone from the branch.
